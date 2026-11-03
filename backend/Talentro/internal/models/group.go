package models

import "time"

type AgeRange struct {
	Min *int `json:"min"`
	Max *int `json:"max"`
}

type Group struct {
	ID         string  `json:"id"`
	ActivityID string  `json:"activity_id"`
	Name       *string `json:"name,omitempty"`

	Age AgeRange `json:"age"`

	PriceMin    int     `json:"price_min"`
	PriceMax    *int    `json:"price_max,omitempty"`
	PricePeriod *string `json:"price_period,omitempty"`

	LocationID string `json:"location_id"`

	Schedule   []Schedule `json:"schedule"`
	PlacesLeft *int       `json:"places_left,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
