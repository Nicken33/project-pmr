package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"talentro/internal/auth"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// Кабинет владельца (§3.8) под тестом без Postgres: ownerStore — тот же шов, что
// moderationStore у кабинета модерации, поэтому таблица прав (401/403/404/409/503)
// проверяется на фейке, который повторяет семантику internal/repository/owned_activities.go.
// SQL самих запросов этим не покрыт: он проверяется интеграционно, при живом
// DATABASE_URL, как и repository/moderation_test.go.
const (
	ownerSecret = "тестовый-секрет-кабинета-владельца"

	ownerActivityUser int64 = 7  // account_type = owner_activity
	ownerServiceUser  int64 = 8  // account_type = owner_service
	plainUser         int64 = 9  // account_type = user
	moderatorUser     int64 = 10 // account_type = moderator
	foreignOwner      int64 = 11 // чужой owner_activity

	ownerOrgID   int64 = 100 // принадлежит ownerActivityUser
	serviceOrgID int64 = 101 // принадлежит ownerServiceUser
	foreignOrgID int64 = 102 // принадлежит foreignOwner

	draftCardID       int64 = 500
	publishedCardID   int64 = 501
	rejectedCardID    int64 = 502
	onModerationID    int64 = 503
	serviceCardID     int64 = 504
	foreignCardID     int64 = 505
	mismatchedCardID  int64 = 506 // услуга, но owner_id = ownerActivityUser
	missingCardID     int64 = 999
	categoryBoth      int64 = 10
	categoryService   int64 = 900
	categoryActivity  int64 = 901
	unknownCategoryID int64 = 4242
	tiraspolCityID    int64 = 1
	unknownCityID     int64 = 4242
)

// var_ — проверка, что фейк действительно закрывает шов, а не «почти совпадает».
var _ ownerStore = (*fakeOwnerStore)(nil)

type fakeApplication struct {
	ID          int64
	CardID      int64
	SubmittedBy int64
	Status      string
	SubmittedAt time.Time
}

type fakeOwnerCard struct {
	row          models.OwnedCard
	organization *models.Organization
	groups       []models.Group
	locations    []models.Location
	photos       []models.OwnedMedia
	videos       []models.OwnedMedia
}

type fakeOwnerStore struct {
	mu           sync.Mutex
	accounts     map[int64]models.Account
	orgs         map[int64]*models.OwnedOrganization
	cards        map[int64]*fakeOwnerCard
	categories   map[int64]string
	cities       map[int64]bool
	applications []fakeApplication
	nextID       int64
	schemaReady  bool

	// Что обработчик действительно передал в хранилище: идентичность берётся из
	// сессии, а не из тела, и это видно только по аргументам вызова.
	lastFilter      models.OwnedCardsFilter
	lastCreateOwner int64
	lastCreateInput models.OwnedCardInput
	lastOrgInput    models.OwnedOrganizationInput
	lastOrgOwner    int64

	accountErr error
	schemaErr  error
	listErr    error
}

func newFakeOwnerStore() *fakeOwnerStore {
	f := &fakeOwnerStore{
		accounts: map[int64]models.Account{
			ownerActivityUser: {ID: ownerActivityUser, Name: "Владелец секции", Email: "owner@example.com", Role: models.RoleOwnerActivity},
			ownerServiceUser:  {ID: ownerServiceUser, Name: "Мастер", Email: "master@example.com", Role: models.RoleOwnerService},
			plainUser:         {ID: plainUser, Name: "Посетитель", Email: "user@example.com", Role: "user"},
			moderatorUser:     {ID: moderatorUser, Name: "Модератор", Email: "moder@example.com", Role: models.RoleModerator},
			foreignOwner:      {ID: foreignOwner, Name: "Чужой владелец", Email: "other@example.com", Role: models.RoleOwnerActivity},
		},
		orgs: map[int64]*models.OwnedOrganization{
			ownerOrgID: {
				Organization: models.Organization{
					ID: ownerOrgID, Slug: "studiya-rostok", Name: "Студия «Росток»", Type: "студия",
					Phone: "+373 533 12345", City: ownerStrPtr("Тирасполь"),
				},
				CityID: ownerInt64Ptr(tiraspolCityID), OwnerID: ownerInt64Ptr(ownerActivityUser),
				PublishBasis: "provided_by_owner", IsActive: true,
				CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
				UpdatedAt: time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC),
			},
			serviceOrgID: {
				Organization: models.Organization{
					ID: serviceOrgID, Slug: "master-ivan", Name: "Мастер Иван", Type: "частный мастер",
					Phone: "+373 533 99999",
				},
				OwnerID: ownerInt64Ptr(ownerServiceUser), PublishBasis: "provided_by_owner", IsActive: true,
			},
			foreignOrgID: {
				Organization: models.Organization{
					ID: foreignOrgID, Slug: "chuzhaya-shkola", Name: "Чужая школа", Type: "школа",
					Phone: "+373 533 00000",
				},
				OwnerID: ownerInt64Ptr(foreignOwner), PublishBasis: "provided_by_owner", IsActive: true,
			},
		},
		categories: map[int64]string{
			categoryBoth:     "both",
			categoryService:  "service",
			categoryActivity: "activity",
		},
		cities:      map[int64]bool{tiraspolCityID: true, 2: true},
		cards:       map[int64]*fakeOwnerCard{},
		nextID:      600,
		schemaReady: true,
	}

	f.seedCard(draftCardID, ownerActivityUser, ownerOrgID, models.CardKindActivity, models.CardStatusDraft)
	f.seedCard(publishedCardID, ownerActivityUser, ownerOrgID, models.CardKindActivity, models.CardStatusPublished)
	f.seedCard(rejectedCardID, ownerActivityUser, ownerOrgID, models.CardKindActivity, models.CardStatusRejected)
	f.cards[rejectedCardID].row.RejectReason = ownerStrPtr("нет телефона у точки")
	f.seedCard(onModerationID, ownerActivityUser, ownerOrgID, models.CardKindActivity, models.CardStatusOnModeration)
	f.seedCard(serviceCardID, ownerServiceUser, serviceOrgID, models.CardKindService, models.CardStatusDraft)
	f.seedCard(foreignCardID, foreignOwner, foreignOrgID, models.CardKindActivity, models.CardStatusDraft)
	f.seedCard(mismatchedCardID, ownerActivityUser, ownerOrgID, models.CardKindService, models.CardStatusDraft)

	// Превью детали — каноническая форма §9.3: группы с расписанием, точки, медиа.
	detail := f.cards[draftCardID]
	detail.organization = &f.orgs[ownerOrgID].Organization
	detail.locations = []models.Location{{
		ID: 300, City: "Тирасполь", Address: "ул. Ленина, 1",
		Lat: ownerFloatPtr(46.84), Lng: ownerFloatPtr(29.64), GroupsCount: 1, Photos: []models.Media{},
	}}
	detail.groups = []models.Group{{
		ID: 400, LocationID: 300, AgeFrom: ownerIntPtr(7), AgeTo: ownerIntPtr(10),
		PriceFrom: ownerIntPtr(150), PricePeriod: ownerStrPtr("month"), Seats: ownerIntPtr(12),
		Schedules: []models.Lesson{{Weekday: 1, TimeFrom: "17:00", TimeTo: "18:30"}},
	}}
	detail.photos = []models.OwnedMedia{{ID: 900, Media: models.Media{Path: "/media/cards/500-1.jpg", Order: 0}}}
	detail.videos = []models.OwnedMedia{{ID: 901, Media: models.Media{Path: "/media/cards/500-1.mp4", Order: 0}}}
	return f
}

