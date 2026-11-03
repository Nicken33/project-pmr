package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/argon2"

	"talentro/internal/models"
	"talentro/internal/repository"
)

const (
	argonTime    uint32 = 3
	argonMemory  uint32 = 64 * 1024
	argonThreads uint8  = 4
	argonKeyLen  uint32 = 32
)

type AuthHandler struct {
	repo    *repository.Repository
	secret  []byte
	limiter *rateLimiter
}

func NewAuthHandler(repo *repository.Repository, secret string) *AuthHandler {
	return &AuthHandler{repo: repo, secret: []byte(secret), limiter: newRateLimiter()}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if !h.limiter.allow("register:"+clientIP(r), 3, time.Hour) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много попыток регистрации")
		return
	}
	var input models.CreateUser
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}
	input.Email = normalizeEmail(input.Email)
	input.Name = strings.TrimSpace(input.Name)
	if err := validateEmail(input.Email); err != nil || len(input.Name) == 0 || len(input.Name) > 120 || len(input.Password) < 8 || len(input.Password) > 256 {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "укажи корректную почту, имя и пароль длиной от 8 до 256 символов")
		return
	}
	if input.AccountType == "" {
		input.AccountType = "user"
	}
	if input.AccountType != "user" && input.AccountType != "section_owner" && input.AccountType != "service_owner" {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "недопустимый тип аккаунта")
		return
	}
	passwordHash, err := hashPassword(input.Password)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось создать аккаунт")
		return
	}
	user, err := h.repo.CreateUser(input, passwordHash)
	if errors.Is(err, repository.ErrEmailTaken) {
		writeAPIError(w, http.StatusConflict, "email_taken", "аккаунт с такой почтой уже существует")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось создать аккаунт")
		return
	}
	token, err := h.issueToken(user)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось выполнить вход")
		return
	}
	writeJSON(w, models.AuthToken{Token: token, User: user})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if !h.limiter.allow("login:"+clientIP(r), 10, time.Minute) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много попыток входа")
		return
	}
	var input models.AuthCredentials
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}
	user, err := h.repo.GetUserByEmail(normalizeEmail(input.Email))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && !verifyPassword(input.Password, user.PasswordHash)) {
		writeAPIError(w, http.StatusUnauthorized, "invalid_credentials", "неверная почта или пароль")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось выполнить вход")
		return
	}
	token, err := h.issueToken(user)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось выполнить вход")
		return
	}
	writeJSON(w, models.AuthToken{Token: token, User: user})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, _ := currentIdentity(r)
	user, err := h.repo.GetUserByID(userID)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить профиль")
		return
	}
	writeJSON(w, user)
}

func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID, _ := currentIdentity(r)
	var input models.UpdateUser
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}
	input.Email = normalizeEmail(input.Email)
	input.Name = strings.TrimSpace(input.Name)
	if validateEmail(input.Email) != nil || input.Name == "" || len(input.Name) > 120 {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "укажи корректную почту и имя до 120 символов")
		return
	}
	user, err := h.repo.UpdateUser(userID, input)
	if errors.Is(err, repository.ErrEmailTaken) {
		writeAPIError(w, http.StatusConflict, "email_taken", "аккаунт с такой почтой уже существует")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось сохранить профиль")
		return
	}
	writeJSON(w, user)
}

