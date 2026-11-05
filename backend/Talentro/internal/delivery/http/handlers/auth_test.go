package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"talentro/internal/auth"
	"talentro/internal/config"
	"talentro/internal/models"
	"talentro/internal/repository"
)

type fakeVerifier struct {
	profile *models.GoogleProfile
	err     error
	calls   int
}

func (f *fakeVerifier) Verify(string) (*models.GoogleProfile, error) {
	f.calls++
	return f.profile, f.err
}

type fakeUsers struct {
	user models.User
	err  error
}

func (f *fakeUsers) UpsertGoogleUser(models.GoogleProfile) (models.User, error) {
	return f.user, f.err
}

func newTestAuthHandler(t *testing.T, cfg *config.Config, verifier GoogleVerifier, users UserStore) *AuthHandler {
	t.Helper()

	store, err := auth.NewStore("тестовый-секрет")
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}

	return &AuthHandler{
		verifier:       verifier,
		users:          users,
		store:          store,
		googleClientID: cfg.GoogleClientID,
		testerToken:    cfg.TesterToken,
	}
}

func decodeMe(t *testing.T, rec *httptest.ResponseRecorder) MeView {
	t.Helper()

	var view MeView
	if err := json.NewDecoder(rec.Body).Decode(&view); err != nil {
		t.Fatalf("разбор ответа: %v", err)
	}
	return view
}

func sessionCookie(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == auth.CookieName {
			return cookie
		}
	}
	return nil
}

// Google-вход не должен открываться «на любой токен», поэтому и при пустом
// GOOGLE_CLIENT_ID он закрывается, а не пропускает проверку aud.
func TestGoogleLoginRefusesWithoutClientID(t *testing.T) {
	verifier := &fakeVerifier{}
	h := newTestAuthHandler(t, &config.Config{}, verifier, &fakeUsers{})

	req := httptest.NewRequest(http.MethodPost, "/api/auth/google",
		strings.NewReader(`{"credential":"что-угодно"}`))
	resp := httptest.NewRecorder()
	h.GoogleLogin(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Errorf("код = %d, ожидалось %d", resp.Code, http.StatusServiceUnavailable)
	}
	if verifier.calls != 0 {
		t.Errorf("верификатор вызван %d раз(а), ожидалось 0", verifier.calls)
	}
}

func TestGoogleLoginIssuesSessionCookie(t *testing.T) {
	tests := []struct {
		name         string
		user         models.User
		repoErr      error
		wantCode     int
		wantTester   bool
		wantProvider string
	}{
		{
			name:         "обычный пользователь",
			user:         models.User{ID: 42, Email: "parent@example.test", Name: "Родитель", Role: "user", Provider: "google"},
			wantCode:     http.StatusOK,
			wantTester:   false,
			wantProvider: "google",
		},
		{
			name:         "роль tester из базы",
			user:         models.User{ID: 7, Email: "qa@example.test", Name: "Проверяющий", Role: models.RoleTester, Provider: "google"},
			wantCode:     http.StatusOK,
			wantTester:   true,
			wantProvider: "google",
		},
		{
			name:     "email уже занят",
			repoErr:  repository.ErrEmailTaken,
			wantCode: http.StatusConflict,
		},
		{
			name:     "база недоступна",
			repoErr:  errors.New("pq: соединение разорвано"),
			wantCode: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newTestAuthHandler(t,
				&config.Config{GoogleClientID: "clients-id"},
				&fakeVerifier{profile: &models.GoogleProfile{Sub: "sub-1", Email: "parent@example.test", Name: "Родитель"}},
				&fakeUsers{user: tt.user, err: tt.repoErr},
			)

			req := httptest.NewRequest(http.MethodPost, "/api/auth/google",
				strings.NewReader(`{"credential":"eyJhbGciOi..."}`))
			resp := httptest.NewRecorder()
			h.GoogleLogin(resp, req)

			if resp.Code != tt.wantCode {
				t.Fatalf("код = %d, ожидалось %d (тело: %s)", resp.Code, tt.wantCode, resp.Body.String())
			}
			if tt.wantCode != http.StatusOK {
				return
			}

			cookie := sessionCookie(resp)
			if cookie == nil || cookie.Value == "" {
				t.Fatalf("кука сессии не выставлена: %+v", resp.Result().Cookies())
			}
			if !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode {
				t.Errorf("кука без защиты: HttpOnly=%v SameSite=%v", cookie.HttpOnly, cookie.SameSite)
			}

			claims, err := h.store.Decode(cookie.Value)
			if err != nil {
				t.Fatalf("выданная кука не читается: %v", err)
			}
			if claims.Tester != tt.wantTester || claims.Provider != tt.wantProvider {
				t.Errorf("claims = %+v, ожидалось tester=%v provider=%s", claims, tt.wantTester, tt.wantProvider)
			}

			if view := decodeMe(t, resp); view.Name == "" {
				t.Error("ответ входа без имени")
			}
		})
	}
}

