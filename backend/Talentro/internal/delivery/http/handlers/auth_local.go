package handlers

import (
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"unicode/utf8"

	"talentro/internal/auth"
	"talentro/internal/httpx"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// §12.2: вход — 10 попыток в минуту с одного IP, регистрация — 3 в час, ответ
// 429. Окна держит Limiter из internal/auth.
const (
	loginAttempts    = 10
	registerAttempts = 3
)

// badCredentials — единственный текст, который слышит тот, кто не смог войти.
// §3.7.1 требует уникальной почты, значит по различию ответов её существование
// проверяется перебором; различия нет ни в тексте, ни в статусе.
const badCredentials = "неверная почта или пароль"

// loginBlocked — текст 429 для любого входа (§12.2). Один на пароль, токен
// проверки и Google: окно у них общее, и объяснение тоже не должно различаться.
const loginBlocked = "слишком много попыток входа, подожди минуту"

// decoyChecked держит результат сверки с хэшем-заглушкой. Ответ на неё не
// нужен, но без присваивания вызов стоит в коде ради одного побочного эффекта,
// и его легко потерять при следующей правке; переменная уровня пакета —
// страховка, что работу, на которой держится защита по времени, не выбросят.
var decoyChecked bool

// LocalUserStore — шов локального входа, второй после UserStore: тесты хендлеров
// проверяют ответы 401/409/429 без поднятого Postgres.
type LocalUserStore interface {
	PasswordByEmail(email string) (models.User, string, error)
	InsertLocalUser(email, name, passwordHash string) (models.User, error)
}

// Login — POST /api/auth/login, тело {"email","password"} (§3.7.1, §9.8).
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	// Счётчик включается после проверки формы: 400 на пустое поле не «попытка
	// входа», и опечатка в адресе не должна съедать лимит (§12.2).
	ip := auth.ClientIP(r)
	if !h.loginLimit.Allow(ip) {
		tooMany(w, h.loginLimit, ip, loginBlocked)
		return
	}

	user, hash, err := h.local.PasswordByEmail(normalizeEmail(body.Email))
	unknown := errors.Is(err, repository.ErrNoUser)
	if !unknown && err != nil {
		log.Println("Login: ", err) // почту и хэш в лог нельзя (§12.1)
		serverError(w)
		return
	}

	// Два отказа считаются и выглядят одинаково с «неверным паролем»: почты нет
	// вовсе (ErrNoUser) и аккаунт есть, но без пароля — password_hash IS NULL,
	// так заводит человека вход через Google (§3.7.4). Пустой хэш
	// VerifyPassword отбраковывает мгновенно, и без сверки с заглушкой такой
	// ответ пришёл бы на два порядка быстрее: время стало бы тем же признаком,
	// который §3.7.1 запрещает подсматривать.
	if unknown || hash == "" {
		decoyChecked = auth.VerifyPassword(h.loginDecoy, body.Password)
		fail(w, http.StatusUnauthorized, badCredentials)
		return
	}

	if !auth.VerifyPassword(hash, body.Password) {
		fail(w, http.StatusUnauthorized, badCredentials)
		return
	}

	h.issueWith(w, r, claimsOf(user), http.StatusOK)
}

// Register — POST /api/auth/register, тело {"email","password","name"}
// (§3.7.1..2, §9.8). Успех — 201 и сразу кука: гостя не отправляют входить
// повторно после оформления аккаунта.
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	// Тип аккаунта здесь не принимается: по §3.7.2 его выбирает модератор, а
	// регистрация создаёт обычного пользователя.
	email := normalizeEmail(body.Email)
	name := strings.TrimSpace(body.Name)

	fields := map[string]string{}
	if !validEmail(email) {
		fields["email"] = "нужен адрес вида имя@домен.рф"
	}
	if utf8.RuneCountInString(body.Password) < auth.PasswordMinLen {
		fields["password"] = "пароль не короче " + strconv.Itoa(auth.PasswordMinLen) + " символов"
	}
	switch {
	case name == "":
		// Имя необязательное: §3.7.1 называет полями входа почту и пароль, а
		// `users.name` в §7.4 публикуется пустым как null. Звать человека по
		// почте — дело фронта.
	case utf8.RuneCountInString(name) > maxUserNameRunes:
		fields["name"] = "имя длиннее " + strconv.Itoa(maxUserNameRunes) + " символов"
	}
	if len(fields) > 0 {
		httpx.WriteError(w, httpx.NewBadRequest(fields))
		return
	}

	ip := auth.ClientIP(r)
	if !h.registerLimit.Allow(ip) {
		tooMany(w, h.registerLimit, ip, "слишком много регистраций с этого адреса, попробуй позже")
		return
	}

	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		log.Println("Register: ", err)
		serverError(w)
		return
	}

	user, err := h.local.InsertLocalUser(email, name, hash)
	switch {
	case errors.Is(err, repository.ErrEmailTaken):
		httpx.WriteError(w, httpx.NewError(http.StatusConflict,
			"аккаунт с такой почтой уже есть",
			map[string]string{"email": "войди вместо регистрации"}))
		return
	case err != nil:
		log.Println("Register: ", err)
		serverError(w)
		return
	}

	h.issueWith(w, r, claimsOf(user), http.StatusCreated)
}

// claimsOf — содержимое куки из строки users. Тестовой ролью считается только
// вход по токену: в канонической схеме (§7.8) tester среди account_type нет.
func claimsOf(u models.User) auth.Claims {
	return auth.Claims{
		UserID:   u.ID,
		Email:    u.Email,
		Name:     u.Name,
		Picture:  u.AvatarURL,
		Role:     u.Role,
		Provider: u.Provider,
		Tester:   u.Role == models.RoleTester,
	}
}

func serverError(w http.ResponseWriter) {
	httpx.WriteError(w, httpx.NewError(http.StatusInternalServerError,
		"серверная ошибка, попробуй позже", nil))
}

// tooMany — 429 (§12.2). Retry-After обязателен: без него клиент не знает,
// сколько ждать, и долбит чаще.
func tooMany(w http.ResponseWriter, l *auth.Limiter, ip, message string) {
	if seconds := l.RetryAfter(ip); seconds > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(seconds))
	}
	httpx.WriteError(w, httpx.NewError(http.StatusTooManyRequests, message, nil))
}

// maxUserNameRunes — потолок по длине users.name (VARCHAR(120), Postgres
// считает символы, а не байты).
const maxUserNameRunes = 120

// normalizeEmail — нижний регистр и пробелы вокруг. Почта уникальна (§3.7.1),
// а Postgres сравнивает её регистрозависимо: «Ivan@x.com» и «ivan@x.com» были бы
// двумя аккаунтами одного человека.
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// validEmail — форма по §3.7.1: подтверждение почты не нужно, но адрес должен
// быть настоящим. net/mail ловит синтаксис, сверху требуем точку в домене
// («ivan@mail» почтовым адресом не является) и длину колонки VARCHAR(254).
func validEmail(email string) bool {
	if email == "" || len(email) > 254 || strings.ContainsAny(email, " \t<>\"") {
		return false
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return false
	}
	domain := email[strings.LastIndex(email, "@")+1:]
	return strings.Contains(domain, ".") && !strings.HasPrefix(domain, ".") && !strings.HasSuffix(domain, ".")
}
