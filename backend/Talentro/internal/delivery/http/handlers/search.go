package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"talentro/internal/models"
	"talentro/internal/repository"

	"github.com/go-chi/chi/v5"
)

type CardHandler struct {
	repo *repository.Repository
}

func NewCardHandler(repo *repository.Repository) *CardHandler {
	return &CardHandler{repo: repo}
}

func (h *CardHandler) SearchCard(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var f models.CardFilter

	if v := q.Get("city_name"); v != "" {
		f.CityName = &v
	}
	if v, err := strconv.ParseInt(q.Get("city"), 10, 64); err == nil {
		f.CityID = &v
	}
	if v, err := strconv.ParseInt(q.Get("direction"), 10, 64); err == nil {
		f.DirectionID = &v
	}
	if v, err := strconv.Atoi(q.Get("age")); err == nil {
		f.Age = &v
	}
	if v, err := strconv.ParseFloat(q.Get("price_max"), 64); err == nil {
		f.PriceMax = &v
	}
	if v := q.Get("q"); v != "" {
		f.Search = &v
	}

	cards, err := h.repo.SearchCards(f)
	if err != nil {
		log.Println("SearchCards: ", err)
		http.Error(w, "внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cards)
}

// CardByID отдаёт анкету целиком — с точками проведения и иллюстрациями.
// Не-published и несуществующий id дают 404: пустой объект фронт показал бы
// как «занятие без названия».
func (h *CardHandler) CardByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "некорректный идентификатор", http.StatusBadRequest)
		return
	}

	card, err := h.repo.GetCardByID(id)
	switch {
	case errors.Is(err, repository.ErrNotFound):
		http.Error(w, "анкета не найдена или не опубликована", http.StatusNotFound)
		return
	case err != nil:
		log.Println("GetCardByID: ", err)
		http.Error(w, "внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(card)
}

// Dictionaries — справочник направлений. Фронт держал 49 категорий и 9
// направлений в моках; пока они там, «чистая» витрина показывает список,
// которого в базе может не быть.
func (h *CardHandler) Dictionaries(w http.ResponseWriter, r *http.Request) {
	dicts, err := h.repo.Dictionaries()
	if err != nil {
		log.Println("Dictionaries: ", err)
		http.Error(w, "внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dicts)
}

func (h *CardHandler) Cities(w http.ResponseWriter, r *http.Request) {
	cities, err := h.repo.Cities()
	if err != nil {
		log.Println("Cities: ", err)
		http.Error(w, "внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cities)
}