func (f *fakeOwnerStore) seedCard(id, ownerID, orgID int64, kind, status string) {
	f.cards[id] = &fakeOwnerCard{
		row: models.OwnedCard{
			Card: models.Card{
				ID: ownerIDText(id), Slug: "card-" + ownerIDText(id), Name: "Занятие " + ownerIDText(id), Kind: kind,
				OrganizationID: orgID, OrganizationSlug: f.orgs[orgID].Slug, OrganizationName: f.orgs[orgID].Name,
				OrganizationType: f.orgs[orgID].Type, CategoryID: ownerInt64Ptr(categoryBoth),
				Category: ownerStrPtr("Рисование"), Format: "offline", Status: status,
				UpdatedAt: time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC),
			},
			OwnerID: ownerInt64Ptr(ownerID), IsActive: true,
			CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		},
		groups: []models.Group{}, locations: []models.Location{},
		photos: []models.OwnedMedia{}, videos: []models.OwnedMedia{},
	}
}

func (f *fakeOwnerStore) AccountByID(_ context.Context, id int64) (models.Account, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.accountErr != nil {
		return models.Account{}, f.accountErr
	}
	acc, ok := f.accounts[id]
	if !ok {
		return models.Account{}, repository.ErrNotFound
	}
	return acc, nil
}

func (f *fakeOwnerStore) ModerationSchemaReady(_ context.Context) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.schemaReady, f.schemaErr
}

func (f *fakeOwnerStore) orgOfOwner(ownerID int64) *models.OwnedOrganization {
	ids := make([]int64, 0, len(f.orgs))
	for id := range f.orgs {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	for _, id := range ids {
		org := f.orgs[id]
		if org.OwnerID != nil && *org.OwnerID == ownerID {
			return org
		}
	}
	return nil
}

func (f *fakeOwnerStore) OwnedCards(_ context.Context, ownerID int64, filter models.OwnedCardsFilter) ([]models.OwnedCard, int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastFilter = filter
	if f.listErr != nil {
		return nil, 0, f.listErr
	}

	ids := make([]int64, 0, len(f.cards))
	for id, c := range f.cards {
		if c.row.OwnerID == nil || *c.row.OwnerID != ownerID || c.row.Kind != filter.Kind {
			continue
		}
		if filter.Status != "" && c.row.Status != filter.Status {
			continue
		}
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] > ids[j] })

	total := len(ids)
	items := make([]models.OwnedCard, 0)
	start := (filter.Page - 1) * filter.Limit
	for i, id := range ids {
		if i < start || i >= start+filter.Limit {
			continue
		}
		items = append(items, f.cards[id].row)
	}
	return items, total, nil
}

// lock — общий вход фейка для одиночной карточки: 404, 403 (не владелец) и 403
// (роль не того типа) различимы, как в repository.lockOwnedCard.
func (f *fakeOwnerStore) lock(ownerID, cardID int64, kind string) (*fakeOwnerCard, error) {
	c, ok := f.cards[cardID]
	if !ok {
		return nil, repository.ErrNotFound
	}
	if c.row.OwnerID == nil || *c.row.OwnerID != ownerID {
		return nil, repository.ErrCardNotOwned
	}
	if c.row.Kind != kind {
		return nil, repository.ErrKindMismatch
	}
	return c, nil
}

