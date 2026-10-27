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

type Card struct {
	ID             int64    `json:"id,string"` // Проверить тип
	Name           string   `json:"name"`
	OrganizationID int      `json:"org_id"` // После этого тип организации
	City           string   `json:"city"`
	Age            AgeRange `json:"age"`
	Link           *string  `json:"link"`
	Description    *string  `json:"description"`
	District       *string  `json:"district"`
	Price          *float64 `json:"price"`
	Category       *string  `json:"category"`
}
