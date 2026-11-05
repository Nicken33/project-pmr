package models

import "time"

// Activity — карточка целиком по §9.3: поля занятия + все точки + все группы
// (у группы возраст, цена с периодом, строки расписания, id точки, места) +
// фото + организация. Отдельных эндпоинтов на группу и точку нет, раскрытие на
// фронте строится отсюда.
type Activity struct {
	Card

	Organization *Organization `json:"organization"`
	Locations    []Location    `json:"locations"`
	Groups       []Group       `json:"groups"`
	Photos       []Media       `json:"photos"`
	Videos       []Media       `json:"videos"`
}

type Organization struct {
	ID               int64   `json:"id"`
	Slug             string  `json:"slug"`
	Name             string  `json:"name"`
	Type             string  `json:"type"`
	Description      *string `json:"description"`
	Phone            string  `json:"phone"`
	Email            *string `json:"email"`
	Site             *string `json:"site"`
	Address          *string `json:"address"`
	City             *string `json:"city"`
	ContactsVerified *string `json:"contacts_verified_at"`
}

// OrganizationPage — страница организации: сама организация и её опубликованные
// занятия. Отдельного фильтра «по организации» в каталоге нет (§5), поэтому
// список карточек организации собирается здесь.
type OrganizationPage struct {
	Organization *Organization `json:"organization"`
	Activities   []Card        `json:"activities"`
	Total        int           `json:"total"`
}

type Location struct {
	ID               int64    `json:"id"`
	Name             *string  `json:"name"`
	City             string   `json:"city"`
	District         *string  `json:"district"`
	Address          string   `json:"address"`
	Lat              *float64 `json:"lat"`
	Lng              *float64 `json:"lng"`
	Phone            *string  `json:"phone"`
	ContactsVerified *string  `json:"contacts_verified_at"`
	GroupsCount      int      `json:"groups_count"`
	Photos           []Media  `json:"photos"`
}

type Group struct {
	ID          int64    `json:"id"`
	Name        *string  `json:"name"`
	AgeFrom     *int     `json:"age_from"`
	AgeTo       *int     `json:"age_to"`
	PriceFrom   *int     `json:"price_from"`
	PriceTo     *int     `json:"price_to"`
	PricePeriod *string  `json:"price_period"`
	LocationID  int64    `json:"location_id"`
	Seats       *int     `json:"seats"`
	Schedules   []Lesson `json:"schedules"`
}

// Lesson — строка расписания (§8, таблица 6). Время локальное, без даты и
// таймзоны, поэтому отдаётся строкой «ЧЧ:ММ».
type Lesson struct {
	Weekday  int     `json:"weekday"`
	TimeFrom string  `json:"time_from"`
	TimeTo   string  `json:"time_to"`
	Note     *string `json:"note"`
	Seats    *int    `json:"seats"`
}

type Media struct {
	Path    string  `json:"path"`
	Caption *string `json:"caption"`
	Source  *string `json:"source_url"`
	Author  *string `json:"author"`
	Order   int     `json:"order_num"`
}

type Category struct {
	ID       int64      `json:"id"`
	Slug     string     `json:"slug"`
	Name     string     `json:"name"`
	Kind     string     `json:"kind"`
	Icon     string     `json:"icon"`
	Order    int        `json:"order_num"`
	Children []Category `json:"children,omitempty"`
}

type Place struct {
	ID   int64  `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
	City *int64 `json:"city_id,omitempty"`
}

// TimeText превращает time.Time из lib/pq в «ЧЧ:ММ» — формат §8, таблица 6.
func TimeText(t time.Time) string {
	return t.Format("15:04")
}
