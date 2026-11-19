package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"talentro/internal/repository"
)

func newEmailVerificationToken() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func (h *AuthHandler) ConfirmEmailVerification(w http.ResponseWriter, r *http.Request) {
	if !h.limiter.allow("email-confirm:"+h.clientIP(r), 10, time.Minute) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много попыток подтверждения")
		return
	}
	var input struct {
		Token string `json:"token"`
	}
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}
	value, err := base64.RawURLEncoding.DecodeString(input.Token)
	if err != nil || len(value) != 32 {
		writeAPIError(w, http.StatusBadRequest, "invalid_token", "ссылка подтверждения недействительна или истекла")
		return
	}
	err = h.repo.ConfirmRegistration(hashResetToken(input.Token))
	switch {
	case errors.Is(err, repository.ErrInvalidEmailVerificationToken):
		writeAPIError(w, http.StatusBadRequest, "invalid_token", err.Error())
	case errors.Is(err, repository.ErrEmailTaken):
		writeAPIError(w, http.StatusConflict, "email_taken", "аккаунт уже существует; войди с паролем или через Google")
	case err != nil:
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось подтвердить почту")
	default:
		writeJSON(w, map[string]string{"message": "Почта подтверждена, аккаунт создан. Теперь можно войти"})
	}
}

func (h *AuthHandler) ResendEmailVerification(w http.ResponseWriter, r *http.Request) {
	if !h.limiter.allow("email-resend:"+h.clientIP(r), 10, time.Hour) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много запросов на отправку письма")
		return
	}
	var input struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}
	email := normalizeEmail(input.Email)
	if validateEmail(email) != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_email", "укажи корректную почту")
		return
	}
	if !h.resetMail.configured() {
		writeAPIError(w, http.StatusServiceUnavailable, "email_unavailable", "отправка писем пока не настроена")
		return
	}
	// Per-address limit prevents mail flooding across different IP addresses.
	if !h.limiter.allow("email-resend-address:"+hashResetToken(email), 3, time.Hour) {
		writeJSON(w, map[string]string{"message": "Если регистрация ожидает подтверждения, письмо будет отправлено. Проверь почту и папку спам"})
		return
	}
	token, err := newEmailVerificationToken()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось создать запрос")
		return
	}
	found, err := h.repo.ResendRegistration(email, hashResetToken(token))
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось повторить отправку")
		return
	}
	if found {
		if err := h.resetMail.sendRegistration(email, token); err != nil {
			writeAPIError(w, http.StatusServiceUnavailable, "email_delivery_failed", "не удалось отправить письмо; повтори отправку через минуту")
			return
		}
	}
	writeJSON(w, map[string]string{"message": "Если регистрация ожидает подтверждения, письмо будет отправлено. Проверь почту и папку спам"})
}

func (cfg PasswordResetMailConfig) sendRegistration(to, token string) error {
	link := strings.TrimRight(cfg.FrontendURL, "/") + "/verify-email?token=" + url.QueryEscape(token)
	return cfg.sendText(to, "Talentro email confirmation",
		"Ты начал регистрацию в Talentro. Открой ссылку и подтверди почту:\r\n"+link+
			"\r\n\r\nСсылка действует 15 минут и используется один раз. После подтверждения войди с указанным при регистрации паролем.\r\n"+
			"Если ты не регистрировался, проигнорируй письмо.\r\n")
}
