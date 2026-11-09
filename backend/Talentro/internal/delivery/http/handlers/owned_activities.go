package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"talentro/internal/auth"
	"talentro/internal/httpx"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// ownerStore — ровно то, что нужно кабинету владельца (§3.8). Тот же шов, что
// moderationStore у кабинета модерации: обработчик держит интерфейс, а не
// *repository.Repository, поэтому таблица прав (401/403/404/409/503) проверяется
// на фейке без живой базы (§15 п. 8 — права решает сервер).
//
// Во все методы владелец передаётся отдельным аргументом из сессии: в теле
// запроса поля owner_id нет вовсе, и подделать его нельзя (§12.1).
type ownerStore interface {
	AccountByID(ctx context.Context, id int64) (models.Account, error)
	// ModerationSchemaReady нужен только подаче: без таблиц модерации заявка
	// не создастся, и честный ответ — 503, а не «подано».
	ModerationSchemaReady(ctx context.Context) (bool, error)
	OwnedCards(ctx context.Context, ownerID int64, f models.OwnedCardsFilter) ([]models.OwnedCard, int, error)
	OwnedCardByID(ctx context.Context, ownerID, cardID int64, kind string) (*models.OwnedActivity, error)
	CreateOwnedCard(ctx context.Context, ownerID int64, in models.OwnedCardInput) (*models.OwnedCard, error)
	UpdateOwnedCard(ctx context.Context, ownerID, cardID int64, kind string, in models.OwnedCardInput) (*models.OwnedCard, error)
	SubmitOwnedCard(ctx context.Context, ownerID, cardID int64, kind string) (*models.OwnedSubmitResult, error)
	UnpublishOwnedCard(ctx context.Context, ownerID, cardID int64, kind string) (*models.OwnedCard, error)
	OwnedOrganization(ctx context.Context, ownerID int64) (*models.OwnedOrganization, error)
	UpdateOwnedOrganization(ctx context.Context, ownerID int64, in models.OwnedOrganizationInput) (*models.OwnedOrganization, error)
}

// maxOwnerBody — потолок тела кабинета. Карточка приносит название, описание и
// телефон; 64 КиБ с запасом покрывают описание на несколько экранов, а мегабайты
// «некорректного тела» не читаются целиком.
const maxOwnerBody = 64 << 10

// Длины — ровно VARCHAR из database/init.sql. Postgres считает символы, поэтому
// меряем руны: иначе 22001 прилетел бы как 500 на месте честного 400 (§9).
const (
	maxCardNameRunes   = 200 // cards.name
	maxCardPhoneRunes  = 32  // cards.phone
	maxOrgNameRunes    = 200 // organizations.name
	maxOrgPhoneRunes   = 32  // organizations.phone NOT NULL
	maxOrgSiteRunes    = 500 // organizations.site
	maxOrgAddressRunes = 300 // organizations.address
)

// Рамка Приднестровья — та же, что у parseGeo и CHECK на locations (§7.3, §3.5).
// У organizations координатного CHECK в схеме нет, поэтому границу держит
// обработчик: точка за пределами региона означала бы ошибку ввода, а не адрес.
const (
	ownerLatMin = 45.9
	ownerLatMax = 48.9
	ownerLngMin = 27.4
	ownerLngMax = 30.6
)

// OwnerHandler — кабинет владельца: свои карточки и своя организация.
//
// Сессия только читается: куку `talentro_session` выдаёт auth-срез, второй
// реализации сессии в проекте нет. Роль перечитывается из users на каждый
// запрос, поэтому понижение account_type отзывает доступ сразу, а живая кука
// не помогает.
type OwnerHandler struct {
	store    ownerStore
	sessions *auth.Store
}

// OwnerOption — настройка обработчика. Отдельный тип, а не Option: имя Option
// уже занято кабинетом модерации в этом же пакете.
type OwnerOption func(*OwnerHandler)

// WithOwnerSessions включает чтение куки. Без него любой запрос — 503, а не
// «все проходят»: стенд без SESSION_SECRET не превращается в открытый кабинет.
func WithOwnerSessions(store *auth.Store) OwnerOption {
	return func(h *OwnerHandler) { h.sessions = store }
}

func NewOwnerHandler(store ownerStore, opts ...OwnerOption) *OwnerHandler {
	h := &OwnerHandler{store: store}
	for _, opt := range opts {
		opt(h)
	}
	return h
}

