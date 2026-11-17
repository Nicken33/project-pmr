package handlers

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"talentro/internal/models"
)

const googleUserInfoURL = "https://openidconnect.googleapis.com/v1/userinfo"

type googleLoginRequest struct {
	Credential  string `json:"credential"`
	AccountType string `json:"account_type"`
}

type googleUserInfo struct {
	Subject       string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Name          string `json:"name"`
}

type googleAccountTypePrompt struct {
	NeedsAccountType bool   `json:"needs_account_type"`
	Email            string `json:"email"`
	Name             string `json:"name"`
}

// GoogleLogin accepts the Google OAuth access token sent by the current web
// client. Existing accounts sign in immediately; new accounts must send an
// allowed account_type after the frontend has shown the role selection step.
func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	if h.googleClientID == "" || h.googleClient == nil {
		writeAPIError(w, http.StatusServiceUnavailable, "google_not_configured", "вход через Google не настроен")
		return
	}
	if !h.limiter.allow("google-login:"+h.clientIP(r), 10, time.Minute) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много попыток входа")
		return
	}

	var input googleLoginRequest
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}
	accessToken := strings.TrimSpace(input.Credential)
	if accessToken == "" || len(accessToken) > 16*1024 {
		writeAPIError(w, http.StatusBadRequest, "invalid_credential", "Google не передал корректный токен")
		return
	}

	profile, err := h.fetchGoogleProfile(r, accessToken)
	if err != nil {
		var invalidToken googleTokenError
		if errors.As(err, &invalidToken) {
			writeAPIError(w, http.StatusUnauthorized, "invalid_google_token", "токен Google недействителен или истёк")
			return
		}
		writeAPIError(w, http.StatusBadGateway, "google_unavailable", "не удалось проверить аккаунт Google")
		return
	}
	profile.Email = normalizeEmail(profile.Email)
	profile.Name = strings.TrimSpace(profile.Name)
	if profile.Subject == "" || validateEmail(profile.Email) != nil || !profile.EmailVerified {
		writeAPIError(w, http.StatusUnauthorized, "unverified_google_account", "Google не подтвердил адрес электронной почты")
		return
	}
	if profile.Name == "" {
		profile.Name = strings.SplitN(profile.Email, "@", 2)[0]
	}
	if len(profile.Name) > 120 {
		profile.Name = truncateUTF8(profile.Name, 120)
	}

	user, err := h.repo.GetUserByEmail(profile.Email)
	if errors.Is(err, sql.ErrNoRows) {
		if input.AccountType == "" {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(w).Encode(googleAccountTypePrompt{
				NeedsAccountType: true,
				Email:            profile.Email,
				Name:             profile.Name,
			})
			return
		}
		if input.AccountType != "user" && input.AccountType != "section_owner" && input.AccountType != "service_owner" {
			writeAPIError(w, http.StatusBadRequest, "invalid_fields", "недопустимый тип аккаунта")
			return
		}
		// Current database schema requires password_hash even for OAuth accounts.
		// The random secret is never returned or used for password login.
		secret := make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось создать аккаунт")
			return
		}
		passwordHash, err := hashPassword(base64.RawURLEncoding.EncodeToString(secret))
		if err != nil {
			writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось создать аккаунт")
			return
		}
		user, err = h.repo.GetOrCreateGoogleUser(profile.Email, profile.Name, input.AccountType, passwordHash)
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось выполнить вход через Google")
		return
	}

	token, err := h.issueToken(user)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось выполнить вход через Google")
		return
	}
	secureCookie := r.TLS != nil || strings.EqualFold(strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0]), "https")
	http.SetCookie(w, &http.Cookie{
		Name: "talentro_session", Value: token, Path: "/", HttpOnly: true,
		Secure: secureCookie, SameSite: http.SameSiteLaxMode, MaxAge: int(h.TokenTTL().Seconds()),
	})
	writeJSON(w, models.AuthToken{Token: token, User: user})
}

func (h *AuthHandler) fetchGoogleProfile(r *http.Request, accessToken string) (googleUserInfo, error) {
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return googleUserInfo{}, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := h.googleClient.Do(req)
	if err != nil {
		return googleUserInfo{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return googleUserInfo{}, googleTokenError{}
	}
	if resp.StatusCode != http.StatusOK {
		return googleUserInfo{}, fmt.Errorf("google userinfo returned HTTP %d", resp.StatusCode)
	}
	var profile googleUserInfo
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&profile); err != nil {
		return googleUserInfo{}, err
	}
	return profile, nil
}

type googleTokenError struct{}

func (googleTokenError) Error() string { return "invalid Google access token" }

func truncateUTF8(value string, maxBytes int) string {
	if len(value) <= maxBytes {
		return value
	}
	for maxBytes > 0 && !utf8.ValidString(value[:maxBytes]) {
		maxBytes--
	}
	return value[:maxBytes]
}
