package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"talentro/internal/buildinfo"
)

type DBPinger interface {
	Ping(ctx context.Context) error
}

type HealthHandler struct {
	db DBPinger
}

func NewHealthHandler(db DBPinger) *HealthHandler {
	return &HealthHandler{
		db: db,
	}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"version": buildinfo.Version,
	})
}

func (h *HealthHandler) Readiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	err := h.db.Ping(ctx)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")

	if err != nil {
		log.Printf("Health check: database unavailable: %v", err)

		w.WriteHeader(http.StatusServiceUnavailable)

		json.NewEncoder(w).Encode(map[string]string{
			"status":   "error",
			"version":  buildinfo.Version,
			"database": "disconnected",
		})

		return
	}

	w.WriteHeader(http.StatusOK)

	json.NewEncoder(w).Encode(map[string]string{
		"status":   "ok",
		"version":  buildinfo.Version,
		"database": "connected",
	})
}