func (f *fakeOwnerStore) OwnedCardByID(_ context.Context, ownerID, cardID int64, kind string) (*models.OwnedActivity, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, err := f.lock(ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	out := &models.OwnedActivity{
		OwnedCard:    c.row,
		Organization: c.organization,
		Groups:       append([]models.Group{}, c.groups...),
		Locations:    append([]models.Location{}, c.locations...),
		Photos:       append([]models.OwnedMedia{}, c.photos...),
		Videos:       append([]models.OwnedMedia{}, c.videos...),
	}
	return out, nil
}

func (f *fakeOwnerStore) CreateOwnedCard(_ context.Context, ownerID int64, in models.OwnedCardInput) (*models.OwnedCard, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastCreateOwner, f.lastCreateInput = ownerID, in

	orgID := int64(0)
	if in.OrgID != nil {
		org, ok := f.orgs[*in.OrgID]
		if !ok {
			return nil, repository.ErrNotFound
		}
		if org.OwnerID == nil || *org.OwnerID != ownerID {
			return nil, repository.ErrOrgNotOwned
		}
		orgID = org.ID
	} else {
		org := f.orgOfOwner(ownerID)
		if org == nil {
			return nil, repository.ErrNoOwnerOrganization
		}
		orgID = org.ID
	}

	catKind, ok := f.categories[*in.CategoryID]
	if !ok {
		return nil, repository.ErrCategoryUnknown
	}
	if catKind != "both" && catKind != in.Kind {
		return nil, repository.ErrCategoryKind
	}

	id := f.nextID
	f.nextID++
	row := models.OwnedCard{
		Card: models.Card{
			ID: ownerIDText(id), Slug: "zanatie-" + ownerIDText(id), Name: in.Name, Kind: in.Kind,
			OrganizationID: orgID, OrganizationSlug: f.orgs[orgID].Slug, OrganizationName: f.orgs[orgID].Name,
			OrganizationType: f.orgs[orgID].Type, CategoryID: in.CategoryID, Category: ownerStrPtr("Рисование"),
			Description: in.Description, Format: in.Format, LessonType: in.LessonType,
			Status: models.CardStatusDraft, UpdatedAt: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		},
		OwnerID: ownerInt64Ptr(ownerID), IsActive: true,
		CreatedAt: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
	}
	if in.Phone != nil {
		row.Phone = *in.Phone
	}
	f.cards[id] = &fakeOwnerCard{
		row: row, organization: &f.orgs[orgID].Organization,
		groups: []models.Group{}, locations: []models.Location{},
		photos: []models.OwnedMedia{}, videos: []models.OwnedMedia{},
	}
	return &row, nil
}

func (f *fakeOwnerStore) UpdateOwnedCard(_ context.Context, ownerID, cardID int64, kind string, in models.OwnedCardInput) (*models.OwnedCard, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, err := f.lock(ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	if c.row.Status != models.CardStatusDraft && c.row.Status != models.CardStatusRejected {
		return nil, &repository.CardStatusError{Status: c.row.Status, Action: repository.CardActionUpdate}
	}
	if in.OrgID != nil && *in.OrgID != c.row.OrganizationID {
		return nil, repository.ErrOrgNotOwned
	}
	if _, ok := f.categories[*in.CategoryID]; !ok {
		return nil, repository.ErrCategoryUnknown
	}
	c.row.Name = in.Name
	c.row.Description = in.Description
	c.row.CategoryID = in.CategoryID
	c.row.Format = in.Format
	c.row.LessonType = in.LessonType
	c.row.UpdatedAt = time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	row := c.row
	return &row, nil
}

func (f *fakeOwnerStore) SubmitOwnedCard(_ context.Context, ownerID, cardID int64, kind string) (*models.OwnedSubmitResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, err := f.lock(ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	if c.row.Status != models.CardStatusDraft && c.row.Status != models.CardStatusRejected {
		return nil, &repository.CardStatusError{Status: c.row.Status, Action: repository.CardActionSubmit}
	}
	now := time.Date(2026, 3, 3, 12, 0, 0, 0, time.UTC)
	appID := int64(len(f.applications) + 1)
	f.applications = append(f.applications, fakeApplication{
		ID: appID, CardID: cardID, SubmittedBy: ownerID,
		Status: models.ApplicationPending, SubmittedAt: now,
	})
	c.row.Status = models.CardStatusOnModeration
	c.row.IsActive = true
	c.row.RejectReason = nil
	row := c.row
	return &models.OwnedSubmitResult{Card: row, ApplicationID: appID, SubmittedAt: now}, nil
}

func (f *fakeOwnerStore) UnpublishOwnedCard(_ context.Context, ownerID, cardID int64, kind string) (*models.OwnedCard, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, err := f.lock(ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	if c.row.Status != models.CardStatusPublished {
		return nil, &repository.CardStatusError{Status: c.row.Status, Action: repository.CardActionUnpublish}
	}
	c.row.Status = models.CardStatusDraft
	c.row.IsActive = false
	row := c.row
	return &row, nil
}

func (f *fakeOwnerStore) OwnedOrganization(_ context.Context, ownerID int64) (*models.OwnedOrganization, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	org := f.orgOfOwner(ownerID)
	if org == nil {
		return nil, repository.ErrNotFound
	}
	out := *org
	return &out, nil
}

func (f *fakeOwnerStore) UpdateOwnedOrganization(_ context.Context, ownerID int64, in models.OwnedOrganizationInput) (*models.OwnedOrganization, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastOrgOwner, f.lastOrgInput = ownerID, in
	org := f.orgOfOwner(ownerID)
	if org == nil {
		return nil, repository.ErrNotFound
	}
	if in.CityID != nil && !f.cities[*in.CityID] {
		return nil, repository.ErrCityUnknown
	}
	org.Name = in.Name
	org.Type = in.Type
	org.Description = in.Description
	org.Phone = in.Phone
	org.Email = in.Email
	org.Site = in.Site
	org.Address = in.Address
	org.CityID = in.CityID
	org.Lat = in.Lat
	org.Lng = in.Lng
	org.UpdatedAt = time.Date(2026, 3, 4, 0, 0, 0, 0, time.UTC)
	out := *org
	return &out, nil
}

// ownerHarness — обработчик плюс маршруты кабинета. Таблица маршрутов здесь
// своя: route.go ведёт интегратор, а тестам нужен chi.URLParam для {id}.
type ownerHarness struct {
	t        *testing.T
	store    *fakeOwnerStore
	sessions *auth.Store
	handler  *OwnerHandler
	router   chi.Router
}

func newOwnerHarness(t *testing.T, opts ...OwnerOption) *ownerHarness {
	t.Helper()

	store := newFakeOwnerStore()
	sessions, err := auth.NewStore(ownerSecret)
	if err != nil {
		t.Fatalf("хранилище сессий: %v", err)
	}
	all := append([]OwnerOption{WithOwnerSessions(sessions)}, opts...)
	h := &ownerHarness{
		t: t, store: store, sessions: sessions,
		handler: NewOwnerHandler(store, all...),
	}
	r := chi.NewRouter()
	r.Get("/api/v1/me/activities", h.handler.ListActivities)
	r.Post("/api/v1/me/activities", h.handler.CreateActivity)
	r.Get("/api/v1/me/activities/{id}", h.handler.Activity)
	r.Put("/api/v1/me/activities/{id}", h.handler.UpdateActivity)
	r.Post("/api/v1/me/activities/{id}/submit", h.handler.SubmitActivity)
	r.Post("/api/v1/me/activities/{id}/unpublish", h.handler.UnpublishActivity)
	r.Get("/api/v1/me/organization", h.handler.Organization)
	r.Put("/api/v1/me/organization", h.handler.UpdateOrganization)
	h.router = r
	return h
}

// cookie — подписанная кука той же схемы, что выдаёт auth-срез: второй
// реализации сессии в проекте нет, поэтому тест подписывает настоящим Store.
func (h *ownerHarness) cookie(userID int64, role string) *http.Cookie {
	h.t.Helper()
	value, err := h.sessions.Encode(auth.Claims{
		UserID: userID, Role: role, Provider: "local",
		Exp: time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		h.t.Fatalf("подпись сессии: %v", err)
	}
	return &http.Cookie{Name: auth.CookieName, Value: value}
}

func (h *ownerHarness) ownerCookie() *http.Cookie {
	return h.cookie(ownerActivityUser, models.RoleOwnerActivity)
}

func (h *ownerHarness) do(method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
	h.t.Helper()
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("")
	} else {
		reader = strings.NewReader(body)
	}
	r := httptest.NewRequest(method, path, reader)
	r.Header.Set("Content-Type", "application/json")
	if cookie != nil {
		r.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, r)
	return rec
}

func ownerJSON(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("ответ не разбирается как JSON: %v (%s)", err, rec.Body.String())
	}
	return out
}

func wantOwnerStatus(t *testing.T, rec *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rec.Code != want {
		e := decodeEnvelope(t, rec)
		t.Fatalf("код = %d, ждали %d; сообщение %q, поля %v", rec.Code, want, e.Error.Message, e.Error.Fields)
	}
}

// wantPrivate — кабинет приватен целиком, включая отказы: общий кэш не должен
// отдать одному владельцу чужой список, а 401/403 кэшируются так же плохо.
func wantPrivate(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if got := rec.Header().Get("Cache-Control"); got != cachePrivate {
		t.Errorf("Cache-Control = %q, ждали %q", got, cachePrivate)
	}
	if got := rec.Header().Get("Vary"); !strings.Contains(got, varyCookie) {
		t.Errorf("Vary = %q, ждали упоминания %q", got, varyCookie)
	}
}

// Имена тестовых помощников с префиксом owner: пакет handlers общий, и простые
// strPtr/intPtr столкнулись бы с помощниками соседнего среза.
func ownerStrPtr(s string) *string     { return &s }
func ownerIntPtr(v int) *int           { return &v }
func ownerInt64Ptr(v int64) *int64     { return &v }
func ownerFloatPtr(v float64) *float64 { return &v }

func ownerIDText(v int64) string { return strconv.FormatInt(v, 10) }

// ownerEndpoints — вся таблица кабинета одним списком: матрица прав обязана
// пройти по каждому пути, а не только по списку карточек.
func ownerEndpoints() []struct {
	method string
	path   string
	body   string
} {
	return []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/api/v1/me/activities", ""},
		{http.MethodPost, "/api/v1/me/activities", `{"name":"Шахматы","category_id":10}`},
		{http.MethodGet, "/api/v1/me/activities/500", ""},
		{http.MethodPut, "/api/v1/me/activities/500", `{"name":"Шахматы","category_id":10}`},
		{http.MethodPost, "/api/v1/me/activities/500/submit", ""},
		{http.MethodPost, "/api/v1/me/activities/501/unpublish", ""},
		{http.MethodGet, "/api/v1/me/organization", ""},
		{http.MethodPut, "/api/v1/me/organization", `{"name":"Студия","type":"студия","phone":"+373 533 12345"}`},
	}
}

// TestOwnerCabinetAuthMatrix — 401 (нет/битая кука, удалённая учётная запись),
// 403 (не та роль, роль в куке против роли в базе), 503 (сессии не настроены).
// Роль перечитывается из users на каждый запрос: живая кука не помогает.
func TestOwnerCabinetAuthMatrix(t *testing.T) {
	for _, ep := range ownerEndpoints() {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			t.Run("без куки", func(t *testing.T) {
				h := newOwnerHarness(t)
				rec := h.do(ep.method, ep.path, ep.body, nil)
				wantOwnerStatus(t, rec, http.StatusUnauthorized)
				wantPrivate(t, rec)
			})
			t.Run("битая кука", func(t *testing.T) {
				h := newOwnerHarness(t)
				rec := h.do(ep.method, ep.path, ep.body, &http.Cookie{Name: auth.CookieName, Value: "мусор.подпись"})
				wantOwnerStatus(t, rec, http.StatusUnauthorized)
				wantPrivate(t, rec)
			})
			t.Run("кука подписана чужим секретом", func(t *testing.T) {
				h := newOwnerHarness(t)
				other, err := auth.NewStore("другой-секрет-не-подойдёт")
				if err != nil {
					t.Fatalf("хранилище сессий: %v", err)
				}
				value, err := other.Encode(auth.Claims{UserID: ownerActivityUser, Role: models.RoleOwnerActivity, Exp: time.Now().Add(time.Hour).Unix()})
				if err != nil {
					t.Fatalf("подпись: %v", err)
				}
				rec := h.do(ep.method, ep.path, ep.body, &http.Cookie{Name: auth.CookieName, Value: value})
				wantOwnerStatus(t, rec, http.StatusUnauthorized)
			})
			t.Run("просроченная кука", func(t *testing.T) {
				h := newOwnerHarness(t)
				value, err := h.sessions.Encode(auth.Claims{UserID: ownerActivityUser, Role: models.RoleOwnerActivity, Exp: time.Now().Add(-time.Hour).Unix()})
				if err == nil {
					rec := h.do(ep.method, ep.path, ep.body, &http.Cookie{Name: auth.CookieName, Value: value})
					wantOwnerStatus(t, rec, http.StatusUnauthorized)
				}
			})
			t.Run("сессии не настроены", func(t *testing.T) {
				store := newFakeOwnerStore()
				handler := NewOwnerHandler(store) // без WithOwnerSessions
				r := chi.NewRouter()
				r.Get("/api/v1/me/activities", handler.ListActivities)
				r.Post("/api/v1/me/activities", handler.CreateActivity)
				r.Get("/api/v1/me/activities/{id}", handler.Activity)
				r.Put("/api/v1/me/activities/{id}", handler.UpdateActivity)
				r.Post("/api/v1/me/activities/{id}/submit", handler.SubmitActivity)
				r.Post("/api/v1/me/activities/{id}/unpublish", handler.UnpublishActivity)
				r.Get("/api/v1/me/organization", handler.Organization)
				r.Put("/api/v1/me/organization", handler.UpdateOrganization)

				req := httptest.NewRequest(ep.method, ep.path, strings.NewReader(ep.body))
				rec := httptest.NewRecorder()
				r.ServeHTTP(rec, req)
				wantOwnerStatus(t, rec, http.StatusServiceUnavailable)
				wantPrivate(t, rec)
			})
			for _, role := range []string{"user", models.RoleModerator, models.RoleTester} {
				t.Run("роль "+role, func(t *testing.T) {
					h := newOwnerHarness(t)
					rec := h.do(ep.method, ep.path, ep.body, h.cookie(plainUser, role))
					wantOwnerStatus(t, rec, http.StatusForbidden)
					wantPrivate(t, rec)
				})
			}
			t.Run("в базе роль уже не владельца", func(t *testing.T) {
				h := newOwnerHarness(t)
				h.store.accounts[ownerActivityUser] = models.Account{ID: ownerActivityUser, Role: "user"}
				rec := h.do(ep.method, ep.path, ep.body, h.ownerCookie())
				wantOwnerStatus(t, rec, http.StatusForbidden)
			})
			t.Run("учётная запись удалена", func(t *testing.T) {
				h := newOwnerHarness(t)
				delete(h.store.accounts, ownerActivityUser)
				rec := h.do(ep.method, ep.path, ep.body, h.ownerCookie())
				wantOwnerStatus(t, rec, http.StatusUnauthorized)
			})
		})
	}
}

