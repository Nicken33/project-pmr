package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/crypto/argon2"

	"talentro/internal/auth"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// Локальный вход по почте и паролю: §3.7.1 (уникальная почта, подтверждения не
// нужно), §3.7.2 (тип аккаунта выбирает сервер), §12.1 (argon2id, почта и токен
// в лог не пишутся), §12.2 (10 входов в минуту и 3 регистрации в час на IP,
// ответ 429).
//
// Postgres ради этих проверок не поднимается: LocalUserStore (auth_local.go) —
// ровно тот шов, который оставляет репозиторий, поэтому fake ниже повторяет
// семантику internal/repository/users.go, а не выдумывает её.
const (
	localSecret   = "тестовый-секрет-локального-входа"
	localPassword = "пароль для теста" // длиннее auth.PasswordMinLen
	localEmail    = "ivan@example.com"
	localName     = "Иван"
	decoySecret   = "заглушка никто не введёт"
	sessionMaxAge = 30 * 24 * 3600 // §3.7: кука живёт 30 суток, как ttl в session.go
)

// var_ — проверка, что фейк действительно закрывает шов, а не «почти совпадает».
var (
	_ LocalUserStore = (*fakeLocalUsers)(nil)
)

// cheapHash — PHC-строка argon2id с малой стоимостью (m=64 KiB, t=1, p=1).
// VerifyPassword берёт параметры из строки, поэтому фейковая база с такими
// хэшами проверяется так же, как настоящая, но прогон не считает 64 MiB на
// каждую из десятков сверок (§12.1).
func cheapHash(t *testing.T, password, salt string) string {
	t.Helper()
	dk := argon2.IDKey([]byte(password), []byte(salt), 1, 64, 1, 32)
	return "$argon2id$v=19$m=64,t=1,p=1$" +
		base64.RawStdEncoding.EncodeToString([]byte(salt)) + "$" +
		base64.RawStdEncoding.EncodeToString(dk)
}

type localRow struct {
	user models.User
	hash string
}

// fakeLocalUsers — хранилище email → {строка users, хэш пароля}.
type fakeLocalUsers struct {
	mu     sync.Mutex
	rows   map[string]localRow
	nextID int64
}

func newFakeLocalUsers() *fakeLocalUsers {
	return &fakeLocalUsers{rows: map[string]localRow{}, nextID: 1}
}

// seed добавляет строку «как её выдал бы репозиторий»: провайдер и роль — те,
// что стоят в INSERT (users.go), хэш — готовая PHC-строка (” означает NULL,
// то есть аккаунт без пароля, §3.7.4).
func (f *fakeLocalUsers) seed(email, name, hash, provider, role string, id int64) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if id == 0 {
		id = f.nextID
		f.nextID++
	}
	f.rows[email] = localRow{
		user: models.User{ID: id, Email: email, Name: name, Provider: provider, Role: role},
		hash: hash,
	}
	if id >= f.nextID {
		f.nextID = id + 1
	}
}

// saltFor — детерминированная соль по почте: один и тот же пароль у двух
// пользователей даёт разные хэши, как в бою (случайная соль из HashPassword).
func saltFor(email string) string { return "salt-" + email }

func (f *fakeLocalUsers) seedLocal(t *testing.T, email, name, password string) {
	t.Helper()

	// Хэш считается до блокировки: cheapHash умеет t.Fatalf, а та вызывает
	// runtime.Goexit — с захваченным мьютексом прогон бы завис, а не упал.
	hash := cheapHash(t, password, saltFor(email))

	f.mu.Lock()
	defer f.mu.Unlock()
	f.rows[email] = localRow{
		user: models.User{ID: f.nextID, Email: email, Name: name, Provider: "local", Role: "user"},
		hash: hash,
	}
	f.nextID++
}

// PasswordByEmail — копия контракта репозитория: нет строки → ErrNoUser,
// второй результат пустой при password_hash IS NULL.
func (f *fakeLocalUsers) PasswordByEmail(email string) (models.User, string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	row, ok := f.rows[email]
	if !ok {
		return models.User{}, "", repository.ErrNoUser
	}
	return row.user, row.hash, nil
}

