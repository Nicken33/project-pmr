package deliveryhttp

import (
	"github.com/go-chi/chi/v5"

	"talentro/internal/delivery/http/handlers"
)

func RegisterRoutes(
	r chi.Router,
	cardHandler *handlers.CardHandler,
	healthHandler *handlers.HealthHandler,
	authHandler *handlers.AuthHandler,
) {
	r.Get("/health", healthHandler.Health)
	r.Get("/api/cards", cardHandler.SearchCard)
	r.Get("/api/cards/{id}", cardHandler.CardByID)
	r.Get("/api/categories", cardHandler.Dictionaries)
	r.Get("/api/cities", cardHandler.Cities)
	r.Post("/api/auth/google", authHandler.GoogleLogin)
	r.Post("/api/auth/tester", authHandler.TesterLogin)
	r.Get("/api/auth/me", authHandler.Me)
	r.Post("/api/auth/logout", authHandler.Logout)
}
