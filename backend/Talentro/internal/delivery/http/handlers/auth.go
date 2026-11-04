package handlers

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"talentro/internal/auth"
	"talentro/internal/config"
	"talentro/internal/httpx"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// GoogleVerifier отделён интерфейсом, чтобы тесты проверяли обязательность aud
// без сети: настоящий ходит в oauth2.googleapis.com, подставной — нет.
type GoogleVerifier interface {
	Verify(credential string) (*models.GoogleProfile, error)
}

// UserStore — второй шов: вход через Google записывает пользователя, а тесты
// авторизации не должны поднимать ради этого Postgres.
type UserStore interface {
	UpsertGoogleUser(p models.GoogleProfile) (models.User, error)
}

type AuthHandler struct {
	verifier       GoogleVerifier
	users          UserStore
	local          LocalUserStore
	store          *auth.Store
	googleClientID string
	testerToken    string

	// Ограничение частоты по §12.2: вход 10 попыток в минуту с одного IP,
	// регистрация 3 в час.
	loginLimit    *auth.Limiter
	registerLimit *auth.Limiter

	// loginDecoy — хэш, с которым сверяется пароль неизвестной почты; см. Login.
	loginDecoy string
}

func NewAuthHandler(
	cfg *config.Config,
	repo *repository.Repository,
	store *auth.Store,
) *AuthHandler {
	// Один тяжёлый хэш на старте процесса вместо хэша из таблицы — чтобы ответ
	// «такой почты нет» считался столько же, сколько «неверный пароль».
	decoy, err := auth.HashPassword("decoy-hash-nikto-ne-vvedet")
	if err != nil {
		// crypto/rand не дал соль. Без заглушки вход остаётся работоспособным,
		// просто теряет защиту по времени ответа.
		log.Println("хэш-заглушка не посчитан: ", err)
	}

	return &AuthHandler{
		verifier: &tokenInfoVerifier{
			clientID: cfg.GoogleClientID,
			client:   &http.Client{Timeout: 8 * time.Second},
			endpoint: googleTokenInfoEndpoint,
		},
		users:          repo,
		local:          repo,
		store:          store,
		googleClientID: cfg.GoogleClientID,
		testerToken:    cfg.TesterToken,
		loginLimit:     auth.NewLimiter(loginAttempts, time.Minute),
		registerLimit:  auth.NewLimiter(registerAttempts, time.Hour),
		loginDecoy:     decoy,
	}
}

// MeView — единственное, что фронт узнаёт о посетителе. Отдельный тип нужен,
// чтобы ответ `/me` и ответ входа не разъехались по полям.
type MeView struct {
	Authenticated bool   `json:"authenticated"`
	Tester        bool   `json:"tester"`
	Role          string `json:"role,omitempty"`
	Name          string `json:"name,omitempty"`
	Email         string `json:"email,omitempty"`
	Picture       string `json:"picture,omitempty"`
	Provider      string `json:"provider,omitempty"`
}

// GoogleLogin проверяет ID-токен, заводит или находит пользователя и выдаёт
// куку сессии.
// POST /api/auth/google  body: { "credential": "<id_token>" }
func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	credential, ok := decodeCredential(w, r)
	if !ok {
		return
	}

	// Раньше при пустом GOOGLE_CLIENT_ID проверка aud просто пропускалась, и
	// подходил любой ID-токен любого клиента. Теперь вход закрыт, пока клиент
	// не настроен, — 503 вместо «пропустили чужую подпись».
	if h.googleClientID == "" {
		fail(w, http.StatusServiceUnavailable, "вход через Google не настроен: не задан GOOGLE_CLIENT_ID")
		return
	}

	profile, err := h.verifier.Verify(credential)
	if err != nil {
		log.Println("GoogleLogin: ", err)
		httpx.WriteError(w, httpx.NewError(http.StatusUnauthorized, "токен Google не принят", nil))
		return
	}
	if strings.TrimSpace(profile.Email) == "" {
		fail(w, http.StatusUnauthorized, "в токене нет адреса электронной почты")
		return
	}

	user, err := h.users.UpsertGoogleUser(*profile)
	switch {
	case errors.Is(err, repository.ErrEmailTaken):
		fail(w, http.StatusConflict, "этот адрес уже привязан к другому аккаунту")
		return
	case err != nil:
		log.Println("UpsertGoogleUser: ", err)
		fail(w, http.StatusInternalServerError, "внутренняя ошибка сервера")
		return
	}

	claims := auth.Claims{
		UserID:   user.ID,
		Email:    user.Email,
		Name:     user.Name,
		Picture:  user.AvatarURL,
		Role:     user.Role,
		Provider: user.Provider,
		Tester:   user.Role == models.RoleTester,
	}
	if claims.Name == "" {
		claims.Name = strings.Split(claims.Email, "@")[0]
	}

	h.issueWith(w, r, claims, http.StatusOK)
}