// TestOwnerKindMatchesRole — owner_activity управляет только kind=activity,
// owner_service только kind=service; несоответствие — 403, а не 400.
func TestOwnerKindMatchesRole(t *testing.T) {
	t.Run("owner_activity создаёт услугу", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities",
			`{"name":"Стрижка","category_id":10,"kind":"service"}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusForbidden)
	})
	t.Run("owner_service создаёт занятие", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities",
			`{"name":"Шахматы","category_id":10,"kind":"activity"}`, h.cookie(ownerServiceUser, models.RoleOwnerService))
		wantOwnerStatus(t, rec, http.StatusForbidden)
	})
	t.Run("owner_service создаёт услугу", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities",
			`{"name":"Стрижка","category_id":900,"kind":"service"}`, h.cookie(ownerServiceUser, models.RoleOwnerService))
		wantOwnerStatus(t, rec, http.StatusCreated)
		body := ownerJSON(t, rec)
		if body["kind"] != models.CardKindService {
			t.Errorf("kind = %v, ждали service", body["kind"])
		}
	})
	t.Run("kind по умолчанию — от роли", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities",
			`{"name":"Шахматы","category_id":10}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusCreated)
		if got := ownerJSON(t, rec)["kind"]; got != models.CardKindActivity {
			t.Errorf("kind = %v, ждали activity от роли owner_activity", got)
		}
	})
	t.Run("чужой тип своей карточки", func(t *testing.T) {
		h := newOwnerHarness(t)
		for _, ep := range []struct {
			method string
			path   string
			body   string
		}{
			{http.MethodGet, "/api/v1/me/activities/506", ""},
			{http.MethodPut, "/api/v1/me/activities/506", `{"name":"Правка","category_id":10}`},
			{http.MethodPost, "/api/v1/me/activities/506/submit", ""},
			{http.MethodPost, "/api/v1/me/activities/506/unpublish", ""},
		} {
			rec := h.do(ep.method, ep.path, ep.body, h.ownerCookie())
			if rec.Code != http.StatusForbidden {
				t.Errorf("%s %s: код = %d, ждали 403 (роль не того типа)", ep.method, ep.path, rec.Code)
			}
		}
	})
	t.Run("список фильтрует по своему типу", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodGet, "/api/v1/me/activities?limit=100", "", h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusOK)
		if h.store.lastFilter.Kind != models.CardKindActivity {
			t.Errorf("фильтр kind = %q, ждали activity от роли", h.store.lastFilter.Kind)
		}
		for _, item := range ownerJSON(t, rec)["items"].([]any) {
			if item.(map[string]any)["kind"] != models.CardKindActivity {
				t.Errorf("в списке владельца занятий оказалась услуга: %v", item)
			}
		}
	})
}

// TestOwnerCreateDefaults — создание даёт черновик, is_active=true и владельца
// из сессии; поля идентичности и статуса из тела игнорируются (§12.1).
func TestOwnerCreateDefaults(t *testing.T) {
	h := newOwnerHarness(t)
	rec := h.do(http.MethodPost, "/api/v1/me/activities", `{
		"name":"  Шахматы для детей  ","category_id":10,
		"owner_id":11,"status":"published","is_active":false,"slug":"chuzhoy-slug",
		"reject_reason":"подделка","contacts_verified_at":"2026-01-01"
	}`, h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusCreated)
	wantPrivate(t, rec)

	body := ownerJSON(t, rec)
	if body["status"] != models.CardStatusDraft {
		t.Errorf("status = %v, ждали draft: публикация — решение модератора", body["status"])
	}
	if body["is_active"] != true {
		t.Errorf("is_active = %v, ждали true", body["is_active"])
	}
	if body["name"] != "Шахматы для детей" {
		t.Errorf("name = %v, ждали обрезанные пробелы", body["name"])
	}
	if body["format"] != "offline" {
		t.Errorf("format = %v, ждали offline по умолчанию (§8 табл. 1)", body["format"])
	}
	if body["slug"] == "chuzhoy-slug" || body["slug"] == "" || body["slug"] == nil {
		t.Errorf("slug = %v: адрес карточки строит сервер, а не тело запроса", body["slug"])
	}
	if h.store.lastCreateOwner != ownerActivityUser {
		t.Errorf("владелец в хранилище = %d, ждали %d из сессии", h.store.lastCreateOwner, ownerActivityUser)
	}
	if got := body["owner_id"]; got != float64(ownerActivityUser) {
		t.Errorf("owner_id = %v, ждали %d: owner_id из тела игнорируется", got, ownerActivityUser)
	}
	if body["org_id"] != float64(ownerOrgID) {
		t.Errorf("org_id = %v, ждали организацию владельца %d", body["org_id"], ownerOrgID)
	}
	if _, ok := body["reject_reason"]; !ok {
		t.Error("в ответе нет reject_reason: кабинет показывает причину отказа")
	}
}