// ownerPage — конверт пагинации (§9.4). moderationPage не переиспользуем: он
// объявлен в срезе модерации, а типы строк здесь другие.
type ownerPage[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Limit int `json:"limit"`
}

// ownerCardStatuses — словарь cards.status для фильтра списка. «approved» сюда
// не входит: это статус заявки, а не карточки (§8, табл. 1 и 11 — разные словари).
var ownerCardStatuses = map[string]bool{
	models.CardStatusDraft:        true,
	models.CardStatusOnModeration: true,
	models.CardStatusPublished:    true,
	models.CardStatusRejected:     true,
}

// ListActivities — GET /api/v1/me/activities: свои карточки, свежие сверху.
// Вид карточки приходит от роли, а не от клиента; статус и is_active не
// фильтруются — снятую с публикации карточку владелец обязан видеть, иначе он не
// подаст её снова.
func (h *OwnerHandler) ListActivities(w http.ResponseWriter, r *http.Request) {
	ownerHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}

	q := r.URL.Query()
	page, limit, err := parsePage(q)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	status, err := parseStatus(q, ownerCardStatuses)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	f := models.OwnedCardsFilter{Kind: acc.OwnerKind(), Status: status, Page: page, Limit: limit}
	items, total, err := h.store.OwnedCards(r.Context(), acc.ID, f)
	if err != nil {
		ownerStoreError(w, err, "карточка не найдена")
		return
	}
	if items == nil {
		items = []models.OwnedCard{}
	}
	httpx.WriteJSON(w, http.StatusOK, ownerPage[models.OwnedCard]{
		Items: items, Total: total, Page: page, Limit: limit,
	})
}

// CreateActivity — POST /api/v1/me/activities: новая карточка владельца.
// Статус всегда draft, владелец всегда из сессии, адрес строит сервер. Публикация
// — решение модератора (§3.9), поэтому поля status/is_active/slug/owner_id из
// тела игнорируются: их нет в модели, и разбор до них просто не доходит.
func (h *OwnerHandler) CreateActivity(w http.ResponseWriter, r *http.Request) {
	ownerHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}

	var raw models.OwnedCardInput
	if err := decodeOwnerBody(w, r, &raw); err != nil {
		httpx.WriteError(w, err)
		return
	}
	kind, err := ownerKindFor(acc, raw.Kind)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	in, err := normalizeOwnerCard(raw, kind)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	card, err := h.store.CreateOwnedCard(r.Context(), acc.ID, in)
	if err != nil {
		ownerStoreError(w, err, "организация не найдена")
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, card)
}

// Activity — GET /api/v1/me/activities/{id}: своя карточка целиком в форме §9.3.
// Черновик, отказ и анкета на проверке читаются тоже: публичная деталь отдаёт
// только published, и кабинету она не подходит.
func (h *OwnerHandler) Activity(w http.ResponseWriter, r *http.Request) {
	ownerHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}
	id, ok := ownerPathID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	card, err := h.store.OwnedCardByID(r.Context(), acc.ID, id, acc.OwnerKind())
	if err != nil {
		ownerStoreError(w, err, "карточка не найдена")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, card)
}

// UpdateActivity — PUT /api/v1/me/activities/{id}: правка своей карточки.
// Разрешена в draft и rejected; анкету на проверке подменить нельзя, а
// опубликованную сначала снимают с публикации (409 с объяснением).
func (h *OwnerHandler) UpdateActivity(w http.ResponseWriter, r *http.Request) {
	ownerHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}
	id, ok := ownerPathID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var raw models.OwnedCardInput
	if err := decodeOwnerBody(w, r, &raw); err != nil {
		httpx.WriteError(w, err)
		return
	}
	kind, err := ownerKindFor(acc, raw.Kind)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	in, err := normalizeOwnerCard(raw, kind)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	card, err := h.store.UpdateOwnedCard(r.Context(), acc.ID, id, kind, in)
	if err != nil {
		ownerStoreError(w, err, "карточка не найдена")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, card)
}

// SubmitActivity — POST /api/v1/me/activities/{id}/submit: подача на проверку.
// Заявка создаётся в moderation_applications, её читает очередь модератора
// (repository/moderation.go, ModerationQueue) — второй очереди у владельца нет.
// Повторная подача анкеты, которая уже на проверке, — 409, а не тихой «успех».
func (h *OwnerHandler) SubmitActivity(w http.ResponseWriter, r *http.Request) {
	ownerHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}
	if !h.schemaReady(w, r) {
		return
	}
	id, ok := ownerPathID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	result, err := h.store.SubmitOwnedCard(r.Context(), acc.ID, id, acc.OwnerKind())
	if err != nil {
		ownerStoreError(w, err, "карточка не найдена")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, result)
}

