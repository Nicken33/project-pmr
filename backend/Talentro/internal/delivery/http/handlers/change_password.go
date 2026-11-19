package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"talentro/internal/repository"
)

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	userID, _ := currentIdentity(r)
	if !h.limiter.allow("change-password:"+strconv.FormatInt(userID, 10), 5, time.Minute) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много попыток, попробуй через минуту")
		return
	}
	var input struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}
	if input.Current == "" || len(input.Current) > 256 || len(input.New) < 8 ||
		len(input.New) > 256 || input.Current == input.New {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "укажи текущий и новый пароль, новый должен отличаться и иметь длину от 8 до 256 байт")
		return
	}

	currentHash, err := h.repo.GetPasswordHash(userID)
	if err != nil {
		log.Printf("GetPasswordHash: %v", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось проверить пароль")
		return
	}
	if !verifyPassword(input.Current, currentHash) {
		writeAPIError(w, http.StatusForbidden, "invalid_current_password", "текущий пароль неверен")
		return
	}
	newHash, err := hashPassword(input.New)
	if err == nil {
		err = h.repo.ChangePassword(userID, currentHash, newHash)
	}
	if errors.Is(err, repository.ErrPasswordChanged) {
		writeAPIError(w, http.StatusConflict, "password_changed", "пароль уже изменился, введи текущий пароль заново")
		return
	}
	if err != nil {
		log.Printf("ChangePassword: %v", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось изменить пароль")
		return
	}
	writeJSON(w, map[string]string{"message": "Пароль изменён"})
}
