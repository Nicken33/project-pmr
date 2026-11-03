package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"talentro/internal/models"
	"talentro/internal/repository"
)

type ActivityHandler struct {
	repo *repository.Repository
}

func NewActivityHandler(repo *repository.Repository) *ActivityHandler {
	return &ActivityHandler{repo: repo}
}

func (h *ActivityHandler) SearchActivity(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var f models.ActivityFilter

	if v, err := strconv.Atoi(q.Get("age")); err == nil {
		f.Age = &v
	}
	if cityID := q.Get("city_id"); cityID != "" {
		f.CityID = &cityID
	}
	if priceVal, err := strconv.Atoi(q.Get("price")); err == nil {
		f.PriceMax = &priceVal
	}

	activities, err := h.repo.SearchActivities(f)
	if err != nil {
		log.Println("SearchActivities: ", err)
		http.Error(w, "внутренняя ошибка сервера", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}