// UnpublishActivity — POST /api/v1/me/activities/{id}/unpublish: снятие с
// публикации (§7.18). Ставится и draft, и is_active=false — каталог требует оба
// условия (repository/catalog.go, cardWhere), поэтому карточка исчезает из
// выдачи сразу, а не после следующего прогона модерации.
func (h *OwnerHandler) UnpublishActivity(w http.ResponseWriter, r *http.Request) {
	ownerHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}
	id, ok := ownerPathID(w, chi.URLParam(r, "id"))
	if !ok {
		return
	}

	card, err := h.store.UnpublishOwnedCard(r.Context(), acc.ID, id, acc.OwnerKind())
	if err != nil {
		ownerStoreError(w, err, "карточка не найдена")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, struct {
		Card models.OwnedCard `json:"card"`
	}{Card: *card})
}

// Organization — GET /api/v1/me/organization: организация, у которой owner_id
// равен вызывающему. 404, если такой нет: кабинет не заводит организацию сам,
// основание публикации (§11.8) — не самообслуживание.
func (h *OwnerHandler) Organization(w http.ResponseWriter, r *http.Request) {
	ownerHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}

	org, err := h.store.OwnedOrganization(r.Context(), acc.ID)
	if err != nil {
		ownerStoreError(w, err, "организация не найдена: у вас пока нет своей организации")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, org)
}

// UpdateOrganization — PUT /api/v1/me/organization: правка редактируемых полей.
// slug, owner_id, publish_basis, contacts_verified_at и is_active не меняются
// вовсе: их нет в модели тела, а запрос хранилища их не пишет.
func (h *OwnerHandler) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	ownerHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}

	var raw models.OwnedOrganizationInput
	if err := decodeOwnerBody(w, r, &raw); err != nil {
		httpx.WriteError(w, err)
		return
	}
	in, err := normalizeOwnerOrganization(raw)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	org, err := h.store.UpdateOwnedOrganization(r.Context(), acc.ID, in)
	if err != nil {
		ownerStoreError(w, err, "организация не найдена: у вас пока нет своей организации")
		return
	}
	httpx.WriteJSON(w, http.StatusOK, org)
}

// authorize — единственная дверь кабинета (§12.1, §15 п. 8). Claims дают быстрый
// отказ для заведомо чужой роли, но право перечитывается из users на каждый
// запрос: переписка account_type отзывает доступ сразу.
func (h *OwnerHandler) authorize(w http.ResponseWriter, r *http.Request) (models.Account, bool) {
	if h.sessions == nil {
		httpx.WriteError(w, errOwnerSessionsDisabled)
		return models.Account{}, false
	}

	claims, err := h.sessions.ClaimsFromRequest(r)
	switch {
	case errors.Is(err, auth.ErrInvalid):
		httpx.WriteError(w, errOwnerUnauthorized)
		return models.Account{}, false
	case err != nil:
		httpx.WriteError(w, err)
		return models.Account{}, false
	}
	if claims.Role != models.RoleOwnerActivity && claims.Role != models.RoleOwnerService {
		// moderator и tester кабинет владельца не открывают: у них свои разделы.
		httpx.WriteError(w, errOwnerForbidden)
		return models.Account{}, false
	}

	acc, err := h.store.AccountByID(r.Context(), claims.UserID)
	if errors.Is(err, repository.ErrNotFound) {
		// Кука живёт дольше удалённой учётной записи: это просроченная сессия.
		httpx.WriteError(w, errOwnerUnauthorized)
		return models.Account{}, false
	}
	if err != nil {
		httpx.WriteError(w, err)
		return models.Account{}, false
	}
	if !acc.IsOwner() {
		httpx.WriteError(w, errOwnerForbidden)
		return models.Account{}, false
	}
	return acc, true
}

