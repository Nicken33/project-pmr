package handlers

import (
	"encoding/json"
	"net/http"
	"talentro/internal/repository"
)

type SectionHandler struct {
	repo *repository.Repository
}

func NewSectionHandler(repo *repository.Repository) *SectionHandler {
	return &SectionHandler{repo: repo}
}

func (h *SectionHandler) GetSectionsHandler(w http.ResponseWriter, r *http.Request) {
	sections, err := h.repo.GetSections()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	json.NewEncoder(w).Encode(sections)
}
