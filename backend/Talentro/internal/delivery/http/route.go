package deliveryhttp

import (
	"net/http"
	"talentro/internal/delivery/http/handlers"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(
	r chi.Router,
	cardHandler *handlers.CardHandler,
	healthHandler *handlers.HealthHandler,
	authHandler *handlers.AuthHandler,
	mediaDir string,
) {
	r.Get("/health", healthHandler.Health)
	r.Get("/ready", healthHandler.Readiness)
	r.Handle("/media/*", http.StripPrefix(
		"/media/",
		http.FileServer(http.Dir(mediaDir)),
	))
	r.Get("/api/v1/activities/{id}/reviews", cardHandler.ActivityReviews)
	r.Get("/api/cards", cardHandler.SearchCard)
	r.Get("/api/v1/activities", cardHandler.SearchCard)
	r.Get("/api/v1/activities/{identifier}", cardHandler.GetActivity)
	r.Get("/api/v1/cities", cardHandler.Cities)
	r.Get("/api/v1/districts", cardHandler.Districts)
	r.Get("/api/v1/categories", cardHandler.Categories)
	r.Get("/api/v1/recommended", cardHandler.Recommended)
	r.Get("/api/v1/organizations/{id}", cardHandler.Organization)
	r.Post("/api/v1/auth/register", authHandler.Register)
	r.Post("/api/v1/auth/login", authHandler.Login)
	r.Group(func(protected chi.Router) {
		protected.Use(authHandler.RequireAuth)
		protected.Get("/api/v1/me", authHandler.Me)
		protected.Put("/api/v1/me", authHandler.UpdateMe)
		protected.Get("/api/v1/me/favorites", authHandler.Favorites)
		protected.Post("/api/v1/me/favorites", authHandler.AddFavorite)
		protected.Delete("/api/v1/me/favorites/{id}", authHandler.DeleteFavorite)
		protected.Post("/api/v1/activities/{id}/vote", authHandler.Vote)
	})
	r.Group(func(protected chi.Router) {
		protected.Use(authHandler.RequireAuth)
		protected.Use(authHandler.RequireRole("moderator"))
		protected.Get("/api/v1/moderation/activities", authHandler.ModerationQueue)
		protected.Post("/api/v1/moderation/activities/{id}/approve", authHandler.ApproveCard)
		protected.Post("/api/v1/moderation/activities/{id}/reject", authHandler.RejectCard)
	})
	r.Group(func(protected chi.Router) {
		protected.Use(authHandler.RequireAuth)
		protected.Use(authHandler.RequireAnyRole("section_owner", "service_owner"))
		protected.Post("/api/v1/me/activities", authHandler.CreateOwnedActivity)
		protected.Get("/api/v1/me/activities", authHandler.ListOwnedActivities)
		protected.Get("/api/v1/me/activities/{id}", authHandler.GetOwnedActivity)
		protected.Put("/api/v1/me/activities/{id}", authHandler.UpdateOwnedActivity)
		protected.Post("/api/v1/me/activities/{id}/submit", authHandler.SubmitOwnedActivity)
		protected.Post("/api/v1/me/activities/{id}/unpublish", authHandler.UnpublishOwnedActivity)
		protected.Post("/api/v1/upload", authHandler.UploadActivityPhoto)
		protected.Post("/api/v1/me/activities/{id}/videos", authHandler.UploadActivityVideo)
		protected.Post("/api/v1/activities/{id}/reviews", authHandler.CreateActivityReview)
		protected.Delete("/api/v1/me/activities/{id}/media/{mediaID}", authHandler.DeleteOwnedActivityMedia)

		protected.Get("/api/v1/me/organization", authHandler.MyOrganization)
		protected.Put("/api/v1/me/organization", authHandler.UpdateMyOrganization)
	})
}