// schemaReady — проверка только для подачи: без таблиц модерации заявка не
// создастся, и пустой «успех» был бы выдумкой. Список и деталь читают cards,
// которая есть в любой базе §7, поэтому их эта проверка не касается.
func (h *OwnerHandler) schemaReady(w http.ResponseWriter, r *http.Request) bool {
	ready, err := h.store.ModerationSchemaReady(r.Context())
	if err != nil {
		httpx.WriteError(w, err)
		return false
	}
	if !ready {
		httpx.WriteError(w, errOwnerSchemaNotReady)
		return false
	}
	return true
}

// ownerHeaders ставит приватность до ответа: 401 и 403 кэшируются так же плохо,
// как список, а Vary говорит общему кэшу, что ответ зависит от куки. ETag здесь
// нет намеренно — на private, no-store он не даёт ничего, кроме лишней ветки.
func ownerHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cachePrivate)
	w.Header().Add("Vary", varyCookie)
}

var (
	errOwnerUnauthorized = httpx.NewError(http.StatusUnauthorized,
		"нужна сессия владельца: войдите в кабинет", nil)
	errOwnerForbidden = httpx.NewError(http.StatusForbidden,
		"кабинет владельца доступен только владельцам занятий и услуг", nil)
	errOwnerSessionsDisabled = httpx.NewError(http.StatusServiceUnavailable,
		"кабинет владельца выключен: не задан SESSION_SECRET, подписывать куку нечем", nil)
	errOwnerSchemaNotReady = httpx.NewError(http.StatusServiceUnavailable,
		"кабинет владельца не готов: в базе нет таблиц модерации — прогоните database/init.sql", nil)
	errOwnerCardForeign = httpx.NewError(http.StatusForbidden,
		"карточка принадлежит другому владельцу", nil)
	errOwnerOrgForeign = httpx.NewError(http.StatusForbidden,
		"организация принадлежит другому владельцу", nil)
	errOwnerKind = httpx.NewError(http.StatusForbidden,
		"владелец занятий управляет только занятиями, владелец услуг — только услугами", nil)
)

// ownerKindFor — вид карточки от роли. Пустое поле означает «по умолчанию»,
// непустое обязано совпадать: несоответствие — 403, а не 400, потому что это
// попытка выйти за пределы своего кабинета, а не опечатка в поле.
func ownerKindFor(acc models.Account, requested string) (string, error) {
	kind := acc.OwnerKind()
	requested = strings.TrimSpace(requested)
	if requested != "" && requested != kind {
		return "", errOwnerKind
	}
	return kind, nil
}

// ownerPathID — параметр пути. Нечисловой id — 400 с именем параметра: это
// ошибка клиента, а не отсутствующая карточка (для которой 404).
func ownerPathID(w http.ResponseWriter, raw string) (int64, bool) {
	key := strings.TrimSpace(raw)
	if key == "" {
		httpx.WriteError(w, httpx.NewNotFound("карточка не найдена"))
		return 0, false
	}
	id, err := strconv.ParseInt(key, 10, 64)
	if err != nil || id <= 0 {
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			"id": "id — целое число карточки из вашего списка",
		}))
		return 0, false
	}
	return id, true
}

// decodeOwnerBody читает тело с ограничением размера.
//
// DisallowUnknownFields здесь НЕ ставится, в отличие от кабинета модерации:
// клиент присылает и поля идентичности (owner_id, status, is_active, slug),
// которые сервер обязан проигнорировать. В модели их нет, поэтому игнорирование
// безопасно — они не попадают ни в запрос, ни в ответ.
func decodeOwnerBody(w http.ResponseWriter, r *http.Request, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxOwnerBody))
	if err := dec.Decode(dst); err != nil {
		return httpx.NewBadRequest(map[string]string{
			"body": "ожидался корректный JSON: " + err.Error(),
		})
	}
	return nil
}