// InsertLocalUser — копия INSERT из users.go: account_type='user' и
// provider='local' проставляет сервер (§3.7.2), дубль почты даёт ErrEmailTaken
// по уникальному индексу, а не по предварительному SELECT.
func (f *fakeLocalUsers) InsertLocalUser(email, name, passwordHash string) (models.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, ok := f.rows[email]; ok {
		return models.User{}, repository.ErrEmailTaken
	}
	u := models.User{ID: f.nextID, Email: email, Name: name, Provider: "local", Role: "user"}
	f.nextID++
	f.rows[email] = localRow{user: u, hash: passwordHash}
	return u, nil
}

func (f *fakeLocalUsers) hashOf(email string) (string, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	row, ok := f.rows[email]
	return row.hash, ok
}

func (f *fakeLocalUsers) rowCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.rows)
}

// localHarness — хендлер с тестовыми лимитерами из тех же констант, что и
// боевой NewAuthHandler: §12.2 проверяется на реальных 10/мин и 3/час.
type localHarness struct {
	handler *AuthHandler
	store   *auth.Store
	users   *fakeLocalUsers
}

func newLocalHarness(t *testing.T) *localHarness {
	t.Helper()

	store, err := auth.NewStore(localSecret)
	if err != nil {
		t.Fatalf("auth.NewStore: %v", err)
	}
	users := newFakeLocalUsers()
	users.seed(localEmail, localName, cheapHash(t, localPassword, "salt-ivan"), "local", "user", 7)
	// Гугловский аккаунт без пароля: password_hash IS NULL → пустая строка.
	users.seed("gosha@gmail.com", "Госша", "", "google", "user", 8)

	return &localHarness{
		handler: &AuthHandler{
			store:         store,
			local:         users,
			loginLimit:    auth.NewLimiter(loginAttempts, time.Minute),
			registerLimit: auth.NewLimiter(registerAttempts, time.Hour),
			// Заглушка для «такой почты нет»: в бою это тяжёлый хэш, тут —
			// такой же по форме, чтобы прогон не считал 64 MiB на каждый 401.
			loginDecoy: cheapHash(t, decoySecret, "salt-decoy"),
		},
		store: store,
		users: users,
	}
}

// postJSON шлёт тело как есть: тесты битого JSON должны видеть именно 400, а не
// «неверная почта или пароль».
func postJSON(t *testing.T, body string, remoteAddr string) *http.Request {
	t.Helper()

	r := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if remoteAddr != "" {
		r.RemoteAddr = remoteAddr
	}
	return r
}

func bodyJSON(t *testing.T, v any) string {
	t.Helper()

	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal тела: %v", err)
	}
	return string(raw)
}

type errorEnvelope struct {
	Error struct {
		Code    int               `json:"code"`
		Message string            `json:"message"`
		Fields  map[string]string `json:"fields"`
	} `json:"error"`
}

func decodeEnvelope(t *testing.T, rec *httptest.ResponseRecorder) errorEnvelope {
	t.Helper()

	var e errorEnvelope
	if err := json.Unmarshal(rec.Body.Bytes(), &e); err != nil {
		t.Fatalf("ответ не разбирается как конверт §9: %v (%q)", err, rec.Body.String())
	}
	return e
}

func decodeMeView(t *testing.T, rec *httptest.ResponseRecorder) MeView {
	t.Helper()

	var v MeView
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("ответ не разбирается как MeView: %v (%q)", err, rec.Body.String())
	}
	return v
}

// assertSessionCookie сверяет куку с session.go: одно значение, Path=/,
// HttpOnly, SameSite=Lax и Max-Age = ttl (30 суток).
func assertSessionCookie(t *testing.T, rec *httptest.ResponseRecorder, wantSecure bool) *http.Cookie {
	t.Helper()

	setCookies := rec.Header().Values("Set-Cookie")
	if len(setCookies) != 1 {
		t.Fatalf("Set-Cookie должен быть ровно один, получили %d: %q", len(setCookies), setCookies)
	}

	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("в ответе одна кука, получили %d", len(cookies))
	}
	c := cookies[0]
	if c.Name != auth.CookieName {
		t.Errorf("имя куки = %q, ждали %q", c.Name, auth.CookieName)
	}
	if c.Path != "/" {
		t.Errorf("Path = %q, ждали /", c.Path)
	}
	if !c.HttpOnly {
		t.Error("HttpOnly снят: куку прочитает JavaScript на странице")
	}
	if c.SameSite != http.SameSiteLaxMode {
		t.Errorf("SameSite = %v, ждали Lax", c.SameSite)
	}
	if c.MaxAge != sessionMaxAge {
		t.Errorf("Max-Age = %d, ждали %d (30 суток, как ttl в session.go)", c.MaxAge, sessionMaxAge)
	}
	if c.Secure != wantSecure {
		t.Errorf("Secure = %v, ждали %v", c.Secure, wantSecure)
	}
	if c.Value == "" {
		t.Fatal("кука пустая: сессия не выдана")
	}

	raw := setCookies[0]
	for _, attr := range []string{"Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=2592000"} {
		if !strings.Contains(raw, attr) {
			t.Errorf("в Set-Cookie нет %q: %q", attr, raw)
		}
	}
	if strings.Contains(raw, "; Secure") != wantSecure {
		t.Errorf("атрибут Secure в Set-Cookie не совпал с ожиданием %v: %q", wantSecure, raw)
	}
	return c
}

