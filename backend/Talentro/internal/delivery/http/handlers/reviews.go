package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"talentro/internal/repository"
)

func (h *CardHandler) ActivityReviews(w http.ResponseWriter, r *http.Request) {
	activityID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || activityID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id секции должен быть положительным числом")
		return
	}

	page, limit, err := parsePageLimit(r)
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_query", err.Error())
		return
	}

	result, err := h.repo.ListActivityReviews(activityID, page, limit)
	if errors.Is(err, repository.ErrActivityNotReviewable) {
		writeAPIError(w, http.StatusNotFound, "not_found", "опубликованная секция не найдена")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить отзывы")
		return
	}

	writeJSON(w, result)
}

func (h *AuthHandler) CreateActivityReview(w http.ResponseWriter, r *http.Request) {
	activityID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || activityID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id секции должен быть положительным числом")
		return
	}

	var input struct {
		Text string `json:"text"`
	}
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_body", "некорректное тело запроса")
		return
	}

	input.Text = strings.TrimSpace(input.Text)
	if input.Text == "" {
		writeAPIError(w, http.StatusBadRequest, "invalid_fields", "текст отзыва не должен быть пустым")
		return
	}

	authorID, _ := currentIdentity(r)
	review, err := h.repo.CreateActivityReview(authorID, activityID, input.Text)

	switch {
	case errors.Is(err, repository.ErrActivityNotReviewable):
		writeAPIError(w, http.StatusNotFound, "not_found", "опубликованная секция не найдена")
	case errors.Is(err, repository.ErrReviewAlreadyExists):
		writeAPIError(w, http.StatusConflict, "review_exists", "ты уже оставлял отзыв на эту секцию")
	case err != nil:
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось создать отзыв")
	case errors.Is(err, repository.ErrCannotReviewOwnActivity):
		writeAPIError(w, http.StatusForbidden, "own_review_forbidden", "нельзя оставлять отзыв на свою секцию")
	default:
		w.WriteHeader(http.StatusCreated)
		writeJSON(w, review)
	}
}