// normalizeOwnerCard приводит тело к тому, что принимает база (§8, табл. 1):
// длины VARCHAR, CHECK-списки format и lesson_type, обязательное направление.
// Проверка до запроса нужна затем, что Postgres ответил бы 22001/23514, а это
// 500 на месте честного 400 с именем поля (§9).
func normalizeOwnerCard(raw models.OwnedCardInput, kind string) (models.OwnedCardInput, error) {
	fields := map[string]string{}
	in := raw
	in.Kind = kind

	in.Name = strings.TrimSpace(raw.Name)
	switch {
	case in.Name == "":
		fields["name"] = "name — название обязательно"
	case !utf8.ValidString(in.Name):
		fields["name"] = "name должен быть корректной строкой в UTF-8"
	case utf8.RuneCountInString(in.Name) > maxCardNameRunes:
		fields["name"] = "name — не больше " + strconv.Itoa(maxCardNameRunes) + " символов"
	}

	switch {
	case in.CategoryID == nil:
		fields["category_id"] = "category_id — направление обязательно"
	case *in.CategoryID <= 0:
		fields["category_id"] = "category_id — целое число из справочника направлений"
	}

	if in.OrgID != nil && *in.OrgID <= 0 {
		fields["org_id"] = "org_id — целое число своей организации"
	}

	in.Format = strings.TrimSpace(raw.Format)
	if in.Format == "" {
		// §8, табл. 1: значение по умолчанию у cards.format — offline.
		in.Format = "offline"
	} else if !models.CardFormatAllowed(in.Format) {
		fields["format"] = "format — " + strings.Join(models.CardFormats, ", ")
	}

	if in.LessonType != nil {
		lesson := strings.TrimSpace(*in.LessonType)
		switch {
		case lesson == "":
			in.LessonType = nil
		case kind == models.CardKindService:
			// CHECK cards_service_has_no_lesson_type: у услуги его быть не может.
			fields["lesson_type"] = "lesson_type — только у занятия: услуга не делится на индивидуальные и групповые"
		case !models.CardLessonTypeAllowed(lesson):
			fields["lesson_type"] = "lesson_type — " + strings.Join(models.CardLessonTypes, ", ")
		default:
			in.LessonType = &lesson
		}
	}

	in.Description = ownerOptionalText(raw.Description, 0, "description", fields)
	in.Phone = ownerOptionalText(raw.Phone, maxCardPhoneRunes, "phone", fields)

	if len(fields) > 0 {
		return in, httpx.NewBadRequest(fields)
	}
	return in, nil
}

// normalizeOwnerOrganization — то же для организации (§8, табл. 2): телефон
// обязателен, тип только из закрытого CHECK-списка, координаты только вместе и
// только в рамке Приднестровья. Slug и поля идентичности сюда не попадают вовсе.
func normalizeOwnerOrganization(raw models.OwnedOrganizationInput) (models.OwnedOrganizationInput, error) {
	fields := map[string]string{}
	in := raw

	in.Name = strings.TrimSpace(raw.Name)
	switch {
	case in.Name == "":
		fields["name"] = "name — название обязательно"
	case !utf8.ValidString(in.Name):
		fields["name"] = "name должен быть корректной строкой в UTF-8"
	case utf8.RuneCountInString(in.Name) > maxOrgNameRunes:
		fields["name"] = "name — не больше " + strconv.Itoa(maxOrgNameRunes) + " символов"
	}

	in.Type = strings.TrimSpace(raw.Type)
	if !models.IsOrganizationType(in.Type) {
		fields["type"] = "type — " + strings.Join(models.OrganizationTypes, ", ")
	}

	in.Phone = strings.TrimSpace(raw.Phone)
	switch {
	case in.Phone == "":
		fields["phone"] = "phone — телефон обязателен: карточка без телефона не проходит проверку (§7.8)"
	case utf8.RuneCountInString(in.Phone) > maxOrgPhoneRunes:
		fields["phone"] = "phone — не больше " + strconv.Itoa(maxOrgPhoneRunes) + " символов"
	}

	if in.Email != nil {
		email := normalizeEmail(*in.Email)
		switch {
		case email == "":
			in.Email = nil
		case !validEmail(email):
			fields["email"] = "email — почтовый адрес вида name@example.com, не больше 254 символов"
		default:
			in.Email = &email
		}
	}

	in.Site = ownerOptionalText(raw.Site, maxOrgSiteRunes, "site", fields)
	if in.Site != nil {
		site := *in.Site
		u, err := url.Parse(site)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			fields["site"] = "site — адрес со схемой http:// или https://"
			in.Site = nil
		}
	}

	in.Address = ownerOptionalText(raw.Address, maxOrgAddressRunes, "address", fields)
	in.Description = ownerOptionalText(raw.Description, 0, "description", fields)

	if in.CityID != nil && *in.CityID <= 0 {
		fields["city_id"] = "city_id — целое число из справочника городов"
	}

	switch {
	case in.Lat == nil && in.Lng == nil:
	case in.Lat == nil:
		fields["lat"] = "lat — координаты заполняются только вместе"
	case in.Lng == nil:
		fields["lng"] = "lng — координаты заполняются только вместе"
	default:
		if *in.Lat < ownerLatMin || *in.Lat > ownerLatMax {
			fields["lat"] = "lat — координата вне Приднестровья (45.9…48.9)"
		}
		if *in.Lng < ownerLngMin || *in.Lng > ownerLngMax {
			fields["lng"] = "lng — координата вне Приднестровья (27.4…30.6)"
		}
	}

	if len(fields) > 0 {
		return in, httpx.NewBadRequest(fields)
	}
	return in, nil
}

