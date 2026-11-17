package handlers

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"talentro/internal/models"
	"talentro/internal/repository"
)

func (h *AuthHandler) CreateReport(w http.ResponseWriter, r *http.Request) {
	var input models.ReportInput
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, 400, "invalid_body", "некорректное тело запроса")
		return
	}
	input.Reason = strings.TrimSpace(input.Reason)
	input.Detail = strings.TrimSpace(input.Detail)
	if input.TargetType == "activity" {
		input.TargetType = "card"
	}
	if input.TargetID <= 0 || (input.TargetType != "card" && input.TargetType != "review" && input.TargetType != "media") || utf8.RuneCountInString(input.Reason) < 1 || utf8.RuneCountInString(input.Reason) > 120 || utf8.RuneCountInString(input.Detail) > 2000 {
		writeAPIError(w, 400, "invalid_fields", "укажите тип card, review или media, положительный target_id, причину до 120 и описание до 2000 символов")
		return
	}
	userID, _ := currentIdentity(r)
	if !h.limiter.allow("report:"+strconv.FormatInt(userID, 10), 10, time.Hour) {
		writeAPIError(w, 429, "rate_limited", "слишком много жалоб, попробуйте позже")
		return
	}
	report, err := h.repo.CreateReport(userID, input)
	if errors.Is(err, sql.ErrNoRows) {
		writeAPIError(w, 404, "not_found", "запись не найдена или недоступна")
		return
	}
	if errors.Is(err, repository.ErrReportExists) {
		writeAPIError(w, 409, "report_exists", err.Error())
		return
	}
	if err != nil {
		log.Printf("CreateReport: %v", err)
		writeAPIError(w, 500, "internal_error", "не удалось отправить жалобу")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, report)
}

func (h *AuthHandler) Reports(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("target_type")
	switch chi.URLParam(r, "kind") {
	case "activities":
		kind = "card"
	case "reviews":
		kind = "review"
	case "media":
		kind = "media"
	}
	if kind == "activity" {
		kind = "card"
	}
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "open"
	}
	if (kind != "" && kind != "card" && kind != "review" && kind != "media") || (status != "open" && status != "hidden" && status != "dismissed") {
		writeAPIError(w, 400, "invalid_query", "неверный тип или статус жалобы")
		return
	}
	page, limit, err := parsePageLimit(r)
	if err != nil {
		writeAPIError(w, 400, "invalid_query", err.Error())
		return
	}
	result, err := h.repo.ListReports(kind, status, page, limit)
	if err != nil {
		log.Printf("Reports: %v", err)
		writeAPIError(w, 500, "internal_error", "не удалось получить жалобы")
		return
	}
	writeJSON(w, result)
}

func (h *AuthHandler) DecideReport(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeAPIError(w, 400, "invalid_id", "некорректный id жалобы")
		return
	}
	var input struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if err := decodeJSON(r, &input); err != nil {
		writeAPIError(w, 400, "invalid_body", "некорректное тело запроса")
		return
	}
	input.Reason = strings.TrimSpace(input.Reason)
	if (input.Action != "hide" && input.Action != "dismiss") || (input.Action == "hide" && (input.Reason == "" || utf8.RuneCountInString(input.Reason) > 1000)) {
		writeAPIError(w, 400, "invalid_fields", "выберите hide с причиной до 1000 символов либо dismiss")
		return
	}
	userID, _ := currentIdentity(r)
	report, err := h.repo.DecideReport(userID, id, input.Action, input.Reason)
	if errors.Is(err, sql.ErrNoRows) {
		writeAPIError(w, 404, "not_found", "жалоба не найдена")
		return
	}
	if errors.Is(err, repository.ErrReportDecided) {
		writeAPIError(w, 409, "already_decided", err.Error())
		return
	}
	if err != nil {
		log.Printf("DecideReport: %v", err)
		writeAPIError(w, 500, "internal_error", "не удалось сохранить решение")
		return
	}
	writeJSON(w, map[string]any{"report": report})
}