func TestOwnerCreateNeedsOwnOrganization(t *testing.T) {
	t.Run("своя организация по org_id", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities",
			`{"name":"Шахматы","category_id":10,"org_id":100}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusCreated)
	})
	t.Run("чужая организация", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities",
			`{"name":"Шахматы","category_id":10,"org_id":102}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusForbidden)
	})
	t.Run("организации нет вовсе", func(t *testing.T) {
		h := newOwnerHarness(t)
		delete(h.store.orgs, ownerOrgID)
		rec := h.do(http.MethodPost, "/api/v1/me/activities",
			`{"name":"Шахматы","category_id":10}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusNotFound)
		if len(h.store.cards) != 7 {
			t.Errorf("карточка создалась без организации: строк %d", len(h.store.cards))
		}
	})
	t.Run("несуществующая организация", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities",
			`{"name":"Шахматы","category_id":10,"org_id":4242}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusNotFound)
	})
}

// TestOwnerCardValidation — 400 с именами полей вместо 500 из Postgres: длины
// колонок и CHECK-списки проверяются до запроса (§8 табл. 1).
func TestOwnerCardValidation(t *testing.T) {
	longName := strings.Repeat("я", 201)
	cases := []struct {
		name  string
		body  string
		field string
	}{
		{"пустое название", `{"name":"   ","category_id":10}`, "name"},
		{"название без поля", `{"category_id":10}`, "name"},
		{"длинное название", `{"name":"` + longName + `","category_id":10}`, "name"},
		{"направление не указано", `{"name":"Шахматы"}`, "category_id"},
		{"нулевое направление", `{"name":"Шахматы","category_id":0}`, "category_id"},
		{"отрицательное направление", `{"name":"Шахматы","category_id":-3}`, "category_id"},
		{"неизвестное направление", `{"name":"Шахматы","category_id":4242}`, "category_id"},
		{"направление только для услуг", `{"name":"Шахматы","category_id":900}`, "category_id"},
		{"неизвестный формат", `{"name":"Шахматы","category_id":10,"format":"zoom"}`, "format"},
		{"неизвестный тип занятия", `{"name":"Шахматы","category_id":10,"lesson_type":"pair"}`, "lesson_type"},
		{"длинный телефон", `{"name":"Шахматы","category_id":10,"phone":"` + strings.Repeat("1", 33) + `"}`, "phone"},
		{"нулевая организация", `{"name":"Шахматы","category_id":10,"org_id":0}`, "org_id"},
		{"битый JSON", `{not json`, "body"},
		{"пустое тело", ``, "body"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := newOwnerHarness(t)
			rec := h.do(http.MethodPost, "/api/v1/me/activities", c.body, h.ownerCookie())
			wantOwnerStatus(t, rec, http.StatusBadRequest)
			e := decodeEnvelope(t, rec)
			if e.Error.Code != http.StatusBadRequest {
				t.Errorf("code в конверте = %d, ждали 400", e.Error.Code)
			}
			if _, ok := e.Error.Fields[c.field]; !ok {
				t.Errorf("в fields нет %q: получили %v", c.field, e.Error.Fields)
			}
		})
	}
}

// TestOwnerServiceHasNoLessonType — CHECK cards_service_has_no_lesson_type:
// услуга с lesson_type не должна доезжать до базы.
func TestOwnerServiceHasNoLessonType(t *testing.T) {
	h := newOwnerHarness(t)
	rec := h.do(http.MethodPost, "/api/v1/me/activities",
		`{"name":"Стрижка","category_id":900,"kind":"service","lesson_type":"group"}`,
		h.cookie(ownerServiceUser, models.RoleOwnerService))
	wantOwnerStatus(t, rec, http.StatusBadRequest)
	if _, ok := decodeEnvelope(t, rec).Error.Fields["lesson_type"]; !ok {
		t.Errorf("ждали подсказку по lesson_type, получили %v", decodeEnvelope(t, rec).Error.Fields)
	}
}

func TestOwnerCardAccess(t *testing.T) {
	eps := []struct {
		method string
		path   string
		body   string
	}{
		{http.MethodGet, "/api/v1/me/activities/%d", ""},
		{http.MethodPut, "/api/v1/me/activities/%d", `{"name":"Правка","category_id":10}`},
		{http.MethodPost, "/api/v1/me/activities/%d/submit", ""},
		{http.MethodPost, "/api/v1/me/activities/%d/unpublish", ""},
	}
	for _, ep := range eps {
		t.Run(ep.method+" чужая карточка", func(t *testing.T) {
			h := newOwnerHarness(t)
			rec := h.do(ep.method, strings.Replace(ep.path, "%d", ownerIDText(foreignCardID), 1), ep.body, h.ownerCookie())
			wantOwnerStatus(t, rec, http.StatusForbidden)
			wantPrivate(t, rec)
		})
		t.Run(ep.method+" несуществующая карточка", func(t *testing.T) {
			h := newOwnerHarness(t)
			rec := h.do(ep.method, strings.Replace(ep.path, "%d", ownerIDText(missingCardID), 1), ep.body, h.ownerCookie())
			wantOwnerStatus(t, rec, http.StatusNotFound)
		})
		t.Run(ep.method+" нечисловой id", func(t *testing.T) {
			h := newOwnerHarness(t)
			rec := h.do(ep.method, strings.Replace(ep.path, "%d", "abc", 1), ep.body, h.ownerCookie())
			wantOwnerStatus(t, rec, http.StatusBadRequest)
			if _, ok := decodeEnvelope(t, rec).Error.Fields["id"]; !ok {
				t.Errorf("ждали подсказку по id, получили %v", decodeEnvelope(t, rec).Error.Fields)
			}
		})
	}
}

