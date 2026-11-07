package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"talentro/internal/models"

	"github.com/go-chi/chi/v5"
)

func (h *AuthHandler) CreateOwnedActivity(w http.ResponseWriter, r *http.Request) {
	var input models.OwnedActivityInput

	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}

	if message := validateOwnedActivityInput(&input); message != "" {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", message)
		return
	}

	ownerID, _ := currentIdentity(r)

	id, slug, err := h.repo.CreateOwnedActivity(ownerID, input)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "create_failed", "не удалось создать секцию")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"id":     strconv.FormatInt(id, 10),
		"slug":   slug,
		"status": "draft",
	})
}

func (h *AuthHandler) ListOwnedActivities(w http.ResponseWriter, r *http.Request) {
	ownerID, _ := currentIdentity(r)

	items, err := h.repo.ListOwnedActivities(ownerID)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить секции")
		return
	}

	writeJSON(w, items)
}

func (h *AuthHandler) GetOwnedActivity(w http.ResponseWriter, r *http.Request) {
	ownerID, _ := currentIdentity(r)

	activityID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || activityID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id должен быть положительным числом")
		return
	}

	item, err := h.repo.GetOwnedActivity(ownerID, activityID)
	if errors.Is(err, sql.ErrNoRows) {
		writeAPIError(w, http.StatusNotFound, "not_found", "секция не найдена")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить секцию")
		return
	}

	writeJSON(w, item)
}

func (h *AuthHandler) UpdateOwnedActivity(w http.ResponseWriter, r *http.Request) {
	ownerID, _ := currentIdentity(r)

	activityID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || activityID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id должен быть положительным числом")
		return
	}

	var input models.OwnedActivityInput
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}

	if message := validateOwnedActivityInput(&input); message != "" {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", message)
		return
	}

	item, err := h.repo.UpdateOwnedActivity(ownerID, activityID, input)
	if errors.Is(err, sql.ErrNoRows) {
		writeAPIError(w, http.StatusNotFound, "not_found", "секция не найдена")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "update_failed", "не удалось сохранить изменения секции")
		return
	}

	writeJSON(w, item)
}

func validateOwnedActivityInput(input *models.OwnedActivityInput) string {
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" || len([]rune(input.Name)) > 200 {
		return "название обязательно и должно быть не длиннее 200 символов"
	}

	if input.DirectionID <= 0 {
		return "direction_id должен быть положительным ID"
	}

	if input.ClassType == nil ||
		(*input.ClassType != "individual" &&
			*input.ClassType != "group" &&
			*input.ClassType != "both") {
		return "class_type должен быть individual, group или both"
	}

	if input.ClassFormat != "online" &&
		input.ClassFormat != "offline" &&
		input.ClassFormat != "both" {
		return "class_format должен быть online, offline или both"
	}

	input.RecordType = "activity"
	return ""
}
