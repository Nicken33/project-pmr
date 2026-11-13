package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"log"
	"net"
	"net/http"
	"net/smtp"
	"net/url"
	"strings"
	"talentro/internal/repository"
	"time"
)

type PasswordResetMailConfig struct {
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string
	FrontendURL  string
}

func (h *AuthHandler) ConfigurePasswordResetMail(cfg PasswordResetMailConfig) {
	h.resetMail = cfg
}

type passwordResetRequest struct {
	Email string `json:"email"`
}

type passwordResetConfirm struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (h *AuthHandler) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	if !h.limiter.allow("password-reset:"+clientIP(r), 3, time.Hour) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много запросов на восстановление пароля")
		return
	}

	var input passwordResetRequest
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

	randomToken := make([]byte, 32)
	if _, err := rand.Read(randomToken); err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось создать запрос")
		return
	}

	token := base64.RawURLEncoding.EncodeToString(randomToken)
	tokenHash := hashResetToken(token)

	found, err := h.repo.CreatePasswordResetToken(email, tokenHash)
	if err != nil {
		log.Printf("создание токена сброса пароля: %v", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось создать запрос")
		return
	}

	// Одинаковый ответ для существующей и неизвестной почты.
	if found {
		if err := h.resetMail.send(email, token); err != nil {
			log.Printf("отправка письма сброса пароля: %v", err)
		}
	}

	writeJSON(w, map[string]string{
		"message": "Если аккаунт с такой почтой существует, инструкция отправлена",
	})
}

func (h *AuthHandler) ConfirmPasswordReset(w http.ResponseWriter, r *http.Request) {
	if !h.limiter.allow("password-reset-confirm:"+clientIP(r), 10, time.Hour) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много попыток смены пароля")
		return
	}

	var input passwordResetConfirm
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}

	input.Token = strings.TrimSpace(input.Token)
	if len(input.Token) < 20 || len(input.Token) > 200 ||
		len(input.Password) < 8 || len(input.Password) > 256 {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "токен недействителен или пароль должен быть длиной от 8 до 256 символов")
		return
	}

	passwordHash, err := hashPassword(input.Password)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось изменить пароль")
		return
	}

	err = h.repo.ResetPassword(hashResetToken(input.Token), passwordHash)
	if errors.Is(err, repository.ErrInvalidPasswordResetToken) {
		writeAPIError(w, http.StatusBadRequest, "invalid_token", "ссылка восстановления недействительна или истекла")
		return
	}
	if err != nil {
		log.Printf("сброс пароля: %v", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось изменить пароль")
		return
	}

	writeJSON(w, map[string]string{"message": "Пароль изменён"})
}

func hashResetToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (cfg PasswordResetMailConfig) configured() bool {
	return cfg.SMTPHost != "" &&
		cfg.SMTPPort != "" &&
		cfg.SMTPUsername != "" &&
		cfg.SMTPPassword != "" &&
		cfg.SMTPFrom != "" &&
		cfg.FrontendURL != ""
}

func (cfg PasswordResetMailConfig) send(to, token string) error {
	resetURL := strings.TrimRight(cfg.FrontendURL, "/") +
		"/reset-password?token=" + url.QueryEscape(token)

	message := []byte(
		"From: " + cfg.SMTPFrom + "\r\n" +
			"To: " + to + "\r\n" +
			"Subject: Talentro password reset\r\n" +
			"MIME-Version: 1.0\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"\r\n" +
			"Чтобы задать новый пароль, открой ссылку:\r\n" +
			resetURL + "\r\n\r\n" +
			"Ссылка действует 15 минут и может быть использована один раз.\r\n",
	)

	auth := smtp.PlainAuth("", cfg.SMTPUsername, cfg.SMTPPassword, cfg.SMTPHost)
	address := net.JoinHostPort(cfg.SMTPHost, cfg.SMTPPort)
	return smtp.SendMail(address, auth, cfg.SMTPFrom, []string{to}, message)
}
