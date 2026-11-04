package deliveryhttp

import (
	"github.com/go-chi/chi/v5"

	"talentro/internal/delivery/http/handlers"
)

// §6.1 требует версию в путях, но `/api/cards` уже живёт в клиенте без версии.
// Поэтому: новые эндпоинты — под /api/v1, legacy остаётся на старом пути и
// помечен устаревшим, а не ломается молча.
func RegisterRoutes(
	r chi.Router,
	catalogHandler *handlers.CatalogHandler,
	healthHandler *handlers.HealthHandler,
	moderationHandler *handlers.ModerationHandler,
) {
	r.Get("/health", healthHandler.Health)
	r.Route("/api/v1", func(v1 chi.Router) {
		v1.Get("/activities", catalogHandler.Catalog)
		v1.Get("/activities/{slug}", catalogHandler.Activity)
		v1.Get("/categories", catalogHandler.Categories)
		v1.Get("/cities", catalogHandler.Cities)
		v1.Get("/districts", catalogHandler.Districts)
		v1.Get("/organizations/{slug}", catalogHandler.Organization)

		// Кабинет модерации (§3.9). Проверка роли — внутри каждого обработчика,
		// а не middleware на группе: только так 401 и 403 различимы и только так
		// роль читается из базы на каждый запрос (§12.1).
		v1.Route("/moderation", func(m chi.Router) {
			m.Post("/session", moderationHandler.Session)
			m.Get("/queue", moderationHandler.Queue)
			m.Get("/journal", moderationHandler.Journal)
			m.Get("/reports", moderationHandler.Reports)
			m.Post("/applications/{id}/decision", moderationHandler.Decide)
			m.Post("/reports/{id}/decision", moderationHandler.DecideReport)
		})
	})

	// Deprecated: читается фронтом с 2026-10. Алиасы живут на тех же обработчиках,
	// что и v1: ответ — канон, исторические поля в нём не меняли имя и тип.
	// Удаляются после перехода клиентов на /api/v1, а не молча ломаются.
	r.Get("/api/cards", catalogHandler.Cards)
	r.Get("/api/cards/{id}", catalogHandler.CardByID)
	r.Get("/api/categories", catalogHandler.Categories)
	r.Get("/api/cities", catalogHandler.Cities)
	r.Get("/api/organizations/{slug}", catalogHandler.Organization)
}