func loginBody(t *testing.T, email, password string) string {
	t.Helper()

	return bodyJSON(t, map[string]any{"email": email, "password": password})
}

// structJSON — тела запросов собираются картой: порядок полей не важен, а
// «лишние» поля из клиента (§3.7.2) надо уметь добавить.
func structJSON(t *testing.T, fields map[string]any) string {
	t.Helper()

	return bodyJSON(t, fields)
}

// doLogin шлёт готовое тело в Login и возвращает запись ответа. remoteAddr —
// адрес, с которого пришёл запрос (лимит §12.2 считается по нему).
func doLogin(t *testing.T, h *AuthHandler, body, remoteAddr string) *httptest.ResponseRecorder {
	t.Helper()

	rec := httptest.NewRecorder()
	h.Login(rec, postJSON(t, body, remoteAddr))
	return rec
}

func doRegister(t *testing.T, h *AuthHandler, body, remoteAddr string) *httptest.ResponseRecorder {
	t.Helper()

	r := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	if remoteAddr != "" {
		r.RemoteAddr = remoteAddr
	}
	rec := httptest.NewRecorder()
	h.Register(rec, r)
	return rec
}

// --- тесты ---------------------------------------------------------------

// Успешный вход: 200, то же тело, что у /me, и кука ровно та, что выдаёт
// тестировщик или Google (§3.7). Проверяется и обратное — кука читается Store
// и даёт claims вошедшего, а не «примерно похожие».
func TestLoginSuccessIssuesSessionCookie(t *testing.T) {
	h := newLocalHarness(t)

	rec := doLogin(t, h.handler, loginBody(t, localEmail, localPassword), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("код = %d, ждали 200: %s", rec.Code, rec.Body.String())
	}

	view := decodeMeView(t, rec)
	if !view.Authenticated || view.Tester || view.Role != "user" || view.Name != localName {
		t.Errorf("тело ответа = %+v, ждали вошедшего пользователя без тестовой метки", view)
	}
	if view.Email != localEmail || view.Provider != "local" {
		t.Errorf("почта/провайдер = %q/%q, ждали %q/local", view.Email, view.Provider, localEmail)
	}

	cookie := assertSessionCookie(t, rec, false)
	claims, err := h.store.Decode(cookie.Value)
	if err != nil {
		t.Fatalf("выданная кука не читается: %v", err)
	}
	if claims.Email != localEmail || claims.Role != "user" || claims.Provider != "local" {
		t.Errorf("claims = %+v, ждали локального пользователя", claims)
	}
	if claims.Tester {
		t.Errorf("локальный вход выдал тестовую роль: %+v", claims)
	}
}

// §3.7.1: почта вводится в любом регистре и с пробелами по краям, а строка в
// базе одна (почта уникальна). Вход должен находить её по нормализованному
// адресу — иначе человек с «Ivan@Example.com» получит 401 на верный пароль.
func TestLoginNormalizesEmail(t *testing.T) {
	h := newLocalHarness(t)

	rec := doLogin(t, h.handler, loginBody(t, "  IVAN@Example.COM  ", localPassword), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("код = %d, ждали 200: %s", rec.Code, rec.Body.String())
	}
}

