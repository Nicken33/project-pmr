package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"talentro/internal/models"
)

func (h *CardHandler) Cities(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListCities()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить города")
		return
	}
	writeJSON(w, items)
}

func (h *CardHandler) Districts(w http.ResponseWriter, r *http.Request) {
	var cityID *int64
	if raw := r.URL.Query().Get("city"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			writeAPIError(w, http.StatusBadRequest, "invalid_query", "параметр city должен быть положительным целым ID")
			return
		}
		cityID = &id
	}
	items, err := h.repo.ListDistricts(cityID)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить районы")
		return
	}
	writeJSON(w, items)
}

func (h *CardHandler) Categories(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListDirections()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить направления")
		return
	}
	writeJSON(w, makeCategoryTree(items))
}

func (h *CardHandler) Recommended(w http.ResponseWriter, r *http.Request) {
	city := r.URL.Query().Get("city")
	if city != "" {
		if err := validatePositiveID("city", city); err != nil {
			writeAPIError(w, http.StatusBadRequest, "invalid_query", err.Error())
			return
		}
	}
	result, err := h.repo.Recommendations(city)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить рекомендации")
		return
	}
	writeJSON(w, result)
}

func (h *CardHandler) Organization(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id должен быть положительным целым числом")
		return
	}
	organization, err := h.repo.GetOrganization(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeAPIError(w, http.StatusNotFound, "not_found", "организация не найдена")
			return
		}
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось получить организацию")
		return
	}
	writeJSON(w, organization)
}

func makeCategoryTree(items []models.Reference) []models.Category {
	byID := make(map[int64]models.Reference, len(items))
	children := make(map[int64][]int64, len(items))
	roots := make([]int64, 0)
	for _, item := range items {
		byID[item.ID] = item
	}
	for _, item := range items {
		if item.ParentID == nil || byID[*item.ParentID].ID == 0 {
			roots = append(roots, item.ID)
			continue
		}
		children[*item.ParentID] = append(children[*item.ParentID], item.ID)
	}
	var build func(int64, map[int64]bool) models.Category
	build = func(id int64, stack map[int64]bool) models.Category {
		item := byID[id]
		category := models.Category{ID: item.ID, Name: item.Name, RecordType: item.RecordType, SortOrder: item.SortOrder}
		if stack[id] {
			return category
		}
		stack[id] = true
		for _, childID := range children[id] {
			category.Children = append(category.Children, build(childID, stack))
		}
		delete(stack, id)
		return category
	}
	tree := make([]models.Category, 0, len(roots))
	for _, id := range roots {
		tree = append(tree, build(id, make(map[int64]bool)))
	}
	return tree
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(value)
}