// Токен без адреса нельзя ни сохранить, ни показать в кабинете.
func TestGoogleLoginRejectsTokenWithoutEmail(t *testing.T) {
	h := newTestAuthHandler(t,
		&config.Config{GoogleClientID: "clients-id"},
		&fakeVerifier{profile: &models.GoogleProfile{Sub: "sub-1"}},
		&fakeUsers{},
	)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(`{"credential":"x"}`))
	resp := httptest.NewRecorder()
	h.GoogleLogin(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Errorf("код = %d, ожидалось %d", resp.Code, http.StatusUnauthorized)
	}
}

func TestGoogleLoginPassesVerifierError(t *testing.T) {
	h := newTestAuthHandler(t,
		&config.Config{GoogleClientID: "clients-id"},
		&fakeVerifier{err: errors.New("токен выпущен для другого клиента (чужой-id)")},
		&fakeUsers{},
	)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(`{"credential":"x"}`))
	resp := httptest.NewRecorder()
	h.GoogleLogin(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Errorf("код = %d, ожидалось %d", resp.Code, http.StatusUnauthorized)
	}
	if strings.Contains(resp.Body.String(), "clients-id") {
		t.Error("в ответ наружу утёк настроенный client ID")
	}
}

func TestGoogleLoginBadBody(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{"пустое тело", ""},
		{"не JSON", "{not json"},
		{"пустой credential", `{"credential":"   "}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newTestAuthHandler(t, &config.Config{GoogleClientID: "id"}, &fakeVerifier{}, &fakeUsers{})

			req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(tt.body))
			resp := httptest.NewRecorder()
			h.GoogleLogin(resp, req)

			if resp.Code != http.StatusBadRequest {
				t.Errorf("код = %d, ожидалось %d", resp.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestTesterLogin(t *testing.T) {
	tests := []struct {
		name         string
		configured   string
		sent         string
		wantCode     int
		wantTester   bool
		wantRole     string
		wantProvider string
	}{
		{name: "верный токен", configured: "секретный-токен", sent: `"секретный-токен"`, wantCode: http.StatusOK, wantTester: true, wantRole: models.RoleTester, wantProvider: "token"},
		{name: "верный токен с пробелами", configured: "секретный-токен", sent: `"  секретный-токен  "`, wantCode: http.StatusOK, wantTester: true, wantRole: models.RoleTester, wantProvider: "token"},
		{name: "неверный токен", configured: "секретный-токен", sent: `"подобранный"`, wantCode: http.StatusUnauthorized},
		{name: "пустой токен", configured: "секретный-токен", sent: `""`, wantCode: http.StatusUnauthorized},
		{name: "вход отключён", configured: "", sent: `"что-угодно"`, wantCode: http.StatusServiceUnavailable},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newTestAuthHandler(t, &config.Config{TesterToken: tt.configured}, &fakeVerifier{}, &fakeUsers{})

			req := httptest.NewRequest(http.MethodPost, "/api/auth/tester",
				strings.NewReader(`{"token":`+tt.sent+`}`))
			resp := httptest.NewRecorder()
			h.TesterLogin(resp, req)

			if resp.Code != tt.wantCode {
				t.Fatalf("код = %d, ожидалось %d (тело: %s)", resp.Code, tt.wantCode, resp.Body.String())
			}
			if tt.wantCode != http.StatusOK {
				return
			}

			cookie := sessionCookie(resp)
			if cookie == nil || cookie.Value == "" {
				t.Fatal("кука тестера не выставлена")
			}
			claims, err := h.store.Decode(cookie.Value)
			if err != nil {
				t.Fatalf("кука тестера не читается: %v", err)
			}
			if !claims.Tester || claims.Role != tt.wantRole || claims.Provider != tt.wantProvider {
				t.Errorf("claims = %+v", claims)
			}
		})
	}
}

// Аноним — не ошибка: фронт должен получать 200 и authenticated: false.
func TestMeStates(t *testing.T) {
	h := newTestAuthHandler(t, &config.Config{TesterToken: "т"}, &fakeVerifier{}, &fakeUsers{})

	tests := []struct {
		name        string
		cookieValue string
		wantAuth    bool
		wantTester  bool
		withCookie  bool
	}{
		{name: "без куки", wantAuth: false},
		{name: "чужое имя куки", cookieValue: "не-то", wantAuth: false},
		{name: "битая подпись", cookieValue: "bm9uc2Vuc2U.bm90bWFj", wantAuth: false},
		{name: "кука тестера", withCookie: true, wantAuth: true, wantTester: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
			switch {
			case tt.withCookie:
				value, err := h.store.Encode(auth.Claims{
					Email:    "qa@example.test",
					Name:     "Проверяющий",
					Role:     models.RoleTester,
					Provider: "token",
					Tester:   true,
					Exp:      time.Now().Add(time.Hour).Unix(),
				})
				if err != nil {
					t.Fatalf("Encode: %v", err)
				}
				req.AddCookie(&http.Cookie{Name: auth.CookieName, Value: value})
			case tt.cookieValue != "":
				req.Header.Set("Cookie", "other_cookie="+tt.cookieValue)
			}

			resp := httptest.NewRecorder()
			h.Me(resp, req)

			if resp.Code != http.StatusOK {
				t.Fatalf("код = %d, ожидалось 200", resp.Code)
			}
			view := decodeMe(t, resp)
			if view.Authenticated != tt.wantAuth || view.Tester != tt.wantTester {
				t.Errorf("ответ = %+v, ожидалось authenticated=%v tester=%v", view, tt.wantAuth, tt.wantTester)
			}
		})
	}
}

func TestLogoutClearsSessionCookie(t *testing.T) {
	h := newTestAuthHandler(t, &config.Config{}, &fakeVerifier{}, &fakeUsers{})

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	resp := httptest.NewRecorder()
	h.Logout(resp, req)

	if resp.Code != http.StatusNoContent {
		t.Errorf("код = %d, ожидалось 204", resp.Code)
	}
	cookie := sessionCookie(resp)
	if cookie == nil || cookie.MaxAge >= 0 || cookie.Value != "" {
		t.Errorf("кука не погашена: %+v", cookie)
	}
}

// Кука должна становиться Secure только за https-прокси — иначе на локальном
// стенде она вообще не ставится.
func TestSessionCookieSecureFollowsForwardedProto(t *testing.T) {
	h := newTestAuthHandler(t, &config.Config{TesterToken: "т"}, &fakeVerifier{}, &fakeUsers{})

	tests := []struct {
		proto        string
		wantSecureOn bool
	}{
		{"", false},
		{"http", false},
		{"https", true},
		{"HTTPS", true},
	}

	for _, tt := range tests {
		t.Run("X-Forwarded-Proto="+tt.proto, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/auth/tester", strings.NewReader(`{"token":"т"}`))
			if tt.proto != "" {
				req.Header.Set("X-Forwarded-Proto", tt.proto)
			}
			resp := httptest.NewRecorder()
			h.TesterLogin(resp, req)

			cookie := sessionCookie(resp)
			if cookie == nil {
				t.Fatal("кука не выставлена")
			}
			if cookie.Secure != tt.wantSecureOn {
				t.Errorf("Secure = %v, ожидалось %v", cookie.Secure, tt.wantSecureOn)
			}
		})
	}
}

func TestAuthEndpointsRefuseWrongMethod(t *testing.T) {
	h := newTestAuthHandler(t, &config.Config{TesterToken: "т", GoogleClientID: "id"}, &fakeVerifier{}, &fakeUsers{})

	tests := []struct {
		name    string
		method  string
		path    string
		handler http.HandlerFunc
	}{
		{"google принимает только POST", http.MethodGet, "/api/auth/google", h.GoogleLogin},
		{"tester принимает только POST", http.MethodGet, "/api/auth/tester", h.TesterLogin},
		{"logout принимает только POST", http.MethodGet, "/api/auth/logout", h.Logout},
		{"me принимает только GET", http.MethodPost, "/api/auth/me", h.Me},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			resp := httptest.NewRecorder()
			tt.handler(resp, req)

			if resp.Code != http.StatusMethodNotAllowed {
				t.Errorf("код = %d, ожидалось 405 (тело: %s)", resp.Code, resp.Body.String())
			}
		})
	}
}

// Тело запроса читается с лимитом: credential приходит из Google и короткий,
// а раздутое тело не должно утаскивать сервер в память.
func TestBodySizeLimit(t *testing.T) {
	h := newTestAuthHandler(t, &config.Config{GoogleClientID: "id"}, &fakeVerifier{}, &fakeUsers{})

	huge := `{"credential":"` + strings.Repeat("a", 400<<10) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", strings.NewReader(huge))
	resp := httptest.NewRecorder()
	h.GoogleLogin(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Errorf("код = %d, ожидалось 400 (тело обрезано на лимите)", resp.Code)
	}
}
