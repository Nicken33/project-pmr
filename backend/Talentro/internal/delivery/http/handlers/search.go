package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"talentro/internal/repository"

	"github.com/go-chi/chi/v5"
)

type CardHandler struct {
	repo *repository.Repository
}

// Конструктор для CardHandler
func NewCardHandler(repo *repository.Repository) *CardHandler {
	return &CardHandler{repo: repo}
}

// Функция поиска секций и услул по фильтру
func (h *CardHandler) SearchCard(w http.ResponseWriter, r *http.Request) {
	f, err := parseActivityFilter(r.URL.Query()) // Читаем фильтры
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_query", err.Error())
		return
	}

	f.ViewerID, _ = currentIdentity(r)
	cards, err := h.repo.SearchCards(f) // Ищем секции по заданным фильтрам
	if err != nil {
		log.Println("SearchCards: ", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "внутренняя ошибка сервера")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cards)
}

// Функция получения данных и подробностей о секции
func (h *CardHandler) GetActivity(w http.ResponseWriter, r *http.Request) {
	viewerID, _ := currentIdentity(r)
	details, err := h.repo.GetActivity(chi.URLParam(r, "identifier"), viewerID)
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
