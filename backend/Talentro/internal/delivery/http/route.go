package deliveryhttp

import (
	"github.com/go-chi/chi/v5"

	"talentro/internal/delivery/http/handlers"
)

func RegisterRoutes(
	r chi.Router,
	cardHandler *handlers.CardHandler,
	healthHandler *handlers.HealthHandler,
) {
	r.Get("/health", healthHandler.Health)
	r.Get("/api/cards", cardHandler.SearchCard)
}