// 401 одинаковым текстом для «нет такой почты» и «не тот пароль» (§3.7.1.3).
// Проверка не косметическая: статус, тело и заголовки должны совпасть байт в
// байт, иначе различие читается автоматикой, а не человеком.
func TestLoginFailureIsIdenticalForUnknownEmailAndBadPassword(t *testing.T) {
	h := newLocalHarness(t)

	wrongPassword := doLogin(t, h.handler, loginBody(t, localEmail, "секрет не тот"), "")
	unknownEmail := doLogin(t, h.handler, loginBody(t, "nikto@example.com", localPassword), "")

	for _, tc := range []struct {
		name string
		rec  *httptest.ResponseRecorder
	}{
		{"неверный пароль", wrongPassword},
		{"нет такой почты", unknownEmail},
	} {
		if tc.rec.Code != http.StatusUnauthorized {
			t.Errorf("%s: код = %d, ждали 401: %s", tc.name, tc.rec.Code, tc.rec.Body.String())
		}
		env := decodeEnvelope(t, tc.rec)
		if env.Error.Code != http.StatusUnauthorized || env.Error.Message != badCredentials {
			t.Errorf("%s: конверт = %+v, ждали 401 %q", tc.name, env.Error, badCredentials)
		}
		if len(env.Error.Fields) != 0 {
			t.Errorf("%s: поля = %v, на 401 их быть не должно", tc.name, env.Error.Fields)
		}
		if ct := tc.rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
			t.Errorf("%s: Content-Type = %q", tc.name, ct)
		}
	}

	if wrongPassword.Body.String() != unknownEmail.Body.String() {
		t.Errorf("тексты 401 различаются: %q против %q", wrongPassword.Body.String(), unknownEmail.Body.String())
	}
	for _, rec := range []*httptest.ResponseRecorder{wrongPassword, unknownEmail} {
		if len(rec.Header().Values("Set-Cookie")) != 0 {
			t.Errorf("на 401 кука выставлена: %q", rec.Header().Values("Set-Cookie"))
		}
	}
}

// §3.7.4: аккаунт, заведённый входом через сервис, пароля в базе не имеет
// (password_hash IS NULL). Он отвечает тем же 401, что и неверный пароль:
// «этот аккаунт живёт только в Google» — тоже утечка существования почты.
func TestLoginAccountWithoutPasswordIsUnauthorized(t *testing.T) {
	h := newLocalHarness(t)

	rec := doLogin(t, h.handler, loginBody(t, "gosha@gmail.com", localPassword), "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("код = %d, ждали 401: %s", rec.Code, rec.Body.String())
	}
	if msg := decodeEnvelope(t, rec).Error.Message; msg != badCredentials {
		t.Errorf("сообщение = %q, ждали %q", msg, badCredentials)
	}
}

// Битое или негодное тело — 400 (§9.8), а не 401: человек должен увидеть, что
// форма заполнена криво, а не «неверный пароль». Отдельно проверяется пустой
// пароль и пустая почта.
func TestLoginRejectsMalformedBody(t *testing.T) {
	h := newLocalHarness(t)

	for _, body := range []string{
		"{",
		`{"email": 1, "password": "пароль для теста"}`,
		`["не объект"]`,
	} {
		rec := doLogin(t, h.handler, body, "")
		if rec.Code != http.StatusBadRequest {
			t.Errorf("тело %q: код = %d, ждали 400: %s", body, rec.Code, rec.Body.String())
		}
		if msg := decodeEnvelope(t, rec).Error.Message; msg != "некорректное тело запроса" {
			t.Errorf("тело %q: сообщение = %q", body, msg)
		}
	}

	// Пустые поля — не «битое тело», а неверные данные: 401 тем же текстом.
	// Иначе «пустая почта» отличалась бы по статусу от «нет такой почты», и
	// различие снова стало бы признаком.
	for _, body := range []string{`{"email":"","password":""}`, loginBody(t, localEmail, "")} {
		rec := doLogin(t, h.handler, body, "")
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("тело %q: код = %d, ждали 401: %s", body, rec.Code, rec.Body.String())
		}
		if msg := decodeEnvelope(t, rec).Error.Message; msg != badCredentials {
			t.Errorf("тело %q: сообщение = %q, ждали %q", body, msg, badCredentials)
		}
	}
}

// Метод не POST — 405 из самого хендлера (§9.8): GET с подставным телом не
// должен ничего оформлять.
func TestLoginOnlyAcceptsPost(t *testing.T) {
	h := newLocalHarness(t)

	r := httptest.NewRequest(http.MethodGet, "/api/auth/login", nil)
	rec := httptest.NewRecorder()
	h.handler.Login(rec, r)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("код = %d, ждали 405: %s", rec.Code, rec.Body.String())
	}
	if msg := decodeEnvelope(t, rec).Error.Message; msg != "method not allowed" {
		t.Errorf("сообщение = %q", msg)
	}
}