func (h *AuthHandler) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		const prefix = "Bearer "
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, prefix) {
			writeAPIError(w, http.StatusUnauthorized, "unauthorized", "нужен вход")
			return
		}
		claims, err := h.parseToken(strings.TrimSpace(strings.TrimPrefix(header, prefix)))
		if err != nil {
			writeAPIError(w, http.StatusUnauthorized, "unauthorized", "сессия недействительна или истекла")
			return
		}
		user, err := h.repo.GetUserByID(claims.UserID)
		if err != nil {
			writeAPIError(w, http.StatusUnauthorized, "unauthorized", "пользователь не найден")
			return
		}
		ctx := withIdentity(r, user.ID, user.AccountType)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (h *AuthHandler) RequireRole(role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, currentRole := currentIdentity(r)
			if currentRole != role {
				writeAPIError(w, http.StatusForbidden, "forbidden", "недостаточно прав")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func (h *AuthHandler) RequireAnyRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[role] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, currentRole := currentIdentity(r)
			if _, ok := allowed[currentRole]; !ok {
				writeAPIError(w, http.StatusForbidden, "forbidden", "недостаточно прав")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type tokenClaims struct {
	UserID int64  `json:"sub"`
	Role   string `json:"role"`
	Issued int64  `json:"iat"`
	Expiry int64  `json:"exp"`
}

func (h *AuthHandler) issueToken(user models.User) (string, error) {
	header, err := encodeSegment(map[string]string{"alg": "HS256", "typ": "JWT"})
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	claims, err := encodeSegment(tokenClaims{UserID: user.ID, Role: user.AccountType, Issued: now.Unix(), Expiry: now.Add(24 * time.Hour).Unix()})
	if err != nil {
		return "", err
	}
	unsigned := header + "." + claims
	mac := hmac.New(sha256.New, h.secret)
	_, _ = mac.Write([]byte(unsigned))
	return unsigned + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}

func (h *AuthHandler) parseToken(token string) (tokenClaims, error) {
	var claims tokenClaims
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return claims, errors.New("invalid token")
	}
	var header map[string]string
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || json.Unmarshal(headerBytes, &header) != nil || header["alg"] != "HS256" {
		return claims, errors.New("invalid token header")
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return claims, errors.New("invalid signature")
	}
	mac := hmac.New(sha256.New, h.secret)
	_, _ = mac.Write([]byte(parts[0] + "." + parts[1]))
	if !hmac.Equal(signature, mac.Sum(nil)) {
		return claims, errors.New("invalid signature")
	}
	claimBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || json.Unmarshal(claimBytes, &claims) != nil || claims.UserID <= 0 || claims.Expiry <= time.Now().Unix() {
		return tokenClaims{}, errors.New("invalid claims")
	}
	return claims, nil
}

func hashPassword(password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s", argonMemory, argonTime, argonThreads,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash)), nil
}

func verifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" || parts[2] != "v=19" {
		return false
	}
	var memory, iterations uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &threads); err != nil || memory < 8*1024 || memory > 256*1024 || iterations < 1 || iterations > 10 || threads < 1 || threads > 16 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 8 || len(salt) > 64 {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(expected) < 16 || len(expected) > 64 {
		return false
	}
	actual := argon2.IDKey([]byte(password), salt, iterations, memory, threads, uint32(len(expected)))
	return hmac.Equal(actual, expected)
}

func encodeSegment(value any) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	limited := &io.LimitedReader{R: r.Body, N: (1 << 20) + 1}
	decoder := json.NewDecoder(limited)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("body must contain one JSON value")
	}
	if limited.N <= 0 {
		return errors.New("request body is too large")
	}
	return nil
}

func validateEmail(email string) error {
	address, err := mail.ParseAddress(email)
	if err != nil || address.Address != email || len(email) > 254 {
		return errors.New("invalid email")
	}
	return nil
}

func normalizeEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

type rateLimiter struct {
	mu      sync.Mutex
	entries map[string]rateEntry
}

type rateEntry struct {
	count int
	start time.Time
}

func newRateLimiter() *rateLimiter { return &rateLimiter{entries: make(map[string]rateEntry)} }

func (l *rateLimiter) allow(key string, limit int, window time.Duration) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	entry, ok := l.entries[key]
	if !ok || now.Sub(entry.start) >= window {
		l.entries[key] = rateEntry{count: 1, start: now}
		return true
	}
	if entry.count >= limit {
		return false
	}
	entry.count++
	l.entries[key] = entry
	if len(l.entries) > 10000 {
		for address, candidate := range l.entries {
			if now.Sub(candidate.start) > time.Hour {
				delete(l.entries, address)
			}
		}
	}
	return true
}

type identityKey struct{}

type identity struct {
	userID int64
	role   string
}

func withIdentity(r *http.Request, userID int64, role string) context.Context {
	return context.WithValue(r.Context(), identityKey{}, identity{userID: userID, role: role})
}

func currentIdentity(r *http.Request) (int64, string) {
	value, _ := r.Context().Value(identityKey{}).(identity)
	return value.userID, value.role
}

func (h *AuthHandler) TokenTTL() time.Duration { return 24 * time.Hour }
