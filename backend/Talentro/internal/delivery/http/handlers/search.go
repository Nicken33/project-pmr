package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"talentro/internal/models"
	"talentro/internal/repository"
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