// §12.2: 10 попыток в минуту на адрес, одиннадцатая — 429. Счёт идёт по
// реальным константам боевого хендлера, а не по уменьшенной копии, иначе
// проверка расходилась бы с тем, что стоит на стенде.
func TestLoginRateLimitPerIP(t *testing.T) {
	h := newLocalHarness(t)
	const ip = "203.0.113.7:41234"

	for i := 1; i <= loginAttempts; i++ {
		rec := doLogin(t, h.handler, loginBody(t, localEmail, "не тот пароль"), ip)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("попытка %d: код = %d, ждали 401: %s", i, rec.Code, rec.Body.String())
		}
	}

	limited := doLogin(t, h.handler, loginBody(t, localEmail, localPassword), ip)
	if limited.Code != http.StatusTooManyRequests {
		t.Fatalf("попытка %d: код = %d, ждали 429: %s", loginAttempts+1, limited.Code, limited.Body.String())
	}
	if msg := decodeEnvelope(t, limited).Error.Message; !strings.Contains(msg, "вход") {
		t.Errorf("429 не называет действие: %q", msg)
	}
	retryAfter := limited.Header().Get("Retry-After")
	seconds, err := strconv.Atoi(retryAfter)
	if err != nil || seconds <= 0 || seconds > 60 {
		t.Errorf("Retry-After = %q, ждали целое 1..60", retryAfter)
	}

	// Другой адрес лимита не касается: счётчик по IP, а не глобальный.
	other := doLogin(t, h.handler, loginBody(t, localEmail, localPassword), "198.51.100.4:5210")
	if other.Code != http.StatusOK {
		t.Errorf("другой IP заблокирован тем же лимитом: код = %d", other.Code)
	}
}

// 400 не расходует квоту (§12.2 — лимит на попытки входа, а не на запросы):
// опечатка в форме не должна лишать человека возможности войти.
func TestMalformedRequestsDoNotConsumeLoginQuota(t *testing.T) {
	h := newLocalHarness(t)
	const ip = "203.0.113.8:40000"

	for i := 0; i < loginAttempts; i++ {
		if rec := doLogin(t, h.handler, "{", ip); rec.Code != http.StatusBadRequest {
			t.Fatalf("битое тело %d: код = %d", i+1, rec.Code)
		}
	}
	if rec := doLogin(t, h.handler, loginBody(t, localEmail, localPassword), ip); rec.Code != http.StatusOK {
		t.Fatalf("после 10 битых тел вход не удался: код = %d, %s", rec.Code, rec.Body.String())
	}
}

// Регистрация: 201, аккаунт ordinary (`account_type=user`, §3.7.2) и кука в
// том же ответе — входить второй раз не нужно.
func TestRegisterCreatesUserAndIssuesCookie(t *testing.T) {
	h := newLocalHarness(t)
	const email = "Petya@Example.com"

	rec := doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": email, "password": localPassword, "name": "Пётр",
	}), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("код = %d, ждали 201: %s", rec.Code, rec.Body.String())
	}

	view := decodeMeView(t, rec)
	if !view.Authenticated || view.Role != "user" || view.Tester {
		t.Errorf("тело = %+v, ждали обычного пользователя", view)
	}
	if view.Email != strings.ToLower(email) {
		t.Errorf("почта = %q, ждали нормализованную %q", view.Email, strings.ToLower(email))
	}
	if view.Name != "Пётр" || view.Provider != "local" {
		t.Errorf("имя/провайдер = %q/%q", view.Name, view.Provider)
	}

	cookie := assertSessionCookie(t, rec, false)
	claims, err := h.store.Decode(cookie.Value)
	if err != nil {
		t.Fatalf("кука регистрации не читается: %v", err)
	}
	if claims.Role != "user" || claims.Tester {
		t.Errorf("claims = %+v, ждали роль user без тестовой метки", claims)
	}

	// Тот же пароль, та же почта: регистрация не должна оставлять в базе
	// что-то, кроме одной строки с хэшем argon2id.
	stored, ok := h.users.hashOf(strings.ToLower(email))
	if !ok {
		t.Fatal("пользователь не записан")
	}
	if !strings.HasPrefix(stored, "$argon2id$") {
		t.Errorf("в базе не argon2id: %q", stored)
	}
	if strings.Contains(stored, localPassword) {
		t.Error("пароль попал в хэш открытым текстом")
	}
	if h.users.rowCount() != 3 {
		t.Errorf("строк в фейке = %d, ждали 3 (две посеяны + одна создана)", h.users.rowCount())
	}
}