// ownerOptionalText — необязательное поле: пробелы долой, пустое значение → null
// (§7.4), длина по колонке. max = 0 означает TEXT без ограничения.
func ownerOptionalText(raw *string, max int, field string, fields map[string]string) *string {
	if raw == nil {
		return nil
	}
	value := strings.TrimSpace(*raw)
	if !utf8.ValidString(value) {
		fields[field] = field + " должен быть корректной строкой в UTF-8"
		return nil
	}
	if value == "" {
		return nil
	}
	if max > 0 && utf8.RuneCountInString(value) > max {
		fields[field] = field + " — не больше " + strconv.Itoa(max) + " символов"
		return nil
	}
	return &value
}

// ownerStoreError — отказы хранилища в конверт §9. Текст ошибки базы наружу не
// уходит: httpx.WriteError логирует его и отдаёт общее сообщение (§6.7).
func ownerStoreError(w http.ResponseWriter, err error, notFound string) {
	var statusErr *repository.CardStatusError
	switch {
	case errors.Is(err, repository.ErrNotFound):
		httpx.WriteError(w, httpx.NewNotFound(notFound))
	case errors.Is(err, repository.ErrNoOwnerOrganization):
		httpx.WriteError(w, httpx.NewNotFound(
			"у вас нет организации: карточка создаётся только при своей организации"))
	case errors.Is(err, repository.ErrCardNotOwned):
		httpx.WriteError(w, errOwnerCardForeign)
	case errors.Is(err, repository.ErrKindMismatch):
		httpx.WriteError(w, errOwnerKind)
	case errors.Is(err, repository.ErrOrgNotOwned):
		httpx.WriteError(w, errOwnerOrgForeign)
	case errors.Is(err, repository.ErrCategoryUnknown):
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			"category_id": "направление не найдено в справочнике",
		}))
	case errors.Is(err, repository.ErrCategoryKind):
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			"category_id": "направление не подходит для этого вида карточки",
		}))
	case errors.Is(err, repository.ErrCityUnknown):
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			"city_id": "город не найден в справочнике",
		}))
	case errors.As(err, &statusErr):
		httpx.WriteError(w, ownerConflict(statusErr))
	default:
		httpx.WriteError(w, err)
	}
}

// ownerConflict — 409 с объяснением именно того перехода, который не прошёл.
// «Уже на проверке» и «опубликована» — разные ситуации, и владельцу нужно знать,
// ждать решения или сначала снять карточку с публикации.
func ownerConflict(e *repository.CardStatusError) error {
	switch e.Action {
	case repository.CardActionSubmit:
		switch e.Status {
		case models.CardStatusOnModeration:
			return httpx.NewError(http.StatusConflict,
				"карточка уже на проверке: дождитесь решения модератора", nil)
		case models.CardStatusPublished:
			return httpx.NewError(http.StatusConflict,
				"карточка уже опубликована: на проверку подаётся черновик или исправленный отказ", nil)
		default:
			return httpx.NewError(http.StatusConflict,
				"подать на проверку можно только черновик или отклонённую карточку", nil)
		}
	case repository.CardActionUpdate:
		switch e.Status {
		case models.CardStatusOnModeration:
			return httpx.NewError(http.StatusConflict,
				"карточка на проверке: править анкету, которую смотрит модератор, нельзя — дождитесь решения", nil)
		case models.CardStatusPublished:
			return httpx.NewError(http.StatusConflict,
				"карточка на публикации: сначала снимите её с публикации, затем правьте и подавайте заново", nil)
		default:
			return httpx.NewError(http.StatusConflict,
				"править можно только черновик или отклонённую карточку", nil)
		}
	case repository.CardActionUnpublish:
		return httpx.NewError(http.StatusConflict,
			"снять с публикации можно только опубликованную карточку", nil)
	default:
		return httpx.NewError(http.StatusConflict, e.Error(), nil)
	}
}
