package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"talentro/internal/auth"
	"talentro/internal/httpx"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// moderationStore — ровно то, что нужно кабинету модерации. Обработчик держит
// интерфейс, а не *repository.Repository: 401/403/404/409 проверяются на
// фейковом хранилище, без живой базы (§15 п. 8 — права решает сервер, значит
// таблица прав обязана быть под тестом и без Postgres).
type moderationStore interface {
	AccountByID(ctx context.Context, id int64) (models.Account, error)
	ModerationQueue(ctx context.Context, f models.ModerationQueueFilter) ([]models.ModerationApplication, int, error)
	ModerationJournal(ctx context.Context, f models.JournalFilter) ([]models.ModerationJournalEntry, int, error)
	ContentReports(ctx context.Context, f models.ReportFilter) ([]models.ContentReport, int, error)
	DecideApplication(ctx context.Context, id int64, actor models.Account, in models.DecisionInput) (models.DecisionResult, error)
	ReportByID(ctx context.Context, id int64) (*models.ContentReport, error)
	DecideReport(ctx context.Context, id int64, actor models.Account, in models.ReportDecisionInput) (*models.ContentReport, error)
}

// Кабинет — приватный: public, max-age=60 из каталога здесь означал бы, что
// общий кэш отдаст одному модератору чужую очередь и, что хуже, решение,
// принятое минуту назад. §3.9.5 (SLA считается по живым заявкам) это переживает
// только при no-store.
const (
	cachePrivate = "private, no-store"
	varyCookie   = "Cookie"
)

const (
	// maxDecisionBody — анкета целиком в ответ даётся, а в запрос модератор
	// приносит два коротких поля. 8 КиБ с запасом покрывают 1000 кириллических
	// символов комментария и защищают от «мусор в теле» дешевле, чем разбор.
	maxDecisionBody = 8 << 10
	// maxReasonRunes = 120 — ровно VARCHAR(120) на moderation_journal.reason и
	// content_reports.reason (§8 табл. 11, 16). Без проверки база ответила бы
	// 22001, а это 500 на месте честного 400.
	maxReasonRunes = 120
	maxCommentRunes = 1000
)

type ModerationHandler struct {
	store    moderationStore
	sessions *auth.Sessions
}

// Option — настройка обработчика. Нужен, чтобы NewModerationHandler оставался
// одноаргументным (его вызывает белый список маршрутов в route_test.go), а
// секрет сессии приходил из конфигурации.
type Option func(*ModerationHandler)

// WithSessions включает вход в кабинет: без него любой запрос — 401, а не
// «все проходят». Так пустой MODERATOR_TOKEN на стенде не превращается в
// открытый кабинет.
func WithSessions(s *auth.Sessions) Option {
	return func(h *ModerationHandler) { h.sessions = s }
}

func NewModerationHandler(store moderationStore, opts ...Option) *ModerationHandler {
	h := &ModerationHandler{store: store}
	for _, opt := range opts {
		opt(h)
	}
	return h
}

// moderationPage — форма ответа с пагинацией (§9.4). CatalogPage не переиспользуем:
// он задокументирован как тип каталога, а тут типы строк другие.
type moderationPage[T any] struct {
	Items []T `json:"items"`
	Total int `json:"total"`
	Page  int `json:"page"`
	Limit int `json:"limit"`
}