// TestOwnerListPagination — конверт §9.4 {items,total,page,limit} и пустой
// список как [], а не null.
func TestOwnerListPagination(t *testing.T) {
	h := newOwnerHarness(t)
	rec := h.do(http.MethodGet, "/api/v1/me/activities", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	wantPrivate(t, rec)

	body := ownerJSON(t, rec)
	for _, key := range []string{"items", "total", "page", "limit"} {
		if _, ok := body[key]; !ok {
			t.Fatalf("в конверте нет %q: %v", key, body)
		}
	}
	if body["page"] != float64(1) || body["limit"] != float64(defaultLimit) {
		t.Errorf("page/limit по умолчанию = %v/%v, ждали 1/%d", body["page"], body["limit"], defaultLimit)
	}
	// 500,501,502,503 — занятия владельца; 506 — услуга, ей здесь не место.
	if body["total"] != float64(4) {
		t.Errorf("total = %v, ждали 4 своих занятия", body["total"])
	}

	rec = h.do(http.MethodGet, "/api/v1/me/activities?page=2&limit=2", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	body = ownerJSON(t, rec)
	if body["page"] != float64(2) || body["limit"] != float64(2) || body["total"] != float64(4) {
		t.Errorf("страница 2 по 2: %v", body)
	}
	items := body["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("на странице %d строк, ждали 2", len(items))
	}
	// Порядок «свежие сверху» при равном updated_at разрешается по id DESC:
	// 503, 502, 501, 500 — значит вторая страница начинается с 501.
	if items[0].(map[string]any)["id"] != ownerIDText(publishedCardID) {
		t.Errorf("порядок страницы = %v, ждали продолжение id DESC", items[0])
	}

	rec = h.do(http.MethodGet, "/api/v1/me/activities?status=published", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	body = ownerJSON(t, rec)
	if body["total"] != float64(1) {
		t.Errorf("фильтр по статусу: total = %v, ждали 1", body["total"])
	}

	rec = h.do(http.MethodGet, "/api/v1/me/activities?status=rejected", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	items = ownerJSON(t, rec)["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["reject_reason"] != "нет телефона у точки" {
		t.Errorf("отклонённая карточка без причины отказа: %v", items)
	}

	rec = h.do(http.MethodGet, "/api/v1/me/activities?page=99", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	raw := ownerJSON(t, rec)
	if raw["items"] == nil {
		t.Error("пустая страница отдала null вместо []")
	}
	if arr, ok := raw["items"].([]any); !ok || len(arr) != 0 {
		t.Errorf("items = %v, ждали пустой массив", raw["items"])
	}
}

func TestOwnerListQueryValidation(t *testing.T) {
	for _, q := range []string{"page=0", "page=-1", "page=abc", "limit=0", "limit=101", "limit=abc", "status=approved"} {
		t.Run(q, func(t *testing.T) {
			h := newOwnerHarness(t)
			rec := h.do(http.MethodGet, "/api/v1/me/activities?"+q, "", h.ownerCookie())
			wantOwnerStatus(t, rec, http.StatusBadRequest)
			if len(decodeEnvelope(t, rec).Error.Fields) == 0 {
				t.Error("400 без имён полей: клиент не поймёт, что исправить")
			}
		})
	}
}

// TestOwnerDetailCanonicalShape — деталь кабинета читается тем же парсером, что
// и публичная карточка: kind, org_id, category, format, lesson_type, lat/lng,
// photo, price, groups[].schedules[].time_from/time_to, locations, photos, videos.
func TestOwnerDetailCanonicalShape(t *testing.T) {
	h := newOwnerHarness(t)
	rec := h.do(http.MethodGet, "/api/v1/me/activities/500", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	wantPrivate(t, rec)

	body := ownerJSON(t, rec)
	for _, key := range []string{
		"id", "slug", "name", "kind", "org_id", "category", "category_id", "format", "lesson_type",
		"status", "is_active", "owner_id", "reject_reason", "created_at", "updated_at",
		"lat", "lng", "photo", "price", "age", "organization", "locations", "groups", "photos", "videos",
	} {
		if _, ok := body[key]; !ok {
			t.Errorf("в детали нет канонического поля %q", key)
		}
	}
	for _, forbidden := range []string{
		"record_type", "direction", "organization_id", "class_format", "latitude", "cover_path", "start_time",
	} {
		if _, ok := body[forbidden]; ok {
			t.Errorf("в ответе имя из схемы codex: %q", forbidden)
		}
	}

	groups := body["groups"].([]any)
	if len(groups) != 1 {
		t.Fatalf("групп в детали %d, ждали 1", len(groups))
	}
	group := groups[0].(map[string]any)
	schedules := group["schedules"].([]any)
	if len(schedules) != 1 {
		t.Fatalf("строк расписания %d, ждали 1", len(schedules))
	}
	lesson := schedules[0].(map[string]any)
	if lesson["time_from"] != "17:00" || lesson["time_to"] != "18:30" {
		t.Errorf("расписание = %v, ждали time_from/time_to «ЧЧ:ММ»", lesson)
	}
	if group["location_id"] != float64(300) {
		t.Errorf("location_id = %v, ждали 300", group["location_id"])
	}
	locations := body["locations"].([]any)
	if len(locations) != 1 || locations[0].(map[string]any)["lat"] != 46.84 {
		t.Errorf("точки = %v, ждали одну с lat", locations)
	}
	if body["organization"].(map[string]any)["slug"] != "studiya-rostok" {
		t.Errorf("организация в детали = %v", body["organization"])
	}
	// Черновик обязан читаться владельцем: публичный ActivityBySlug отдаёт только
	// published, поэтому кабинет не может им пользоваться.
	if body["status"] != models.CardStatusDraft {
		t.Errorf("status = %v, ждали draft — владелец видит неопубликованное", body["status"])
	}
}

// TestOwnerDetailMediaHasID — кабинет удаляет медиа строкой DELETE …/media/{id},
// поэтому photos[] и videos[] детали обязаны нести числовой id. Публичная форма
// (path/caption/source_url/author/order_num) при этом не меняется: web читает
// галерею одним парсером, id лишь добавляется сверху.
func TestOwnerDetailMediaHasID(t *testing.T) {
	h := newOwnerHarness(t)
	rec := h.do(http.MethodGet, "/api/v1/me/activities/500", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	body := ownerJSON(t, rec)

	for _, tc := range []struct {
		key    string
		wantID float64
	}{
		{"photos", 900},
		{"videos", 901},
	} {
		key := tc.key
		items, ok := body[key].([]any)
		if !ok || len(items) == 0 {
			t.Fatalf("%s = %v, ждали непустой массив", key, body[key])
		}
		item, ok := items[0].(map[string]any)
		if !ok {
			t.Fatalf("%s[0] = %v, ждали объект", key, items[0])
		}
		id, ok := item["id"].(float64)
		if !ok || id != tc.wantID {
			t.Errorf("%s[0].id = %v, ждали число %v: без id строки кабинет не может удалить медиа", key, item["id"], tc.wantID)
		}
		if len(item) != 6 {
			t.Errorf("%s[0]: полей %d, ждали 6 (id + канонические пять): %v", key, len(item), item)
		}
		for _, field := range []string{"path", "caption", "source_url", "author", "order_num"} {
			if _, ok := item[field]; !ok {
				t.Errorf("%s[0]: нет канонического поля %q", key, field)
			}
		}
		if _, ok := item["path"].(string); !ok {
			t.Errorf("%s[0].path = %v, ждали строку", key, item["path"])
		}
		if _, ok := item["order_num"].(float64); !ok {
			t.Errorf("%s[0].order_num = %v, ждали число", key, item["order_num"])
		}
	}
}

// TestOwnerSubmitReachesModerationQueue — подача меняет статус карточки и
// создаёт заявку moderation_applications со submitted_by = владелец: очередь
// модератора читает именно эту таблицу (repository/moderation.go:92).
func TestOwnerSubmitReachesModerationQueue(t *testing.T) {
	h := newOwnerHarness(t)
	rec := h.do(http.MethodPost, "/api/v1/me/activities/500/submit", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	wantPrivate(t, rec)

	body := ownerJSON(t, rec)
	card := body["card"].(map[string]any)
	if card["status"] != models.CardStatusOnModeration {
		t.Errorf("status карточки = %v, ждали on_moderation", card["status"])
	}
	if card["is_active"] != true {
		t.Errorf("is_active = %v: после снятия с публикации подача обязана вернуть активность", card["is_active"])
	}
	if body["application_id"] == nil || body["application_id"] == float64(0) {
		t.Errorf("application_id = %v, ждали id созданной заявки", body["application_id"])
	}
	if body["submitted_at"] == nil || body["submitted_at"] == "" {
		t.Errorf("submitted_at = %v, ждали отметку подачи", body["submitted_at"])
	}

	if len(h.store.applications) != 1 {
		t.Fatalf("заявок создано %d, ждали 1", len(h.store.applications))
	}
	app := h.store.applications[0]
	if app.CardID != draftCardID || app.SubmittedBy != ownerActivityUser || app.Status != models.ApplicationPending {
		t.Errorf("заявка = %+v, ждали card 500, submitted_by 7, pending", app)
	}
	if h.store.cards[draftCardID].row.Status != models.CardStatusOnModeration {
		t.Error("карточка в хранилище осталась в прежнем статусе")
	}
}

func TestOwnerSubmitTwiceConflicts(t *testing.T) {
	h := newOwnerHarness(t)
	wantOwnerStatus(t, h.do(http.MethodPost, "/api/v1/me/activities/500/submit", "", h.ownerCookie()), http.StatusOK)

	rec := h.do(http.MethodPost, "/api/v1/me/activities/500/submit", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusConflict)
	e := decodeEnvelope(t, rec)
	if !strings.Contains(e.Error.Message, "проверке") {
		t.Errorf("сообщение 409 = %q, ждали честное «уже на проверке»", e.Error.Message)
	}
	if len(h.store.applications) != 1 {
		t.Errorf("повтор создал вторую заявку: их %d", len(h.store.applications))
	}
}

func TestOwnerSubmitFromOtherStatuses(t *testing.T) {
	t.Run("отклонённая подаётся заново", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities/502/submit", "", h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusOK)
		card := ownerJSON(t, rec)["card"].(map[string]any)
		if card["status"] != models.CardStatusOnModeration {
			t.Errorf("status = %v, ждали on_moderation", card["status"])
		}
		if card["reject_reason"] != nil {
			t.Errorf("reject_reason = %v, ждали сброшенную причину: анкета подана заново", card["reject_reason"])
		}
	})
	t.Run("опубликованная не подаётся", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPost, "/api/v1/me/activities/501/submit", "", h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusConflict)
		if len(h.store.applications) != 0 {
			t.Errorf("заявка создана для опубликованной карточки: %d", len(h.store.applications))
		}
	})
	t.Run("таблиц модерации нет", func(t *testing.T) {
		h := newOwnerHarness(t)
		h.store.schemaReady = false
		rec := h.do(http.MethodPost, "/api/v1/me/activities/500/submit", "", h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusServiceUnavailable)
		if len(h.store.applications) != 0 {
			t.Error("заявка создана на базе без таблиц модерации")
		}
	})
}

// TestOwnerUnpublishHidesCard — снятие с публикации ставит draft и is_active=false:
// каталог требует и c.status='published', и c.is_active (repository/catalog.go:128-133).
func TestOwnerUnpublishHidesCard(t *testing.T) {
	h := newOwnerHarness(t)
	rec := h.do(http.MethodPost, "/api/v1/me/activities/501/unpublish", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)
	wantPrivate(t, rec)

	card := ownerJSON(t, rec)["card"].(map[string]any)
	if card["status"] != models.CardStatusDraft {
		t.Errorf("status = %v, ждали draft", card["status"])
	}
	if card["is_active"] != false {
		t.Errorf("is_active = %v, ждали false", card["is_active"])
	}
	stored := h.store.cards[publishedCardID].row
	if stored.Status != models.CardStatusDraft || stored.IsActive {
		t.Errorf("в хранилище = %s/%v, ждали draft/false", stored.Status, stored.IsActive)
	}

	rec = h.do(http.MethodPost, "/api/v1/me/activities/501/unpublish", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusConflict)

	rec = h.do(http.MethodPost, "/api/v1/me/activities/500/unpublish", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusConflict)
	if h.store.cards[draftCardID].row.IsActive != true {
		t.Error("черновик потерял is_active от попытки снятия с публикации")
	}
}

func TestOwnerUpdateCard(t *testing.T) {
	t.Run("черновик правится", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPut, "/api/v1/me/activities/500",
			`{"name":"Шахматы и шашки","category_id":10,"format":"both","lesson_type":"group","description":"для детей 7+"}`,
			h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusOK)
		body := ownerJSON(t, rec)
		if body["name"] != "Шахматы и шашки" || body["format"] != "both" || body["lesson_type"] != "group" {
			t.Errorf("правка не сохранилась: %v", body)
		}
		if body["status"] != models.CardStatusDraft {
			t.Errorf("status = %v: правка черновика не публикует карточку", body["status"])
		}
		if body["slug"] != "card-500" {
			t.Errorf("slug = %v: публичный адрес карточки не меняется правкой", body["slug"])
		}
	})
	t.Run("отклонённая правится", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPut, "/api/v1/me/activities/502",
			`{"name":"Исправленная","category_id":10}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusOK)
	})
	t.Run("на проверке не правится", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPut, "/api/v1/me/activities/503",
			`{"name":"Подмена","category_id":10}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusConflict)
		if h.store.cards[onModerationID].row.Name == "Подмена" {
			t.Error("правка прошла на анкете, которую смотрит модератор")
		}
	})
	t.Run("опубликованная не правится напрямую", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPut, "/api/v1/me/activities/501",
			`{"name":"Подмена","category_id":10}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusConflict)
		if !strings.Contains(decodeEnvelope(t, rec).Error.Message, "публикац") {
			t.Errorf("сообщение = %q, ждали объяснение про снятие с публикации", decodeEnvelope(t, rec).Error.Message)
		}
	})
	t.Run("перенос в другую организацию", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPut, "/api/v1/me/activities/500",
			`{"name":"Шахматы","category_id":10,"org_id":102}`, h.ownerCookie())
		if rec.Code != http.StatusBadRequest && rec.Code != http.StatusForbidden {
			t.Errorf("код = %d, ждали 400/403 на перенос карточки в чужую организацию", rec.Code)
		}
	})
	t.Run("валидация как при создании", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodPut, "/api/v1/me/activities/500", `{"name":"","category_id":10}`, h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusBadRequest)
		if _, ok := decodeEnvelope(t, rec).Error.Fields["name"]; !ok {
			t.Error("400 без имени поля name")
		}
	})
}

func TestOwnerOrganization(t *testing.T) {
	t.Run("своя организация", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodGet, "/api/v1/me/organization", "", h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusOK)
		wantPrivate(t, rec)
		body := ownerJSON(t, rec)
		for _, key := range []string{
			"id", "slug", "name", "type", "description", "phone", "email", "site",
			"address", "city", "contacts_verified_at", "city_id", "lat", "lng",
			"owner_id", "is_active", "publish_basis", "created_at", "updated_at",
		} {
			if _, ok := body[key]; !ok {
				t.Errorf("в организации нет поля %q", key)
			}
		}
		if body["slug"] != "studiya-rostok" || body["owner_id"] != float64(ownerActivityUser) {
			t.Errorf("организация = %v, ждали свою", body)
		}
	})
	t.Run("организации нет", func(t *testing.T) {
		h := newOwnerHarness(t)
		delete(h.store.orgs, serviceOrgID)
		rec := h.do(http.MethodGet, "/api/v1/me/organization", "", h.cookie(ownerServiceUser, models.RoleOwnerService))
		wantOwnerStatus(t, rec, http.StatusNotFound)
	})
	t.Run("чужая не отдаётся", func(t *testing.T) {
		h := newOwnerHarness(t)
		rec := h.do(http.MethodGet, "/api/v1/me/organization", "", h.ownerCookie())
		wantOwnerStatus(t, rec, http.StatusOK)
		if ownerJSON(t, rec)["id"] == float64(foreignOrgID) {
			t.Error("владельцу отдали чужую организацию")
		}
	})
}

// TestOwnerOrganizationImmutableFields — slug (публичные URL), owner_id,
// publish_basis, contacts_verified_at и is_active не меняются из кабинета.
func TestOwnerOrganizationImmutableFields(t *testing.T) {
	h := newOwnerHarness(t)
	rec := h.do(http.MethodPut, "/api/v1/me/organization", `{
		"name":"Студия «Росток-2»","type":"дом творчества","phone":"+373 533 54321",
		"description":"новое описание","email":"hello@rostok.md","site":"https://rostok.md",
		"address":"ул. Мира, 5","city_id":1,"lat":46.84,"lng":29.64,
		"slug":"poddelka","owner_id":11,"publish_basis":"подделка",
		"contacts_verified_at":"2020-01-01","is_active":false,"id":102,"created_at":"2000-01-01T00:00:00Z"
	}`, h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusOK)

	body := ownerJSON(t, rec)
	if body["slug"] != "studiya-rostok" {
		t.Errorf("slug = %v: публичный адрес организации неприкосновенен", body["slug"])
	}
	if body["owner_id"] != float64(ownerActivityUser) {
		t.Errorf("owner_id = %v, ждали прежнего владельца", body["owner_id"])
	}
	if body["publish_basis"] != "provided_by_owner" {
		t.Errorf("publish_basis = %v, ждали прежнее основание", body["publish_basis"])
	}
	if body["is_active"] != true {
		t.Errorf("is_active = %v: активность организации решает модератор", body["is_active"])
	}
	if body["contacts_verified_at"] != nil {
		t.Errorf("contacts_verified_at = %v, ждали null: сверка контактов не из кабинета", body["contacts_verified_at"])
	}
	if body["id"] != float64(ownerOrgID) {
		t.Errorf("id = %v, ждали свою организацию", body["id"])
	}
	if body["name"] != "Студия «Росток-2»" || body["type"] != "дом творчества" || body["phone"] != "+373 533 54321" {
		t.Errorf("разрешённые поля не сохранились: %v", body)
	}
	if body["lat"] != 46.84 || body["lng"] != 29.64 || body["city_id"] != float64(tiraspolCityID) {
		t.Errorf("координаты и город не сохранились: %v", body)
	}
	if h.store.lastOrgOwner != ownerActivityUser {
		t.Errorf("владелец в хранилище = %d, ждали %d из сессии", h.store.lastOrgOwner, ownerActivityUser)
	}
}

func TestOwnerOrganizationValidation(t *testing.T) {
	valid := `"name":"Студия","type":"студия","phone":"+373 533 12345"`
	cases := []struct {
		name  string
		body  string
		field string
	}{
		{"тип не из CHECK", `{` + valid + `}`, ""},
		{"пустое название", `{"name":"  ","type":"студия","phone":"+373"}`, "name"},
		{"длинное название", `{"name":"` + strings.Repeat("я", 201) + `","type":"студия","phone":"+373"}`, "name"},
		{"телефона нет", `{"name":"Студия","type":"студия"}`, "phone"},
		{"пустой телефон", `{"name":"Студия","type":"студия","phone":"   "}`, "phone"},
		{"длинный телефон", `{"name":"Студия","type":"студия","phone":"` + strings.Repeat("1", 33) + `"}`, "phone"},
		{"битая почта", `{"name":"Студия","type":"студия","phone":"+373","email":"ivan@mail"}`, "email"},
		{"длинная почта", `{"name":"Студия","type":"студия","phone":"+373","email":"` + strings.Repeat("a", 250) + `@x.com"}`, "email"},
		{"сайт без схемы", `{"name":"Студия","type":"студия","phone":"+373","site":"rostok.md"}`, "site"},
		{"длинный сайт", `{"name":"Студия","type":"студия","phone":"+373","site":"https://` + strings.Repeat("a", 500) + `.md"}`, "site"},
		{"длинный адрес", `{"name":"Студия","type":"студия","phone":"+373","address":"` + strings.Repeat("я", 301) + `"}`, "address"},
		{"широта без долготы", `{"name":"Студия","type":"студия","phone":"+373","lat":46.84}`, "lng"},
		{"долгота без широты", `{"name":"Студия","type":"студия","phone":"+373","lng":29.64}`, "lat"},
		{"координаты вне Приднестровья", `{"name":"Студия","type":"студия","phone":"+373","lat":55.75,"lng":37.62}`, "lat"},
		{"нулевой город", `{"name":"Студия","type":"студия","phone":"+373","city_id":0}`, "city_id"},
		{"неизвестный город", `{"name":"Студия","type":"студия","phone":"+373","city_id":4242}`, "city_id"},
		{"битый JSON", `{not json`, "body"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := newOwnerHarness(t)
			body := c.body
			if c.field == "" {
				body = `{"name":"Студия","type":"school","phone":"+373"}`
				c.field = "type"
			}
			rec := h.do(http.MethodPut, "/api/v1/me/organization", body, h.ownerCookie())
			wantOwnerStatus(t, rec, http.StatusBadRequest)
			e := decodeEnvelope(t, rec)
			if _, ok := e.Error.Fields[c.field]; !ok {
				t.Errorf("в fields нет %q: получили %v", c.field, e.Error.Fields)
			}
			if h.store.orgs[ownerOrgID].Name == "Студия" && c.name == "тип не из CHECK" {
				t.Error("невалидный тип доехал до хранилища")
			}
		})
	}
}

func TestOwnerOrganizationTypeDictionary(t *testing.T) {
	for _, kind := range []string{"школа", "студия", "дом творчества", "спортшкола", "частный мастер"} {
		t.Run(kind, func(t *testing.T) {
			h := newOwnerHarness(t)
			rec := h.do(http.MethodPut, "/api/v1/me/organization",
				`{"name":"Студия","type":"`+kind+`","phone":"+373 533 12345"}`, h.ownerCookie())
			wantOwnerStatus(t, rec, http.StatusOK)
			if ownerJSON(t, rec)["type"] != kind {
				t.Errorf("тип %q не сохранился", kind)
			}
		})
	}
}

func TestOwnerOrganizationUpdateWithoutProfile(t *testing.T) {
	h := newOwnerHarness(t)
	delete(h.store.orgs, ownerOrgID)
	rec := h.do(http.MethodPut, "/api/v1/me/organization",
		`{"name":"Студия","type":"студия","phone":"+373"}`, h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusNotFound)
}

// TestOwnerBodyLimit — тело кабинета ограничено: мегабайты под «некорректное
// тело» не должны читаться целиком.
func TestOwnerBodyLimit(t *testing.T) {
	h := newOwnerHarness(t)
	huge := `{"name":"` + strings.Repeat("я", 200<<10) + `","category_id":10}`
	rec := h.do(http.MethodPost, "/api/v1/me/activities", huge, h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusBadRequest)
}

// TestOwnerStoreFailureIs500 — ошибка базы не превращается в пустой список и не
// выдаёт наружу текст запроса.
func TestOwnerStoreFailureIs500(t *testing.T) {
	h := newOwnerHarness(t)
	h.store.listErr = errors.New("relation \"activities\" does not exist")
	rec := h.do(http.MethodGet, "/api/v1/me/activities", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusInternalServerError)
	if strings.Contains(rec.Body.String(), "activities") {
		t.Errorf("наружу ушёл текст ошибки базы: %s", rec.Body.String())
	}
	wantPrivate(t, rec)
}

func TestOwnerAccountLookupFailureIs500(t *testing.T) {
	h := newOwnerHarness(t)
	h.store.accountErr = errors.New("соединение оборвано")
	rec := h.do(http.MethodGet, "/api/v1/me/activities", "", h.ownerCookie())
	wantOwnerStatus(t, rec, http.StatusInternalServerError)
}