// Тот же пароль входит сразу после регистрации — хэш из InsertLocalUser
// действительно проверяется VerifyPassword, а не «похож на правильный».
func TestRegisterThenLogin(t *testing.T) {
	h := newLocalHarness(t)

	if rec := doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": "masha@example.com", "password": localPassword, "name": "Маша",
	}), ""); rec.Code != http.StatusCreated {
		t.Fatalf("регистрация: код = %d, %s", rec.Code, rec.Body.String())
	}
	rec := doLogin(t, h.handler, loginBody(t, "masha@example.com", localPassword), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("вход сразу после регистрации: код = %d, %s", rec.Code, rec.Body.String())
	}
	if rec2 := doLogin(t, h.handler, loginBody(t, "masha@example.com", "не тот"), ""); rec2.Code != http.StatusUnauthorized {
		t.Fatalf("вход с неверным паролем: код = %d", rec2.Code)
	}
}

// Дубль почты — 409 (§9.8) с подсказкой в полях, а не 500 от уникального
// индекса и не тихое «ок, вошли».
func TestRegisterDuplicateEmailConflicts(t *testing.T) {
	h := newLocalHarness(t)

	first := doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": localEmail, "password": localPassword, "name": localName,
	}), "")
	if first.Code != http.StatusConflict {
		t.Fatalf("код = %d, ждали 409: %s", first.Code, first.Body.String())
	}
	env := decodeEnvelope(t, first)
	if env.Error.Code != http.StatusConflict {
		t.Errorf("конверт code = %d, ждали 409", env.Error.Code)
	}
	if env.Error.Message != "аккаунт с такой почтой уже есть" {
		t.Errorf("сообщение = %q", env.Error.Message)
	}
	if hint := env.Error.Fields["email"]; !strings.Contains(hint, "войди") {
		t.Errorf("подсказка для поля email = %q, ждали «войди…»", hint)
	}
	if len(first.Header().Values("Set-Cookie")) != 0 {
		t.Error("на 409 кука выставлена — чужая почта оформила бы сессию")
	}
	// Повтор в другом регистре — тот же 409: нормализация одна на оба входа.
	other := doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": strings.ToUpper(localEmail), "password": localPassword, "name": localName,
	}), "")
	if other.Code != http.StatusConflict {
		t.Errorf("дубль в верхнем регистре: код = %d, ждали 409", other.Code)
	}
}

// Проверка формы (§3.7.1): почта валидной формы, пароль не короче 8 символов.
// Русское «из восьми букв» — восемь рун, хотя в UTF-8 таких байт больше:
// счёт по байтам отклонял бы пароль, который пользователь считал годным.
func TestRegisterFieldValidation(t *testing.T) {
	cases := []struct {
		name    string
		body    map[string]any
		wantKey string
	}{
		{"почта без собаки", map[string]any{"email": "ivan.example.com", "password": localPassword, "name": "Иван"}, "email"},
		{"почта без точки в домене", map[string]any{"email": "ivan@mail", "password": localPassword, "name": "Иван"}, "email"},
		{"пустая почта", map[string]any{"email": "", "password": localPassword, "name": "Иван"}, "email"},
		{"почта с пробелом внутри", map[string]any{"email": "ivan @example.com", "password": localPassword, "name": "Иван"}, "email"},
		{"пароль 7 символов", map[string]any{"email": "short@example.com", "password": "1234567", "name": "Иван"}, "password"},
		// Годные тела: отдельная почта на каждый случай, иначе второй упёрся
		// бы в 409 вместо 201 и проверка измеряла бы не то.
		{"пароль из русских букв годен", map[string]any{"email": "rune@example.com", "password": "восемьбукв", "name": "Иван"}, ""},
		{"имя с пробелами по краям годно", map[string]any{"email": "trim@example.com", "password": localPassword, "name": "  Иван  "}, ""},
		{"имя необязательно", map[string]any{"email": "noname@example.com", "password": localPassword}, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newLocalHarness(t)
			body, err := json.Marshal(tc.body)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			rec := doRegister(t, h.handler, string(body), "")

			if tc.wantKey == "" {
				if rec.Code != http.StatusCreated {
					t.Fatalf("код = %d, ждали 201: %s", rec.Code, rec.Body.String())
				}
				if tc.name == "имя необязательно" {
					if view := decodeMeView(t, rec); view.Name != "" || view.Role != "user" {
						t.Errorf("тело = %+v, ждали пустое имя и роль user", view)
					}
				}
				if tc.name == "имя с пробелами по краям годно" {
					if view := decodeMeView(t, rec); view.Name != "Иван" {
						t.Errorf("имя не обрезано: %q", view.Name)
					}
				}
				return
			}
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("код = %d, ждали 400: %s", rec.Code, rec.Body.String())
			}
			env := decodeEnvelope(t, rec)
			if _, ok := env.Error.Fields[tc.wantKey]; !ok {
				t.Errorf("fields = %v, ждали ключ %q", env.Error.Fields, tc.wantKey)
			}
		})
	}
}

