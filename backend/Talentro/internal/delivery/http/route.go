package deliveryhttp

import (
	"github.com/go-chi/chi/v5"

	"talentro/internal/delivery/http/handlers"
)

func RegisterRoutes(
	r chi.Router,
	activityHandler *handlers.ActivityHandler,
	healthHandler *handlers.HealthHandler,
) {
	r.Get("/health", healthHandler.Health)
	r.Get("/api/activities", activityHandler.SearchActivity)
}
