package deliveryhttp

import (
	"net/http"
	"sort"
	"testing"

	"github.com/go-chi/chi/v5"

	"talentro/internal/auth"
	"talentro/internal/config"
	"talentro/internal/delivery/http/handlers"
	"talentro/internal/repository"
)

// Таблица маршрутов — часть контракта (backend/Talentro/API.md), поэтому она под
// тестом: legacy-алиасы при рефакторинге теряются молча, а клиент замечает это
// уже на проде, когда путь отдаёт 404.
func TestRouteTable(t *testing.T) {
	store, err := auth.NewStore("test-secret")
	if err != nil {
		t.Fatalf("хранилище сессий: %v", err)
	}

	router := chi.NewRouter()
	RegisterRoutes(
		router,
		handlers.NewCatalogHandler(repository.New(nil)),
		handlers.NewHealthHandler(nil),
		handlers.NewAuthHandler(&config.Config{}, repository.New(nil), store),
	)

	got := map[string]bool{}
	if err := chi.Walk(router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		got[method+" "+route] = true
		return nil
	}); err != nil {
		t.Fatalf("обход маршрутов: %v", err)
	}

	want := []string{
		"GET /health",
		"GET /api/v1/activities",
		"GET /api/v1/activities/{slug}",
		"GET /api/v1/categories",
		"GET /api/v1/cities",
		"GET /api/v1/districts",
		"GET /api/v1/organizations/{slug}",
		"GET /api/cards",
		"GET /api/cards/{id}",
		"GET /api/categories",
		"GET /api/cities",
		"GET /api/organizations/{slug}",
		"POST /api/auth/google",
		"POST /api/auth/tester",
		"GET /api/auth/me",
		"POST /api/auth/logout",
	}

	missing := []string{}
	for _, route := range want {
		if !got[route] {
			missing = append(missing, route)
		}
	}
	if len(missing) > 0 {
		t.Errorf("маршруты пропали из контракта: %v", missing)
	}

	// Лишние маршруты — это тоже распущенный контракт: их читают клиенты, и
	// снимать их потом нечем, кроме как сломать чужой экран.
	inWant := map[string]bool{}
	for _, route := range want {
		inWant[route] = true
	}
	extra := []string{}
	for route := range got {
		if !inWant[route] {
			extra = append(extra, route)
		}
	}
	sort.Strings(extra)
	if len(extra) > 0 {
		t.Errorf("маршрутов нет в API.md: %v — обнови контракт или убери лишний", extra)
	}
}