// SessionView — кого кабинет считает вошедшим. Права клиенту не выдаются: роль
// перечитывается из users на каждый запрос, поэтому ответ носит справочный
// характер (фронт по нему показывает имя, а не фильтрует очередь).
type SessionView struct {
	AccountID int64     `json:"account_id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	ExpiresAt time.Time `json:"expires_at"`
}

// Session — POST /api/v1/moderation/session: обмен общего секрета кабинета
// (MODERATOR_TOKEN) на подписанную куку.
//
// Тело — `{token, user_id}`. Секрет отвечает «вход разрешён», user_id вместе с
// users.account_type — «кто именно»: учётку, у которой в базе роль не
// moderator, не пустим, даже с правильным секретом. Паролей у этого входа нет
// намеренно: §12.1–12.4 в MVP не реализованы, а один общий секрет на команду
// модераторов — то, ради чего MODERATOR_TOKEN уже лежит в конфигурации.
func (h *ModerationHandler) Session(w http.ResponseWriter, r *http.Request) {
	moderationHeaders(w)

	var in struct {
		Token  string `json:"token"`
		UserID int64  `json:"user_id"`
	}
	if err := decodeJSON(r, w, &in); err != nil {
		httpx.WriteError(w, err)
		return
	}

	fields := map[string]string{}
	switch {
	case in.Token == "":
		fields["token"] = "нужен общий секрет кабинета (MODERATOR_TOKEN)"
	case !utf8.ValidString(in.Token):
		fields["token"] = "token должен быть корректной строкой в UTF-8"
	}
	if in.UserID <= 0 {
		fields["user_id"] = "user_id — целое число учётной записи из users.id"
	}
	if len(fields) > 0 {
		httpx.WriteError(w, httpx.NewBadRequest(fields))
		return
	}

	if !h.sessions.Enabled() {
		httpx.WriteError(w, errSessionsDisabled)
		return
	}

	acc, err := h.store.AccountByID(r.Context(), in.UserID)
	if errors.Is(err, repository.ErrNotFound) {
		// Один ответ на «нет такой учётки» и «не тот секрет»: перечислять, кто
		// в кабинете имеет право быть, — бесплатная разведка имён.
		httpx.WriteError(w, errUnauthorized)
		return
	}
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	if !h.sessions.VerifyToken(in.Token) || !acc.IsModerator() {
		httpx.WriteError(w, errUnauthorized)
		return
	}

	now := time.Now().UTC()
	token := h.sessions.Issue(w, r, acc.ID, now)
	expires, _ := h.sessions.ExpiresAt(token)
	httpx.WriteJSON(w, http.StatusOK, SessionView{
		AccountID: acc.ID, Name: acc.Name, Role: acc.Role, ExpiresAt: expires,
	})
}

// Queue — GET /api/v1/moderation/queue (§3.9.1): очередь заявок на проверку.
// Сортировка «дольше всех ждёт — выше» принадлежит запросу, а не фронту: иначе
// две вкладки кабинета разошлись бы в том, что просрочено.
func (h *ModerationHandler) Queue(w http.ResponseWriter, r *http.Request) {
	moderationHeaders(w)
	if _, ok := h.authorize(w, r); !ok {
		return
	}

	f, err := parseQueueQuery(r.URL.Query())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	items, total, err := h.store.ModerationQueue(r.Context(), f)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	w.Header().Set("ETag", queueETag(items, total))
	if notModified(w, r) {
		return
	}
	httpx.WriteJSON(w, http.StatusOK, moderationPage[models.ModerationApplication]{
		Items: items, Total: total, Page: f.Page, Limit: f.Limit,
	})
}

// Journal — GET /api/v1/moderation/journal (§3.9.4): журнал решений, свежие
// сверху. Только чтение — правок по этому обработчику не бывает (§8 табл. 11).
func (h *ModerationHandler) Journal(w http.ResponseWriter, r *http.Request) {
	moderationHeaders(w)
	if _, ok := h.authorize(w, r); !ok {
		return
	}

	f, err := parseJournalQuery(r.URL.Query())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	entries, total, err := h.store.ModerationJournal(r.Context(), f)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	w.Header().Set("ETag", journalETag(entries, total))
	if notModified(w, r) {
		return
	}
	httpx.WriteJSON(w, http.StatusOK, moderationPage[models.ModerationJournalEntry]{
		Items: entries, Total: total, Page: f.Page, Limit: f.Limit,
	})
}

// Reports — GET /api/v1/moderation/reports (§3.9.7): вторая очередь, жалобы на
// контент. Открытые первыми, внутри — дольше всех ждут выше.
func (h *ModerationHandler) Reports(w http.ResponseWriter, r *http.Request) {
	moderationHeaders(w)
	if _, ok := h.authorize(w, r); !ok {
		return
	}

	f, err := parseReportsQuery(r.URL.Query())
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	items, total, err := h.store.ContentReports(r.Context(), f)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	w.Header().Set("ETag", reportsETag(items, total))
	if notModified(w, r) {
		return
	}
	httpx.WriteJSON(w, http.StatusOK, moderationPage[models.ContentReport]{
		Items: items, Total: total, Page: f.Page, Limit: f.Limit,
	})
}

// Decide — POST /api/v1/moderation/applications/{id}/decision (§3.9.3, §3.9.6).
//
// Один ответ на «уже решено точно так же» (200 с replayed=true) и на «заявка
// закрыта другим решением» (409) различимы клиентом: повтор кнопки после
// оборвавшейся сети обязан быть успешным, а попытка переписать отказ одобрением
// — нет (§3.9.4).
func (h *ModerationHandler) Decide(w http.ResponseWriter, r *http.Request) {
	moderationHeaders(w)
	actor, ok := h.authorize(w, r)
	if !ok {
		return
	}

	id, ok := pathID(w, "id", chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var raw models.DecisionInput
	if err := decodeJSON(r, w, &raw); err != nil {
		httpx.WriteError(w, err)
		return
	}
	in, err := normalizeDecision(raw)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	result, err := h.store.DecideApplication(r.Context(), id, actor, in)
	switch {
	case errors.Is(err, repository.ErrNotFound):
		httpx.WriteError(w, httpx.NewNotFound("заявка не найдена"))
	case errors.Is(err, repository.ErrConflict):
		httpx.WriteError(w, errDecided)
	case err != nil:
		httpx.WriteError(w, err)
	default:
		httpx.WriteJSON(w, http.StatusOK, result)
	}
}

// DecideReport — POST /api/v1/moderation/reports/{id}/decision (§3.9.7):
// «скрыть с причиной» либо «оставить». Тексты авторов модератор не правит —
// меняется только статус жалобы.
func (h *ModerationHandler) DecideReport(w http.ResponseWriter, r *http.Request) {
	moderationHeaders(w)
	actor, ok := h.authorize(w, r)
	if !ok {
		return
	}

	id, ok := pathID(w, "id", chi.URLParam(r, "id"))
	if !ok {
		return
	}

	var raw models.ReportDecisionInput
	if err := decodeJSON(r, w, &raw); err != nil {
		httpx.WriteError(w, err)
		return
	}
	in, err := normalizeReportDecision(raw)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}

	report, err := h.store.DecideReport(r.Context(), id, actor, in)
	switch {
	case errors.Is(err, repository.ErrNotFound):
		httpx.WriteError(w, httpx.NewNotFound("жалоба не найдена"))
	case err != nil:
		httpx.WriteError(w, err)
	default:
		httpx.WriteJSON(w, http.StatusOK, struct {
			Report *models.ContentReport `json:"report"`
		}{Report: report})
	}
}

// authorize — единственная дверь кабинета. 401 без валидной подписи, 403 при
// валидной сессии не-модератора (§12.1, §15 п. 8): роль всегда читается из
// users.account_type, а не из куки и не из тела запроса.
func (h *ModerationHandler) authorize(w http.ResponseWriter, r *http.Request) (models.Account, bool) {
	if !h.sessions.Enabled() {
		httpx.WriteError(w, errSessionsDisabled)
		return models.Account{}, false
	}

	accountID, ok := h.sessions.UserID(r, time.Now())
	if !ok {
		httpx.WriteError(w, errUnauthorized)
		return models.Account{}, false
	}

	acc, err := h.store.AccountByID(r.Context(), accountID)
	if errors.Is(err, repository.ErrNotFound) {
		// Кука живёт дольше, чем удалённая учётная запись: это просроченная
		// сессия, а не отказ в правах.
		httpx.WriteError(w, errUnauthorized)
		return models.Account{}, false
	}
	if err != nil {
		httpx.WriteError(w, err)
		return models.Account{}, false
	}
	if !acc.IsModerator() {
		httpx.WriteError(w, errForbidden)
		return models.Account{}, false
	}
	return acc, true
}

// moderationHeaders ставит приватность до ответа: 401 и 403 кэшируются так же
// плохо, как очередь, а Vary говорит общему кэшу, что ответ зависит от куки.
func moderationHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cachePrivate)
	w.Header().Add("Vary", varyCookie)
}

var (
	errUnauthorized = httpx.NewError(http.StatusUnauthorized,
		"нужна сессия модератора: войдите в кабинет", nil)
	errForbidden = httpx.NewError(http.StatusForbidden,
		"кабинет модерации доступен только модераторам", nil)
	errDecided = httpx.NewError(http.StatusConflict,
		"заявка уже решена: отменить или переписать решение нельзя — создайте новую заявку", nil)
	errSessionsDisabled = httpx.NewError(http.StatusServiceUnavailable,
		"кабинет модерации выключен: не задан MODERATOR_TOKEN", nil)
)

// pathID — параметр пути-число. Пустой и нечисловой даём как 400 с именем
// параметра: «/moderation/applications/abc/decision» — это ошибка клиента, а не
// отсутствующая заявка (для которой 404).
func pathID(w http.ResponseWriter, param, raw string) (int64, bool) {
	key := strings.TrimSpace(raw)
	if key == "" {
		httpx.WriteError(w, httpx.NewNotFound("заявка не найдена"))
		return 0, false
	}
	if !utf8.ValidString(key) {
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			param: param + " должен быть корректной строкой в UTF-8",
		}))
		return 0, false
	}
	id, err := strconv.ParseInt(key, 10, 64)
	if err != nil || id <= 0 {
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			param: param + " — целое число заявки из очереди",
		}))
		return 0, false
	}
	return id, true
}

// decodeJSON читает тело запроса с ограничением размера и запретом неизвестных
// полей: опечатка в имени поля у модератора иначе означала бы «решение
// отправилось не тем».
func decodeJSON(r *http.Request, w http.ResponseWriter, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxDecisionBody))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return httpx.NewBadRequest(map[string]string{
			"body": "ожидался корректный JSON; неизвестные поля не принимаются: " + err.Error(),
		})
	}
	return nil
}

// normalizeDecision приводит тело к тому, что принимает база (§3.9.3, §8 табл. 11):
//   - action — только approve или reject;
//   - у отказа обязана быть типовая причина: без неё владелец не поймёт, что
//     исправлять, а CHECK на reject_reason её всё равно не простит;
//   - длина причины = VARCHAR(120), иначе PostgreSQL ответит 22001, и это будет 500;
//   - при одобрении reason и comment не сохраняются: в журнале у approve их быть
//     не может по смыслу, а тихий пропуск честнее 400 на уже верном решении.
func normalizeDecision(in models.DecisionInput) (models.DecisionInput, error) {
	fields := map[string]string{}
	in.Action = strings.TrimSpace(in.Action)
	in.Reason = strings.TrimSpace(in.Reason)
	in.Comment = strings.TrimSpace(in.Comment)

	switch in.Action {
	case models.ActionApprove:
		in.Reason, in.Comment = "", ""
	case models.ActionReject:
		if in.Reason == "" {
			fields["reason"] = "для отказа нужна причина из типового списка"
		}
	default:
		fields["action"] = "action — approve или reject"
	}

	if n := utf8.RuneCountInString(in.Reason); n > maxReasonRunes {
		fields["reason"] = "reason — не больше " + strconv.Itoa(maxReasonRunes) + " символов"
	}
	if n := utf8.RuneCountInString(in.Comment); n > maxCommentRunes {
		fields["comment"] = "comment — не больше " + strconv.Itoa(maxCommentRunes) + " символов"
	}
	for name, value := range map[string]string{"reason": in.Reason, "comment": in.Comment} {
		if !utf8.ValidString(value) {
			fields[name] = name + " должен быть корректной строкой в UTF-8"
		}
	}

	if len(fields) > 0 {
		return in, httpx.NewBadRequest(fields)
	}
	return in, nil
}

// normalizeReportDecision — то же для жалобы (§3.9.7, §12.15): скрытие только с
// пунктом из списка оснований, «оставить» причину снимает.
func normalizeReportDecision(in models.ReportDecisionInput) (models.ReportDecisionInput, error) {
	fields := map[string]string{}
	in.Action = strings.TrimSpace(in.Action)
	in.Reason = strings.TrimSpace(in.Reason)

	switch in.Action {
	case models.ActionHide:
		if in.Reason == "" {
			fields["reason"] = "при скрытии нужно основание из перечня §12.15"
		}
	case models.ActionDismiss:
		in.Reason = ""
	default:
		fields["action"] = "action — hide или dismiss"
	}

	if n := utf8.RuneCountInString(in.Reason); n > maxReasonRunes {
		fields["reason"] = "reason — не больше " + strconv.Itoa(maxReasonRunes) + " символов"
	}
	if !utf8.ValidString(in.Reason) {
		fields["reason"] = "reason должен быть корректной строкой в UTF-8"
	}

	if len(fields) > 0 {
		return in, httpx.NewBadRequest(fields)
	}
	return in, nil
}

// parseStatus проверяет значение фильтра статуса; пустое — «фильтра нет» (§5.8).
func parseStatus(q url.Values, allowed map[string]bool) (string, error) {
	status := strings.TrimSpace(q.Get("status"))
	if status == "" {
		return "", nil
	}
	if !allowed[status] {
		names := make([]string, 0, len(allowed))
		for name := range allowed {
			names = append(names, name)
		}
		return "", httpx.NewBadRequest(map[string]string{
			"status": "status — " + strings.Join(sorted(names), ", "),
		})
	}
	return status, nil
}

func parsePage(q url.Values) (page, limit int, err error) {
	page, limit = 1, defaultLimit
	fields := map[string]string{}

	if v := strings.TrimSpace(q.Get("page")); v != "" {
		n, errConv := strconv.Atoi(v)
		if errConv != nil || n < 1 {
			fields["page"] = "page — целое число от 1"
		} else {
			page = n
		}
	}
	if v := strings.TrimSpace(q.Get("limit")); v != "" {
		n, errConv := strconv.Atoi(v)
		if errConv != nil || n < 1 || n > maxLimit {
			fields["limit"] = "limit — от 1 до " + strconv.Itoa(maxLimit)
		} else {
			limit = n
		}
	}
	if len(fields) > 0 {
		return page, limit, httpx.NewBadRequest(fields)
	}
	return page, limit, nil
}

func parseQueueQuery(q url.Values) (models.ModerationQueueFilter, error) {
	f := models.ModerationQueueFilter{}
	status, err := parseStatus(q, applicationStatuses)
	if err != nil {
		return f, err
	}
	f.Status = status
	f.Page, f.Limit, err = parsePage(q)
	return f, err
}

func parseJournalQuery(q url.Values) (models.JournalFilter, error) {
	f := models.JournalFilter{}
	if _, ok := q["status"]; ok {
		return f, httpx.NewBadRequest(map[string]string{
			"status": "журнал отдаётся целиком: у него нет фильтра по статусу (§3.9.4)",
		})
	}
	var err error
	f.Page, f.Limit, err = parsePage(q)
	return f, err
}

func parseReportsQuery(q url.Values) (models.ReportFilter, error) {
	f := models.ReportFilter{}
	status, err := parseStatus(q, reportStatuses)
	if err != nil {
		return f, err
	}
	f.Status = status
	f.Page, f.Limit, err = parsePage(q)
	return f, err
}

var (
	applicationStatuses = map[string]bool{
		models.ApplicationPending:  true,
		models.ApplicationApproved: true,
		models.ApplicationRejected: true,
	}
	reportStatuses = map[string]bool{
		models.ReportOpen:      true,
		models.ReportHidden:    true,
		models.ReportDismissed: true,
	}
)

// queueETag — отпечаток страницы: id заявок и время их изменений. Решённая
// заявка меняет updated_at, поэтому второй тот же запрос не получит 304 из
// состояния «до решения».
func queueETag(items []models.ModerationApplication, total int) string {
	var b strings.Builder
	b.WriteString(strconv.Itoa(total))
	for _, app := range items {
		b.WriteByte('|')
		b.WriteString(strconv.FormatInt(app.ID, 10))
		b.WriteByte(':')
		b.WriteString(app.UpdatedAt.UTC().Format(time.RFC3339Nano))
	}
	return weak(sum(b.String()))
}

// journalETag и reportsETag — по составу строк: обе таблицы только растут, и
// старые строки не переписываются (§3.9.4), поэтому id достаточно.
func journalETag(entries []models.ModerationJournalEntry, total int) string {
	var b strings.Builder
	b.WriteString(strconv.Itoa(total))
	for _, e := range entries {
		b.WriteByte('|')
		b.WriteString(strconv.FormatInt(e.ID, 10))
	}
	return weak(sum(b.String()))
}

func reportsETag(items []models.ContentReport, total int) string {
	var b strings.Builder
	b.WriteString(strconv.Itoa(total))
	for _, rep := range items {
		b.WriteByte('|')
		b.WriteString(strconv.FormatInt(rep.ID, 10))
		b.WriteByte(':')
		b.WriteString(rep.Status)
		b.WriteByte(':')
		b.WriteString(rep.UpdatedAt.UTC().Format(time.RFC3339Nano))
	}
	return weak(sum(b.String()))
}

// sorted расставляет имена статусов по алфавиту — подсказка в 400 не должна
// менять порядок от запуска к запуску, иначе её нельзя зафиксировать тестом.
func sorted(names []string) []string {
	out := append([]string{}, names...)
	sort.Strings(out)
	return out
}