// Длинное имя отсекается не «вежливо», а 400: в `users.name` VARCHAR(120), и
// вставка длиннее уперлась бы в ошибку базы, то есть в 500 на пустяковой форме.
func TestRegisterRejectsOverlongName(t *testing.T) {
	h := newLocalHarness(t)

	rec := doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": "long@example.com", "password": localPassword, "name": strings.Repeat("а", maxUserNameRunes+1),
	}), "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("код = %d, ждали 400: %s", rec.Code, rec.Body.String())
	}
	if _, ok := decodeEnvelope(t, rec).Error.Fields["name"]; !ok {
		t.Error("в fields нет ключа name")
	}
}

// Тип аккаунта из тела не читается (§3.7.2): как бы ни называлось поле в
// запросе, в базу идёт 'user', а в куке — role user без tester.
func TestRegisterIgnoresAccountTypeFromBody(t *testing.T) {
	h := newLocalHarness(t)

	rec := doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": "sneaky@example.com", "password": localPassword, "name": "Хитрец",
		"account_type": "moderator", "role": "moderator", "tester": true,
	}), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("код = %d, ждали 201: %s", rec.Code, rec.Body.String())
	}
	view := decodeMeView(t, rec)
	if view.Role != "user" || view.Tester {
		t.Errorf("тело = %+v, ждали роль user и tester false", view)
	}
	user, _, err := h.users.PasswordByEmail("sneaky@example.com")
	if err != nil {
		t.Fatalf("чтение созданного пользователя: %v", err)
	}
	if user.Role != "user" || user.Provider != "local" {
		t.Errorf("в базе роль/провайдер = %q/%q", user.Role, user.Provider)
	}
}

// §12.2: 3 регистрации в час на адрес, четвёртая — 429. Успешные и провалившие
// форму засчитываются по-разному: 400 квоту не ест, 409 — ест (это попытка
// оформить занятый адрес, а не опечатка).
func TestRegisterRateLimitPerIP(t *testing.T) {
	h := newLocalHarness(t)
	const ip = "203.0.113.9:33333"

	for i := 0; i < registerAttempts; i++ {
		rec := doRegister(t, h.handler, structJSON(t, map[string]any{
			"email": "p" + strconv.Itoa(i) + "@example.com", "password": localPassword, "name": "Иван",
		}), ip)
		if rec.Code != http.StatusCreated {
			t.Fatalf("регистрация %d: код = %d, %s", i+1, rec.Code, rec.Body.String())
		}
	}

	limited := doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": "later@example.com", "password": localPassword, "name": "Иван",
	}), ip)
	if limited.Code != http.StatusTooManyRequests {
		t.Fatalf("четвёртая регистрация: код = %d, %s", limited.Code, limited.Body.String())
	}
	if msg := decodeEnvelope(t, limited).Error.Message; !strings.Contains(msg, "регистрац") {
		t.Errorf("429 не называет регистрацию: %q", msg)
	}
	if seconds, err := strconv.Atoi(limited.Header().Get("Retry-After")); err != nil || seconds <= 0 {
		t.Errorf("Retry-After = %q, ждали положительное число секунд", limited.Header().Get("Retry-After"))
	}

	// Лимит входа независим от лимита регистрации: заблокированный по
	// регистрациям человек всё ещё может войти в существующий аккаунт.
	if rec := doLogin(t, h.handler, loginBody(t, localEmail, localPassword), ip); rec.Code != http.StatusOK {
		t.Errorf("вход после лимита регистраций: код = %d, ждали 200", rec.Code)
	}
}

