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
	"talentro/internal/models"
	"talentro/internal/repository"
)

// GoogleVerifier отделён интерфейсом, чтобы тесты проверяли обязательность aud
// без сети: настоящий ходит в oauth2.googleapis.com, подставной — нет.
type GoogleVerifier interface {
	Verify(credential string) (*models.GoogleProfile, error)
}

type AuthHandler struct {
	verifier       GoogleVerifier
	store          *auth.Store
	repo           *repository.Repository
	googleClientID string
	testerToken    string
}

func NewAuthHandler(
	cfg *config.Config,
	repo *repository.Repository,
	store *auth.Store,
) *AuthHandler {
	return &AuthHandler{
		verifier:       &tokenInfoVerifier{clientID: cfg.GoogleClientID, client: &http.Client{Timeout: 8 * time.Second}},
		store:          store,
		repo:           repo,
		googleClientID: cfg.GoogleClientID,
		testerToken:    cfg.TesterToken,
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
		http.Error(w, "вход через Google не настроен: не задан GOOGLE_CLIENT_ID", http.StatusServiceUnavailable)
		return
	}

	profile, err := h.verifier.Verify(credential)
	if err != nil {
		http.Error(w, "токен Google не принят: "+err.Error(), http.StatusUnauthorized)
		return
	}
	if strings.TrimSpace(profile.Email) == "" {
		http.Error(w, "в токене нет адреса электронной почты", http.StatusUnauthorized)
		return
	}

	user, err := h.repo.UpsertGoogleUser(*profile)
	switch {
	case errors.Is(err, repository.ErrEmailTaken):
		http.Error(w, "этот адрес уже привязан к другому аккаунту", http.StatusConflict)
		return
	case err != nil:
		log.Println("UpsertGoogleUser: ", err)
		http.Error(w, "внутренняя ошибка сервера", http.StatusInternalServerError)
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

	h.issue(w, r, claims)
}

// TesterLogin выдаёт куку тестировщика по токену из env: разделы на моках
// (кабинет модератора, приём анкет, отзывы) должны видеть не все, но видеть
// кто-то должен — иначе их нельзя принять.
// POST /api/auth/tester  body: { "token": "..." }
func (h *AuthHandler) TesterLogin(w http.ResponseWriter, r *http.Request) {
	if h.testerToken == "" {
		http.Error(w, "вход для проверки отключён: не задан TESTER_TOKEN", http.StatusServiceUnavailable)
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
		http.Error(w, "неверный токен", http.StatusUnauthorized)
		return
	}

	h.issue(w, r, auth.Claims{
		Email:    "tester@localhost",
		Name:     "Тестировщик",
		Role:     models.RoleTester,
		Provider: "token",
		Tester:   true,
	})
}

// Me — состояние посетителя. Отсутствие куки отдаётся как 200 с
// authenticated: false: это не ошибка запроса, а обычный анонимный заход, и
// фронт не должен показывать ошибку на каждом первом рендере.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, err := h.store.ClaimsFromRequest(r)
	if err != nil {
		if !errors.Is(err, auth.ErrInvalid) {
			log.Println("ClaimsFromRequest: ", err)
		}
		writeJSON(w, MeView{})
		return
	}

	writeJSON(w, MeView{
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
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	h.store.Clear(w, auth.SecureRequest(r))
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) issue(w http.ResponseWriter, r *http.Request, claims auth.Claims) {
	if err := h.store.Set(w, claims, auth.SecureRequest(r)); err != nil {
		log.Println("Set session cookie: ", err)
		http.Error(w, "не удалось выдать сессию", http.StatusInternalServerError)
		return
	}
	writeJSON(w, MeView{
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
		http.Error(w, "credential обязателен", http.StatusBadRequest)
		return "", false
	}
	return credential, true
}

// decodeJSON объединяет проверку метода, лимит тела и ошибку разбора: куки
// выдаются POST-ом, и GET с подставным телом не должен ничего оформлять.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return false
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(dst); err != nil {
		http.Error(w, "некорректное тело запроса", http.StatusBadRequest)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Println("запись ответа: ", err)
	}
}

// tokenInfoVerifier сверяет подпись и срок действия токена на стороне Google и
// проверяет, что токен выпущен именно для нашего клиента.
type tokenInfoVerifier struct {
	clientID string
	client   *http.Client
}

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
	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(credential)

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
