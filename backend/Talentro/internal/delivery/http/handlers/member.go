package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"talentro/internal/models"
	"talentro/internal/repository"
)

func (h *AuthHandler) Favorites(w http.ResponseWriter, r *http.Request) {
	page, limit, err := parsePageLimit(r)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_query", err.Error())
		return
	}
	userID, _ := currentIdentity(r)
	result, err := h.repo.ListFavorites(userID, page, limit)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить избранное")
		return
	}
	writeJSON(w, result)
}

func (h *AuthHandler) AddFavorite(w http.ResponseWriter, r *http.Request) {
	var input models.Favorite
	if err := decodeJSON(r, &input); err != nil || input.CardID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "укажи положительный card_id")
		return
	}
	userID, _ := currentIdentity(r)
	err := h.repo.AddFavorite(userID, input.CardID)
	switch {
	case errors.Is(err, repository.ErrFavoriteExists):
		writeAPIError(w, http.StatusConflict, "favorite_exists", "карточка уже добавлена в избранное")
	case errors.Is(err, repository.ErrCardNotFound):
		writeAPIError(w, http.StatusNotFound, "not_found", "опубликованная карточка не найдена")
	case err != nil:
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось добавить карточку в избранное")
	default:
		w.WriteHeader(http.StatusCreated)
	}
}

func (h *AuthHandler) DeleteFavorite(w http.ResponseWriter, r *http.Request) {
	cardID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || cardID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id должен быть положительным целым числом")
		return
	}
	userID, _ := currentIdentity(r)
	if err := h.repo.RemoveFavorite(userID, cardID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeAPIError(w, http.StatusNotFound, "not_found", "карточка не найдена в избранном")
			return
		}
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось удалить избранное")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Vote(w http.ResponseWriter, r *http.Request) {
	cardID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || cardID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id должен быть положительным целым числом")
		return
	}
	var input struct {
		Value json.RawMessage `json:"value"`
	}
	if err := decodeJSON(r, &input); err != nil || len(input.Value) == 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "поле value должно быть 1, -1 или null")
		return
	}
	var value *int
	if string(input.Value) != "null" {
		var parsed int
		if err := json.Unmarshal(input.Value, &parsed); err != nil || (parsed != 1 && parsed != -1) {
			writeAPIError(w, http.StatusBadRequest, "invalid_body", "поле value должно быть 1, -1 или null")
			return
		}
		value = &parsed
	}
	userID, _ := currentIdentity(r)
	result, err := h.repo.SaveVote(userID, cardID, value)
	if errors.Is(err, repository.ErrCardNotFound) {
		writeAPIError(w, http.StatusNotFound, "not_found", "опубликованная карточка не найдена")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось сохранить голос")
		return
	}
	writeJSON(w, result)
}

func parsePageLimit(r *http.Request) (int, int, error) {
	page, err := optionalIntValue(r.URL.Query(), "page", 1, 1, 1000000)
	if err != nil {
		return 0, 0, err
	}
	limit, err := optionalIntValue(r.URL.Query(), "limit", 20, 1, 100)
	if err != nil {
		return 0, 0, err
	}
	return page, limit, nil
}

func (h *AuthHandler) ModerationQueue(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}
	if status != "pending" && status != "published" && status != "rejected" {
		writeAPIError(w, http.StatusBadRequest, "invalid_query", "status должен быть pending, published или rejected")
		return
	}
	items, err := h.repo.ModerationQueue(status)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить очередь модерации")
		return
	}
	writeJSON(w, items)
}

func (h *AuthHandler) GetModerationActivity(w http.ResponseWriter, r *http.Request) {
	activityID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || activityID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id должен быть положительным числом")
		return
	}

	item, err := h.repo.GetModerationActivity(activityID)
	if errors.Is(err, sql.ErrNoRows) {
		writeAPIError(w, http.StatusNotFound, "not_found", "секция не найдена")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось открыть секцию для модерации")
		return
	}

	writeJSON(w, item)
}

func (h *AuthHandler) ApproveCard(w http.ResponseWriter, r *http.Request) {
	h.decideCard(w, r, "approved", "")
}

func (h *AuthHandler) RejectCard(w http.ResponseWriter, r *http.Request) {
	var input models.ModerationDecision
	if err := decodeJSON(r, &input); err != nil || len(strings.TrimSpace(input.Comment)) < 3 || len(input.Comment) > 1000 {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "укажи причину отказа длиной от 3 до 1000 символов")
		return
	}
	h.decideCard(w, r, "rejected", strings.TrimSpace(input.Comment))
}

func (h *AuthHandler) decideCard(w http.ResponseWriter, r *http.Request, decision, comment string) {
	cardID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || cardID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id должен быть положительным целым числом")
		return
	}
	moderatorID, _ := currentIdentity(r)
	item, err := h.repo.DecideCard(cardID, moderatorID, decision, comment)
	switch {
	case errors.Is(err, repository.ErrCardNotFound):
		writeAPIError(w, http.StatusNotFound, "not_found", "карточка не найдена")
	case errors.Is(err, repository.ErrCardNotPending):
		writeAPIError(w, http.StatusConflict, "invalid_status", "карточка уже обработана")
	case err != nil:
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось сохранить решение модератора")
	default:
		writeJSON(w, item)
	}
}

func (h *AuthHandler) MyOrganization(w http.ResponseWriter, r *http.Request) {
	userID, _ := currentIdentity(r)
	organization, err := h.repo.GetOwnedOrganization(userID)
	if errors.Is(err, sql.ErrNoRows) {
		writeAPIError(w, http.StatusNotFound, "not_found", "профиль организации не создан")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить профиль организации")
		return
	}
	writeJSON(w, organization)
}

func (h *AuthHandler) UpdateMyOrganization(w http.ResponseWriter, r *http.Request) {
	var input models.OrganizationMutation
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.Phone = strings.TrimSpace(input.Phone)
	input.Type = strings.TrimSpace(input.Type)
	if input.Name == "" || len(input.Name) > 200 || input.Phone == "" || input.CityID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "название, телефон и город обязательны")
		return
	}
	switch input.Type {
	case "school", "studio", "art_house", "sports_school", "private_master":
	default:
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "недопустимый тип организации")
		return
	}
	if input.Email != nil {
		*input.Email = normalizeEmail(*input.Email)
		if validateEmail(*input.Email) != nil {
			writeAPIError(w, http.StatusBadRequest, "invalid_fields", "некорректный email организации")
			return
		}
	}
	if input.Website != nil && *input.Website != "" && !strings.HasPrefix(*input.Website, "https://") {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "сайт организации должен начинаться с https://")
		return
	}
	if len(input.Messengers) > 4 {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "можно указать не более четырёх мессенджеров")
		return
	}
	seenChannels := make(map[string]bool)
	for _, messenger := range input.Messengers {
		if messenger.Channel != "telegram" && messenger.Channel != "viber" && messenger.Channel != "whatsapp" && messenger.Channel != "instagram" || strings.TrimSpace(messenger.Contact) == "" || seenChannels[messenger.Channel] {
			writeAPIError(w, http.StatusBadRequest, "invalid_fields", "проверь каналы и контакты мессенджеров")
			return
		}
		seenChannels[messenger.Channel] = true
	}
	userID, _ := currentIdentity(r)
	organization, err := h.repo.SaveOwnedOrganization(userID, input)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось сохранить профиль организации")
		return
	}
	writeJSON(w, organization)
}