// Кука на https: `Secure` добавляется по `X-Forwarded-Proto`, и только тогда.
// Тот же вход без заголовка обязан остаться без атрибута — на стенде api
// слушает http, и Secure означал бы «кука не уйдёт вообще».
func TestRegisterCookieSecureFollowsForwardedProto(t *testing.T) {
	h := newLocalHarness(t)

	r := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(structJSON(t, map[string]any{
		"email": "secure@example.com", "password": localPassword, "name": "Саша",
	})))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()
	h.handler.Register(rec, r)

	if rec.Code != http.StatusCreated {
		t.Fatalf("код = %d, ждали 201: %s", rec.Code, rec.Body.String())
	}
	assertSessionCookie(t, rec, true)
}

// §9.8: на регистрацию, как и на вход, действует только POST. GET с подставным
// телом не должен ни создать аккаунт, ни выставить куку — иначе ссылка с чужой
// страницы оформила бы посетителю учётную запись.
func TestRegisterOnlyAcceptsPost(t *testing.T) {
	h := newLocalHarness(t)
	body := structJSON(t, map[string]any{
		"email": "method@example.com", "password": localPassword, "name": "Метод",
	})

	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete, http.MethodHead, http.MethodPatch} {
		t.Run(method, func(t *testing.T) {
			r := httptest.NewRequest(method, "/api/auth/register", strings.NewReader(body))
			r.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			h.handler.Register(rec, r)

			if rec.Code != http.StatusMethodNotAllowed {
				t.Errorf("код = %d, ждали 405: %s", rec.Code, rec.Body.String())
			}
			if got := rec.Header().Values("Set-Cookie"); len(got) != 0 {
				t.Errorf("на 405 выставлена кука: %q", got)
			}
		})
	}

	if n := h.users.rowCount(); n != 2 {
		t.Errorf("строк в фейке = %d, ждали 2: не-POST создал аккаунт", n)
	}
}

// §12.1: в лог не уходят ни почта, ни пароль, ни значение куки-сессии. Проверка
// собирает вывод log в буфер: «не пишем» ломается одной строкой отладки, и без
// теста это замечают только на стенде, где логи читают люди.
func TestLocalAuthLogsLeakNothing(t *testing.T) {
	h := newLocalHarness(t)

	var buf bytes.Buffer
	restore := captureLog(t, &buf)
	defer restore()

	// Все ветки локального входа: успех, неверный пароль, неизвестная почта,
	// перебор с 429, регистрация, дубль почты.
	okRec := doLogin(t, h.handler, loginBody(t, localEmail, localPassword), "203.0.113.40:1")
	if okRec.Code != http.StatusOK {
		t.Fatalf("вход = %d, ждали 200", okRec.Code)
	}
	tokenValue := assertSessionCookie(t, okRec, false).Value

	doLogin(t, h.handler, loginBody(t, localEmail, "не тот пароль"), "203.0.113.41:1")
	doLogin(t, h.handler, loginBody(t, "net-takogo@example.com", localPassword), "203.0.113.42:1")
	doLogin(t, h.handler, loginBody(t, localEmail, "не тот пароль"), "203.0.113.43:1")
	for i := 0; i < loginAttempts+1; i++ {
		doLogin(t, h.handler, loginBody(t, localEmail, "не тот пароль"), "203.0.113.44:1")
	}
	doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": "logcheck@example.com", "password": localPassword, "name": "Логи",
	}), "203.0.113.45:1")
	doRegister(t, h.handler, structJSON(t, map[string]any{
		"email": localEmail, "password": localPassword, "name": localName,
	}), "203.0.113.46:1")

	logged := buf.String()
	for _, secret := range []string{
		localEmail, localName, localPassword, decoySecret,
		"net-takogo@example.com", "logcheck@example.com", tokenValue,
	} {
		if secret != "" && strings.Contains(logged, secret) {
			t.Errorf("в логе встречается %q:\n%s", secret, logged)
		}
	}
	if strings.Contains(logged, auth.CookieName) || strings.Contains(logged, "Set-Cookie") {
		t.Errorf("в логе упоминается кука сессии:\n%s", logged)
	}
}

// captureLog перехватывает стандартный логгер на время теста и возвращает
// функцию восстановления: проверять «не пишем» можно только слушая, что пишет
// процесс.
func captureLog(t *testing.T, w io.Writer) func() {
	t.Helper()

	previous := log.Writer()
	log.SetOutput(w)
	return func() { log.SetOutput(previous) }
}
