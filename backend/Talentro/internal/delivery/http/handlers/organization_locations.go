package handlers

import (
	"database/sql"
	"errors"
	"github.com/go-chi/chi/v5"
	"log"
	"net/http"
	"strconv"
	"talentro/internal/repository"
)

func (h *AuthHandler) DeleteOrganizationLocation(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_id", "id филиала должен быть положительным числом")
		return
	}
	ownerID, _ := currentIdentity(r)
	err = h.repo.DeleteOrganizationLocation(ownerID, id)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		writeAPIError(w, http.StatusNotFound, "not_found", "филиал не найден")
	case errors.Is(err, repository.ErrOrganizationLocationInUse):
		writeAPIError(w, http.StatusConflict, "location_in_use", err.Error())
	case err != nil:
		log.Printf("DeleteOrganizationLocation: %v", err)
		writeAPIError(w, http.StatusInternalServerError, "internal_error", "не удалось удалить филиал")
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}
