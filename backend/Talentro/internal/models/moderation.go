package models

import "time"

// Статусы заявки на модерацию (§3.9, §8 таблица 11). Это статус *заявки*, а не
// карточки: у карточки свой перечислимый список (§8, таблица 1 — draft,
// on_moderation, published, rejected), и решение модератора обновляет оба в
// одной транзакции. Разные словари намеренно не сливаются в один: `approved` у
// заявки и `published` у карточки — разные вещи (анкету можно одобрить, а
// карточку потом снять с публикации по §7.18).
const (
	ApplicationPending  = "pending"
	ApplicationApproved = "approved"
	ApplicationRejected = "rejected"
)

// Действия модератора. Имена те же, что в CHECK на moderation_journal.action,
// и принимаются в теле POST /api/v1/moderation/applications/{id}/decision.
const (
	ActionApprove = "approve"
	ActionReject  = "reject"
)

// Действия по жалобе (§3.9.7): «скрыть с причиной» и «оставить». Имена совпадают
// со статусами, которые они ставят, — скрыть можно только с пунктом из §12.15.
const (
	ActionHide    = "hide"
	ActionDismiss = "dismiss"
)

// Статусы жалобы на контент (§3.9.7).
const (
	ReportOpen      = "open"
	ReportHidden    = "hidden"
	ReportDismissed = "dismissed"
)

// Account — учётная запись из users (§8, таблица 8) в том виде, в каком она
// нужна модерации: роль берётся из `account_type`, а не из письма и не из тела
// запроса. Наружу Account не отдаётся — это вход для проверки сессии.
type Account struct {
	ID    int64
	Name  string
	Email string
	Role  string
}

// RoleModerator — единственное значение users.account_type, дающее доступ в
// кабинет (§3.9, §8 табл. 8). Словарь ролей у схемы именно такой: tester среди
// него отсутствует, поэтому роль тестировщика (§3.7) правом на кабинет не
// считается, даже когда она прилетела в куке.
const RoleModerator = "moderator"

// IsModerator — единственный признак права на кабинет (§3.9).
func (a Account) IsModerator() bool { return a.Role == RoleModerator }

// ModerationApplication — анкета занятия в очереди модератора (§3.9.1).
//
// Это не копия cards, а заявка: строка `moderation_applications` + данные
// карточки, организации и направления одним пакетом, чтобы превью «как её
// увидят, со всеми точками и всеми группами» (§3.9.1) собиралось одним запросом
// — публичный `GET /api/v1/activities/{slug}` не подходит, он отдаёт только
// опубликованные карточки (§9.3), а QUEUE как раз показывает неопубликованные.
type ModerationApplication struct {
	ID     int64  `json:"id"`
	CardID int64  `json:"card_id"`
	Slug   string `json:"slug"`
	Title  string `json:"title"`
	Kind   string `json:"kind"`
	// Status — статус заявки: pending, approved, rejected.
	Status      string  `json:"status"`
	CardStatus  string  `json:"card_status"`
	Description *string `json:"description"`
	Format      string  `json:"format"`
	LessonType  *string `json:"lesson_type"`
	Phone       *string `json:"phone"`

	Category          *string `json:"category"`
	CategorySlug      *string `json:"category_slug"`
	SuperCategory     *string `json:"super_category"`
	SuperCategorySlug *string `json:"super_category_slug"`

	OrganizationID   int64   `json:"organization_id"`
	OrganizationSlug string  `json:"organization_slug"`
	OrganizationName string  `json:"organization_name"`
	OrganizationType string  `json:"organization_type"`
	OrganizationCity *string `json:"organization_city"`

	// Превью анкеты (§3.9.1): группы с расписанием и точки, как их увидит
	// пользователь. Типы переиспользуются у каталога — имена полей те же.
	Groups         []Group    `json:"groups"`
	Locations      []Location `json:"locations"`
	Photos         []string   `json:"photos"`
	GroupsCount    int        `json:"groups_count"`
	LocationsCount int        `json:"locations_count"`

	SubmittedAt  *time.Time `json:"submitted_at"`
	RejectReason *string    `json:"reject_reason"`
	DecidedAt    *time.Time `json:"decided_at"`
	DecidedBy    *string    `json:"decided_by"`
	DecidedByID  *int64     `json:"decided_by_id"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// ModerationJournalEntry — строка журнала решений (§3.9.4, §8 таблица 11).
// Журнал только на чтение: ни один обработчик UPDATE по нему не делает.
type ModerationJournalEntry struct {
	ID               int64  `json:"id"`
	ApplicationID    int64  `json:"application_id"`
	CardID           int64  `json:"card_id"`
	CardSlug         string `json:"card_slug"`
	CardTitle        string `json:"card_title"`
	OrganizationSlug string `json:"organization_slug"`
	ActorID          int64  `json:"actor_id"`
	ActorName        string `json:"actor_name"`
	// Action — approve или reject (§8 таблица 11, «решение»).
	Action    string    `json:"action"`
	Reason    *string   `json:"reason"`
	Comment   *string   `json:"comment"`
	CreatedAt time.Time `json:"created_at"`
}

// ContentReport — жалоба на контент из второй очереди модератора (§3.9.7).
// target_id + target_type — как в media (§8 таблица 7): ссылка на запись, у
// которой пока нет своей таблицы (отзывы — §8 таблица 12), поэтому внешнего
// ключа здесь нет и быть не может.
type ContentReport struct {
	ID            int64     `json:"id"`
	TargetType    string    `json:"target_type"`
	TargetID      int64     `json:"target_id"`
	TargetExcerpt *string   `json:"target_excerpt"`
	Reason        string    `json:"reason"`
	Detail        *string   `json:"detail"`
	Status        string    `json:"status"`
	HideReason    *string   `json:"hide_reason"`
	ReporterID    *int64    `json:"reporter_id"`
	ReporterName  *string   `json:"reporter_name"`
	CardID        *int64    `json:"card_id"`
	CardSlug      *string   `json:"card_slug"`
	CardTitle     *string   `json:"card_title"`
	DecidedBy     *string   `json:"decided_by"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ModerationQueueFilter — параметры GET /api/v1/moderation/queue. Пустой Status
// означает «все заявки», а не «никакие» (§5.8 тот же приём, что у каталога).
type ModerationQueueFilter struct {
	Status string
	Page   int
	Limit  int
}

// JournalFilter — параметры GET /api/v1/moderation/journal.
type JournalFilter struct {
	Page  int
	Limit int
}

// ReportFilter — параметры GET /api/v1/moderation/reports.
type ReportFilter struct {
	Status string
	Page   int
	Limit  int
}

// DecisionInput — тело POST …/decision. Comment необязателен при approve и
// вместе с Reason уходит в журнал (§8 таблица 11).
type DecisionInput struct {
	Action  string `json:"action"`
	Reason  string `json:"reason"`
	Comment string `json:"comment"`
}

// DecisionResult — что обработчик отдаёт после решения, и то же самое в
// единицу ответа на повтор (идемпотентность).
type DecisionResult struct {
	Application *ModerationApplication  `json:"application"`
	Entry       *ModerationJournalEntry `json:"journal_entry"`
	// Replayed — true, когда повтор запроса не создал новую строку журнала, а
	// вернул уже принятое решение.
	Replayed bool `json:"replayed"`
}

// ReportDecisionInput — тело POST /api/v1/moderation/reports/{id}/decision.
// Reason обязателен при hide (§12.15) и не сохраняется при dismiss.
type ReportDecisionInput struct {
	Action string `json:"action"`
	Reason string `json:"reason"`
}