// TesterLogin выдаёт куку тестировщика по токену из env: разделы на моках
// (кабинет модератора, приём анкет, отзывы) должны видеть не все, но видеть
// кто-то должен — иначе их нельзя принять.
// POST /api/auth/tester  body: { "token": "..." }
func (h *AuthHandler) TesterLogin(w http.ResponseWriter, r *http.Request) {
	if h.testerToken == "" {
		fail(w, http.StatusServiceUnavailable, "вход для проверки отключён: не задан TESTER_TOKEN")
		return
	}

	var body struct {
		Token string `json:"token"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	got := []byte(strings.TrimSpace(body.Token))
	want := []byte(h.testerToken)
	if len(got) == 0 || subtle.ConstantTimeCompare(got, want) != 1 {
		fail(w, http.StatusUnauthorized, "неверный токен")
		return
	}

	h.issueWith(w, r, auth.Claims{
		Email:    "tester@localhost",
		Name:     "Тестировщик",
		Role:     models.RoleTester,
		Provider: "token",
		Tester:   true,
	}, http.StatusOK)
}

// Me — состояние посетителя. Отсутствие куки отдаётся как 200 с
// authenticated: false: это не ошибка запроса, а обычный анонимный заход, и
// фронт не должен показывать ошибку на каждом первом рендере.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		fail(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	claims, err := h.store.ClaimsFromRequest(r)
	if err != nil {
		if !errors.Is(err, auth.ErrInvalid) {
			log.Println("ClaimsFromRequest: ", err)
		}
		httpx.WriteJSON(w, http.StatusOK, MeView{})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, MeView{
		Authenticated: true,
		Tester:        claims.Tester,
		Role:          claims.Role,
		Name:          claims.Name,
		Email:         claims.Email,
		Picture:       claims.Picture,
		Provider:      claims.Provider,
	})
}

// Logout снимает куку. Запрос от анонима — тоже успех: состояние уже нужное.
// Метод проверяется здесь, а не только в роутере: выход по GET-ссылке из
// чужой страницы (SameSite=Lax её отпустит) не должен быть возможен.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		fail(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	h.store.Clear(w, auth.SecureRequest(r))
	w.WriteHeader(http.StatusNoContent)
}

// issueWith выдаёт куку и то же тело MeView с другим статусом: регистрация
// создаёт ресурс, поэтому у неё 201, а остальному входу — 200.
func (h *AuthHandler) issueWith(w http.ResponseWriter, r *http.Request, claims auth.Claims, status int) {
	if err := h.store.Set(w, claims, auth.SecureRequest(r)); err != nil {
		log.Println("Set session cookie: ", err)
		fail(w, http.StatusInternalServerError, "не удалось выдать сессию")
		return
	}
	httpx.WriteJSON(w, status, MeView{
		Authenticated: true,
		Tester:        claims.Tester,
		Role:          claims.Role,
		Name:          claims.Name,
		Email:         claims.Email,
		Picture:       claims.Picture,
		Provider:      claims.Provider,
	})
}

func decodeCredential(w http.ResponseWriter, r *http.Request) (string, bool) {
	var body struct {
		Credential string `json:"credential"`
	}
	if !decodeJSON(w, r, &body) {
		return "", false
	}
	credential := strings.TrimSpace(body.Credential)
	if credential == "" {
		fail(w, http.StatusBadRequest, "credential обязателен")
		return "", false
	}
	return credential, true
}

// decodeJSON объединяет проверку метода, лимит тела и ошибку разбора: куки
// выдаются POST-ом, и GET с подставным телом не должен ничего оформлять.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if r.Method != http.MethodPost {
		fail(w, http.StatusMethodNotAllowed, "method not allowed")
		return false
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(dst); err != nil {
		fail(w, http.StatusBadRequest, "некорректное тело запроса")
		return false
	}
	return true
}

// fail — ошибка авторизации в общем конверте §9. http.Error дал бы текстовое
// тело, и фронту пришлось бы угадывать формат ответа по content-type.
func fail(w http.ResponseWriter, status int, message string) {
	httpx.WriteError(w, httpx.NewError(status, message, nil))
}

// tokenInfoVerifier сверяет подпись и срок действия токена на стороне Google и
// проверяет, что токен выпущен именно для нашего клиента.
type tokenInfoVerifier struct {
	clientID string
	client   *http.Client
	// endpoint задан только ради тестов: в бою это oauth2.googleapis.com, а
	// сверку aud надо прогонять без сети.
	endpoint string
}

const googleTokenInfoEndpoint = "https://oauth2.googleapis.com/tokeninfo"

// googleTokenInfo — нужная часть ответа oauth2.googleapis.com/tokeninfo.
type googleTokenInfo struct {
	Aud           string `json:"aud"`
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Error         string `json:"error"`
	ErrorDesc     string `json:"error_description"`
}

func (v *tokenInfoVerifier) Verify(credential string) (*models.GoogleProfile, error) {
	endpoint := v.endpoint
	if endpoint == "" {
		endpoint = googleTokenInfoEndpoint
	}
	endpoint += "?id_token=" + url.QueryEscape(credential)

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("сборка запроса к Google: %w", err)
	}

	resp, err := v.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("запрос к Google: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if err != nil {
		return nil, fmt.Errorf("чтение ответа Google: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Google отклонил токен (HTTP %d)", resp.StatusCode)
	}

	var info googleTokenInfo
	if err := json.Unmarshal(raw, &info); err != nil {
		return nil, fmt.Errorf("разбор ответа Google: %w", err)
	}
	if info.Error != "" {
		return nil, fmt.Errorf("%s: %s", info.Error, info.ErrorDesc)
	}
	if info.Sub == "" {
		return nil, errors.New("в токене нет subject")
	}
	if info.Aud != v.clientID {
		return nil, fmt.Errorf("токен выпущен для другого клиента (%s)", info.Aud)
	}

	return &models.GoogleProfile{
		Sub:           info.Sub,
		Email:         info.Email,
		Name:          info.Name,
		Picture:       info.Picture,
		EmailVerified: info.EmailVerified == "true",
	}, nil
}
