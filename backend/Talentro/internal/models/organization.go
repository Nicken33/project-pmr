package models

import "time"

type Organization struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Type        string     `json:"type"`
	Description *string    `json:"description,omitempty"`
	Phone       string     `json:"phone"`
	Email       *string    `json:"email,omitempty"`
	Website     *string    `json:"website,omitempty"`
	Messengers  *[]string  `json:"messengers,omitempty"`
	CityID      *string    `json:"city_id,omitempty"`
	Location    *string    `json:"location,omitempty"`
	Latitude    float64    `json:"latitude"`
	Longitude   float64    `json:"longitude"`
	OwnerID     *string    `json:"owner_id,omitempty"`
	VerifiedAt  *time.Time `json:"verified_at,omitempty"`
}
