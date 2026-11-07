package models

import "time"

type AgeRange struct {
	MinAge *int `json:"min"`
	MaxAge *int `json:"max"`
}

// Card — элемент каталога. Обязательные поля старых клиентов (`id`, `name`,
// `org_id`, `city`, `age`, `link`, `description`, `district`, `price`,
// `category`) сохранены по имени и типу: `/api/cards` дополняется, а не ломается.
//
// `city`/`district`/`lat`/`lng`/`address` берутся из подходящей точки проведения
// (§7.11), `age`/`price` — из подходящей возрастной группы (§7.10). Одна карточка
// в выдаче всегда одна строка (§5.9).
type Card struct {
	ID             string   `json:"id"`
	Slug           string   `json:"slug"`
	Name           string   `json:"name"`
	Kind           string   `json:"kind"`
	OrganizationID int64    `json:"org_id"`
	City           string   `json:"city"`
	Age            AgeRange `json:"age"`
	Link           *string  `json:"link"`
	Description    *string  `json:"description"`
	District       *string  `json:"district"`
	Price          *int     `json:"price"`
	Category       *string  `json:"category"`

	OrganizationSlug string `json:"org_slug"`
	OrganizationName string `json:"org_name"`
	OrganizationType string `json:"org_type"`
	Phone            string `json:"phone"`

	Address *string  `json:"address"`
	Lat     *float64 `json:"lat"`
	Lng     *float64 `json:"lng"`

	LocationID   *int64  `json:"location_id"`
	LocationName *string `json:"location_name"`
	GroupID      *int64  `json:"group_id"`
	GroupName    *string `json:"group_name"`
	PriceTo      *int    `json:"price_to"`
	PricePeriod  *string `json:"price_period"`
	Seats        *int    `json:"seats"`

	CategoryID        *int64  `json:"category_id"`
	CategorySlug      *string `json:"category_slug"`
	SuperCategory     *string `json:"super_category"`
	SuperCategorySlug *string `json:"super_category_slug"`

	Format     string  `json:"format"`
	LessonType *string `json:"lesson_type"`
	Status     string  `json:"status"`
	Verified   bool    `json:"verified"`
	// ContactsVerifiedAt — дата последней сверки контактов (§11). Признак
	// отвечает «свежее ли ещё», дата — «когда именно сверяли»: без неё «проверено»
	// через полгода становится ложью, а различить «сверяли давно» и «никогда» по
	// verified:false нельзя.
	ContactsVerifiedAt *string `json:"contacts_verified_at"`
	Photo              *string `json:"photo"`

	GroupsCount    int       `json:"groups_count"`
	LocationsCount int       `json:"locations_count"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// GeoPoint — точка для фильтра «рядом» (§3.5.6, §9.2).
type GeoPoint struct {
	Lat float64
	Lng float64
}

// CardFilter — параметры каталога по §5 и §9.2. Нулевые значения означают
// «фильтр не задан», поэтому пустой фильтр никогда не сужает выдачу.
type CardFilter struct {
	Query          string
	CityID         *int64
	CitySlug       string
	CityName       string
	Districts      []string
	CategoryID     *int64
	Category       string
	OrganizationID *int64
	Age            *int
	PriceMax       *int
	Free           bool
	Kind           string
	Online         *bool
	Verified       bool
	Weekday        *int
	TimeAt         *string
	Near           *GeoPoint
	RadiusM        *int
	Sort           string
	Page           int
	Limit          int
}
