package handlers

import (
	"database/sql"
	"encoding/json"
	"github.com/go-chi/chi/v5"
	"log"
	"net/http"
	"talentro/internal/repository"
)

type CardHandler struct {
	repo *repository.Repository
}

func NewCardHandler(repo *repository.Repository) *CardHandler {
	return &CardHandler{repo: repo}
}

func (h *CardHandler) SearchCard(w http.ResponseWriter, r *http.Request) {
	f, err := parseActivityFilter(r.URL.Query())
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_query", err.Error())
		return
	}

	cards, err := h.repo.SearchCards(f)
	if err != nil {
		log.Println("SearchCards: ", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "внутренняя ошибка сервера")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cards)
}

func (h *CardHandler) GetActivity(w http.ResponseWriter, r *http.Request) {
	details, err := h.repo.GetActivity(chi.URLParam(r, "identifier"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeAPIError(w, http.StatusNotFound, "not_found", "карточка не найдена")
			return
		}
		log.Printf("GetActivity: %v", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "внутренняя ошибка сервера")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(details)
}
