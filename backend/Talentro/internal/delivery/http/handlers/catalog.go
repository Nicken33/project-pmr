package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"talentro/internal/httpx"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// cachePublic — §9: публичные ответы отдаём с Cache-Control: public, max-age=60.
const cachePublic = "public, max-age=60"

type CatalogHandler struct {
	repo *repository.Repository
}

func NewCatalogHandler(repo *repository.Repository) *CatalogHandler {
	return &CatalogHandler{repo: repo}
}

// CatalogPage — форма ответа с пагинацией по §9 (page, limit, total).
type CatalogPage struct {
	Items []models.Card `json:"items"`
	Total int           `json:"total"`
	Page  int           `json:"page"`
	Limit int           `json:"limit"`
}

// Catalog — GET /api/v1/activities (§9.2).
func (h *CatalogHandler) Catalog(w http.ResponseWriter, r *http.Request) {
	f, cards, total, err := h.list(w, r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, CatalogPage{
		Items: cards, Total: total, Page: f.Page, Limit: f.Limit,
	})
}

// Cards — GET /api/cards: та же выборка, но историческая форма ответа — голый
// массив. total приезжает заголовком X-Total-Count, чтобы не менять тип ответа
// под уже написанным клиентом.
func (h *CatalogHandler) Cards(w http.ResponseWriter, r *http.Request) {
	_, cards, total, err := h.list(w, r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	w.Header().Set("X-Total-Count", strconv.Itoa(total))
	httpx.WriteJSON(w, http.StatusOK, cards)
}

// list разбирает фильтр и отдаёт страницу; заголовки кэша ставит здесь, чтобы
// оба эндпоинта кэшировались одинаково.
func (h *CatalogHandler) list(w http.ResponseWriter, r *http.Request) (models.CardFilter, []models.Card, int, error) {
	f, err := parseCardFilter(r.URL.Query())
	if err != nil {
		return f, nil, 0, err
	}

	cards, total, err := h.repo.SearchCards(f)
	if err != nil {
		return f, nil, 0, err
	}

	w.Header().Set("Cache-Control", cachePublic)
	w.Header().Set("ETag", listETag(cards, total))
	return f, cards, total, nil
}

// Activity — GET /api/v1/activities/{slug} (§9.3): карточка целиком.
func (h *CatalogHandler) Activity(w http.ResponseWriter, r *http.Request) {
	key, ok := pathKey(w, "slug", chi.URLParam(r, "slug"), "занятие не найдено")
	if !ok {
		return
	}
	h.writeActivity(w, r, key)
}

// CardByID — legacy-алиас GET /api/cards/{id}. Ответ — каноническая карточка
// целиком: исторические поля в ней сохранены по именам и типам, новые только
// добавились, поэтому старому клиенту ломаться не на чем.
func (h *CatalogHandler) CardByID(w http.ResponseWriter, r *http.Request) {
	key, ok := pathKey(w, "id", chi.URLParam(r, "id"), "занятие не найдено")
	if !ok {
		return
	}
	h.writeActivity(w, r, key)
}

// pathKey проверяет параметр пути: пустой — 404, байты вне UTF-8 — 400 с именем
// того параметра, который клиент действительно передал. Postgres такой мусор
// отвергает сам, но без проверки ответ был бы 500 вместо честного 400 (§9.3).
func pathKey(w http.ResponseWriter, param, raw, missing string) (string, bool) {
	key := strings.TrimSpace(raw)
	if key == "" {
		httpx.WriteError(w, httpx.NewNotFound(missing))
		return "", false
	}
	if !utf8.ValidString(key) {
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			param: param + " должен быть корректной строкой в UTF-8",
		}))
		return "", false
	}
	return key, true
}

func (h *CatalogHandler) writeActivity(w http.ResponseWriter, r *http.Request, key string) {
	activity, err := h.repo.ActivityBySlug(key)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			httpx.WriteError(w, httpx.NewNotFound("занятие не найдено или снято с публикации"))
			return
		}
		httpx.WriteError(w, err)
		return
	}

	w.Header().Set("Cache-Control", cachePublic)
	etag := cardETag(activity.ID, activity.UpdatedAt)
	w.Header().Set("ETag", etag)
	if matchAny(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, activity)
}

// Organization — страница организации: она плюс её опубликованные занятия.
// Работает на /api/v1/organizations/{slug} и на legacy /api/organizations/{slug}.
func (h *CatalogHandler) Organization(w http.ResponseWriter, r *http.Request) {
	key, ok := pathKey(w, "slug", chi.URLParam(r, "slug"), "организация не найдена")
	if !ok {
		return
	}

	page, err := h.repo.OrganizationBySlug(key)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			httpx.WriteError(w, httpx.NewNotFound("организация не найдена или снята с публикации"))
			return
		}
		httpx.WriteError(w, err)
		return
	}

	w.Header().Set("Cache-Control", cachePublic)
	httpx.WriteJSON(w, http.StatusOK, page)
}

// Cities — GET /api/v1/cities (§9.6).
func (h *CatalogHandler) Cities(w http.ResponseWriter, r *http.Request) {
	cities, err := h.repo.Cities()
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	w.Header().Set("Cache-Control", cachePublic)
	httpx.WriteJSON(w, http.StatusOK, cities)
}

// Categories — GET /api/v1/categories (§9.5).
func (h *CatalogHandler) Categories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.repo.Categories()
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	w.Header().Set("Cache-Control", cachePublic)
	httpx.WriteJSON(w, http.StatusOK, categories)
}

// Districts — GET /api/v1/districts?city= (§9.6).
func (h *CatalogHandler) Districts(w http.ResponseWriter, r *http.Request) {
	city := strings.TrimSpace(r.URL.Query().Get("city"))
	if city == "" {
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			"city": "районы отдаются только для конкретного города (§5.4)",
		}))
		return
	}
	if !utf8.ValidString(city) {
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			"city": "city должен быть корректной строкой в UTF-8",
		}))
		return
	}

	districts, err := h.repo.Districts(city)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	w.Header().Set("Cache-Control", cachePublic)
	httpx.WriteJSON(w, http.StatusOK, districts)
}
