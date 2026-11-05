package models

import "time"

type Location struct {
	ID             int64 `json:"id"`
	OrganizationID int64 `json:"organization_id"`

	Name *string `json:"name,omitempty"`

	CityID     int64  `json:"city_id"`
	DistrictID *int64 `json:"district_id,omitempty"`

	Address   string  `json:"address"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`

	Phone      *string    `json:"phone,omitempty"`
	VerifiedAt *time.Time `json:"verified_at,omitempty"`

	IsActive bool `json:"is_active"`
}
