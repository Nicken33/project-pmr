package models

import "time"

type Location struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organization_id"`

	Name *string `json:"name,omitempty"`

	CityID     string  `json:"city_id"`
	DistrictID *string `json:"district_id,omitempty"`

	Address   string  `json:"address"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`

	Phone      *string   `json:"phone,omitempty"`
	Messengers *[]string `json:"messengers"`
	Photos     []Photo   `json:"photos"`

	VerifiedAt *time.Time `json:"verified_at,omitempty"`

	IsActive bool `json:"is_active"`
}
