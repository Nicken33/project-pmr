package models

type AgeRange struct {
	MinAge int `json:"min"`
	MaxAge int `json:"max"`
}

type Section struct {
	ID             int      `json:"id"` // Проверить тип
	Link           string   `json:"link"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	OrganizationID int      `json:"org_id"` // После этого тип организации
	City           string   `json:"city"`
	District       string   `json:"district"`
	Price          float64  `json:"price"`
	Age            AgeRange `json:"age"`
	Category       string   `json:"category"`
}
