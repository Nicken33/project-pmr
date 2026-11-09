package models

import "time"

// Роли владельца (§3.8, §8 табл. 8). Значения — буквально CHECK на
// users.account_type в database/init.sql: второго словаря ролей у схемы нет, а
// роль, которой нет в CHECK, не смогла бы ни войти, ни владеть карточкой.
const (
	RoleOwnerActivity = "owner_activity"
	RoleOwnerService  = "owner_service"
)

// Вид карточки (§8, табл. 1). Владелец занятий управляет только activity,
// владелец услуг — только service: это разные кабинеты и разные организации.
const (
	CardKindActivity = "activity"
	CardKindService  = "service"
)

// Статусы карточки (§8, табл. 1). Отдельный словарь от статусов заявки
// (ApplicationPending/Approved/Rejected): «анкету одобрили» и «карточка
// опубликована» — разные события, и решение модератора ставит оба сразу.
const (
	CardStatusDraft        = "draft"
	CardStatusOnModeration = "on_moderation"
	CardStatusPublished    = "published"
	CardStatusRejected     = "rejected"
)

// CardFormats и CardLessonTypes — CHECK-списки cards.format и cards.lesson_type.
// Проверка до запроса нужна затем, что Postgres ответил бы 23514, а это 500 на
// месте честного 400 с именем поля (§9).
var (
	CardFormats     = []string{"online", "offline", "both"}
	CardLessonTypes = []string{"individual", "group", "both"}
)

// OrganizationTypes — CHECK на organizations.type (§8, табл. 2). Список закрытый:
// «школа» латиницей или «студия танца» свободным текстом база не примет.
var OrganizationTypes = []string{
	"школа", "студия", "дом творчества", "спортшкола", "частный мастер",
}

// IsOrganizationType — принадлежит ли значение словарю organizations.type.
func IsOrganizationType(value string) bool {
	for _, allowed := range OrganizationTypes {
		if value == allowed {
			return true
		}
	}
	return false
}

// CardFormatAllowed / CardLessonTypeAllowed — те же словари для обработчика.
func CardFormatAllowed(value string) bool {
	for _, allowed := range CardFormats {
		if value == allowed {
			return true
		}
	}
	return false
}

func CardLessonTypeAllowed(value string) bool {
	for _, allowed := range CardLessonTypes {
		if value == allowed {
			return true
		}
	}
	return false
}

// IsOwner — право на кабинет владельца. Роль берётся из users.account_type, а не
// из куки и не из тела запроса (§12.1); tester и moderator cabinet не открывают.
func (a Account) IsOwner() bool {
	return a.Role == RoleOwnerActivity || a.Role == RoleOwnerService
}

// OwnerKind — единственный вид карточки, которым эта роль вправе управлять.
// Пустая строка означает «роли нет», и тогда сравнение с kind всегда даст отказ.
func (a Account) OwnerKind() string {
	switch a.Role {
	case RoleOwnerActivity:
		return CardKindActivity
	case RoleOwnerService:
		return CardKindService
	default:
		return ""
	}
}

// OwnedCard — карточка глазами её владельца: тот же Card, что в каталоге (имена
// полей не меняются, web читает их одним парсером), плюс то, что каталог не
// показывает и показывать не должен — владелец, активность, причина отказа и
// дата создания.
//
// OwnerID указателем: cards.owner_id NULL-able, и карточка без владельца не
// принадлежит никому — нулевой id не равен ни одной сессии.
type OwnedCard struct {
	Card

	OwnerID      *int64    `json:"owner_id"`
	IsActive     bool      `json:"is_active"`
	RejectReason *string   `json:"reject_reason"`
	CreatedAt    time.Time `json:"created_at"`
}

// OwnedMedia — медиа глазами владельца: канонический Media встроен, поэтому
// path/caption/source_url/author/order_num выходят теми же именами и остаются
// плоскими (web читает галерею одним парсером), а сверху добавлен id строки
// media. Без него кабинет не может удалить файл: DELETE …/media/{mediaID}
// требует id, которого публичная форма не показывает. Витрина этот тип не
// получает — публичный контракт photos[]/videos[] не меняется.
type OwnedMedia struct {
	ID int64 `json:"id"`
	Media
}

// OwnedActivity — деталь кабинета в форме §9.3: те же organization, locations,
// groups, photos, videos, что у публичной карточки. Отличие одно и оно
// принципиальное: публичный ActivityBySlug отдаёт только published, а владелец
// обязан видеть и черновик, и отказ, и анкету на проверке. Медиа кабинета —
// OwnedMedia: имена полей те же, что в каталоге, плюс id для удаления.
type OwnedActivity struct {
	OwnedCard

	Organization *Organization `json:"organization"`
	Locations    []Location    `json:"locations"`
	Groups       []Group       `json:"groups"`
	Photos       []OwnedMedia  `json:"photos"`
	Videos       []OwnedMedia  `json:"videos"`
}

// OwnedOrganization — организация владельца целиком. Organization переиспользован
// без переименований; сверху добавлены только поля кабинета. Slug, owner_id,
// publish_basis, contacts_verified_at и is_active здесь читаются, но не пишутся:
// публичный адрес и основание публикации — не самообслуживание (§11.8).
type OwnedOrganization struct {
	Organization

	CityID       *int64    `json:"city_id"`
	Lat          *float64  `json:"lat"`
	Lng          *float64  `json:"lng"`
	OwnerID      *int64    `json:"owner_id"`
	PublishBasis string    `json:"publish_basis"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// OwnedCardsFilter — параметры GET /api/v1/me/activities. Kind приходит от роли,
// а не от клиента: владелец занятий не может запросить список услуг. Пустой
// Status — «все статусы», как §5.8 у каталога.
type OwnedCardsFilter struct {
	Kind   string
	Status string
	Page   int
	Limit  int
}

// OwnedCardInput — редактируемые поля карточки (§8, табл. 1).
//
// Полей owner_id, status, is_active, slug и reject_reason здесь нет намеренно:
// лишние ключи тела разбор просто игнорирует, поэтому подделать владельца или
// сразу опубликоваться нельзя даже теоретически. Kind разрешён только равным
// роли; OrgID — только своей организации.
type OwnedCardInput struct {
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	OrgID       *int64  `json:"org_id"`
	CategoryID  *int64  `json:"category_id"`
	Description *string `json:"description"`
	Format      string  `json:"format"`
	LessonType  *string `json:"lesson_type"`
	Phone       *string `json:"phone"`
}

// OwnedOrganizationInput — редактируемые поля организации. Slug, owner_id,
// publish_basis, contacts_verified_at, is_active и id отсутствуют по той же
// причине, что и в карточке: тело не может переписать идентичность.
type OwnedOrganizationInput struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	Description *string  `json:"description"`
	Phone       string   `json:"phone"`
	Email       *string  `json:"email"`
	Site        *string  `json:"site"`
	Address     *string  `json:"address"`
	CityID      *int64   `json:"city_id"`
	Lat         *float64 `json:"lat"`
	Lng         *float64 `json:"lng"`
}

// OwnedSubmitResult — ответ на подачу анкеты. Card — карточка после перехода,
// ApplicationID и SubmittedAt — строка moderation_applications, которую увидит
// модератор в /api/v1/moderation/queue. Отдельной очереди у владельца нет.
type OwnedSubmitResult struct {
	Card          OwnedCard `json:"card"`
	ApplicationID int64     `json:"application_id"`
	SubmittedAt   time.Time `json:"submitted_at"`
}
