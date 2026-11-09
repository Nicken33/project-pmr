package deliveryhttp

import (
	"github.com/go-chi/chi/v5"

	"talentro/internal/delivery/http/handlers"
)

// §6.1 требует версию в путях, но `/api/cards` уже живёт в клиенте без версии.
// Поэтому: новые эндпоинты — под /api/v1, legacy остаётся на старом пути и
// помечен устаревшим, а не ломается молча.
//
// Auth-срез в версиях не участвует: вход читают и витрина, и мобильный клиент
// одинаково, а §3.7 не знает второго варианта пути.
func RegisterRoutes(
	r chi.Router,
	catalogHandler *handlers.CatalogHandler,
	healthHandler *handlers.HealthHandler,
	authHandler *handlers.AuthHandler,
	moderationHandler *handlers.ModerationHandler,
	ownerHandler *handlers.OwnerHandler,
	mediaHandler *handlers.MediaHandler,
) {
	r.Get("/health", healthHandler.Health)

	// Медиа раздаёт сам Go-сервис: на хосте без reverse proxy (Vercel + отдельный
	// API) файлы иначе неоткуда взять. HEAD зарегистрирован отдельно — проверки
	// деплоя спрашивают именно его (`curl -I`), а chi на Get отвечает 405.
	r.Get("/media/*", mediaHandler.Serve)
	r.Head("/media/*", mediaHandler.Serve)

	r.Route("/api/v1", func(v1 chi.Router) {
		v1.Get("/activities", catalogHandler.Catalog)
		v1.Get("/activities/{slug}", catalogHandler.Activity)
		v1.Get("/categories", catalogHandler.Categories)
		v1.Get("/cities", catalogHandler.Cities)
		v1.Get("/districts", catalogHandler.Districts)
		v1.Get("/organizations/{slug}", catalogHandler.Organization)

		// Кабинет модерации (§3.9). Куку `talentro_session` выдаёт auth-срез
		// (POST /api/auth/login), здесь она только читается: второй реализации
		// сессии в проекте не место. Проверка роли — внутри каждого обработчика,
		// а не middleware на группе: только так 401 и 403 различимы и только так
		// роль перечитывается из базы на каждый запрос (§12.1).
		v1.Route("/moderation", func(m chi.Router) {
			m.Get("/queue", moderationHandler.Queue)
			m.Get("/journal", moderationHandler.Journal)
			m.Get("/reports", moderationHandler.Reports)
			m.Post("/applications/{id}/decision", moderationHandler.Decide)
			m.Post("/reports/{id}/decision", moderationHandler.DecideReport)
		})

		// Кабинет владельца. Роль и владение проверяются внутри обработчиков по
		// той же причине, что у модерации: 401 и 403 обязаны различаться, а роль
		// перечитывается из базы на каждый запрос. Подача анкеты пишет строку в
		// moderation_applications — своей очереди у владельца нет.
		v1.Route("/me", func(me chi.Router) {
			me.Get("/activities", ownerHandler.ListActivities)
			me.Post("/activities", ownerHandler.CreateActivity)
			me.Get("/activities/{id}", ownerHandler.Activity)
			me.Put("/activities/{id}", ownerHandler.UpdateActivity)
			me.Post("/activities/{id}/submit", ownerHandler.SubmitActivity)
			me.Post("/activities/{id}/unpublish", ownerHandler.UnpublishActivity)
			me.Get("/organization", ownerHandler.Organization)
			me.Put("/organization", ownerHandler.UpdateOrganization)

			// Загрузки идут через тот же /me, а не отдельным /api/v1/upload:
			// право писать файл выводится из владения анкетой, поэтому id анкеты
			// обязан быть в пути до того, как тело запроса прочитано.
			me.Post("/activities/{id}/photos", mediaHandler.UploadPhoto)
			me.Post("/activities/{id}/videos", mediaHandler.UploadVideo)
			me.Delete("/activities/{id}/media/{mediaID}", mediaHandler.DeleteMedia)
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

	// Сессия: единственная кука, по которой сервер отличает тестовый режим
	// от витрины. Пути без версии — как в auth-срезе #16 и в веб-клиенте.
	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)
	r.Post("/api/auth/google", authHandler.GoogleLogin)
	r.Post("/api/auth/tester", authHandler.TesterLogin)
	r.Get("/api/auth/me", authHandler.Me)
	r.Post("/api/auth/logout", authHandler.Logout)
}
