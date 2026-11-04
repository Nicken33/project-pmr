package models

type CardFilter struct {
	CityName    *string
	CityID      *int64
	DirectionID *int64
	Age         *int
	PriceMax    *float64
	Search      *string
}

type AgeRange struct {
	MinAge *int `json:"min"`
	MaxAge *int `json:"max"`
}

// CardOrg — организация в ответе каталога: по slug фронт ведёт на
// /organizations/[slug], поэтому он не может оставаться пустым.
type CardOrg struct {
	ID   int    `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
}

type Location struct {
	ID       int64   `json:"id"`
	CardID   int64   `json:"-"`
	Name     string  `json:"name"`
	Address  *string `json:"address"`
	District *string `json:"district"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
}

type Photo struct {
	URL string  `json:"url"`
	Alt *string `json:"alt"`
}

type Card struct {
	ID             int64      `json:"id,string"`
	Name           string     `json:"name"`
	OrganizationID int        `json:"org_id"`
	Organization   *CardOrg   `json:"organization"`
	City           string     `json:"city"`
	Age            AgeRange   `json:"age"`
	Link           *string    `json:"link"`
	Description    *string    `json:"description"`
	District       *string    `json:"district"`
	Price          *float64   `json:"price"`
	Category       *string    `json:"category"`
	CategorySlug   *string    `json:"category_slug"`
	SuperSlug      *string    `json:"super_slug"`
	Locations      []Location `json:"locations"`
	Photos         []Photo    `json:"photos"`
}

type SuperCategory struct {
	Slug       string `json:"slug"`
	Title      string `json:"title"`
	ShortTitle string `json:"short_title"`
	Order      int    `json:"order"`
}

type Category struct {
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	SuperSlug string `json:"super_slug"`
	Kind      string `json:"kind"`
	Order     int    `json:"order"`
}

type Dictionaries struct {
	SuperCategories []SuperCategory `json:"supercategories"`
	Categories      []Category      `json:"categories"`
}

type City struct {
	ID        int64    `json:"id"`
	Name      string   `json:"name"`
	Districts []string `json:"districts"`
}
