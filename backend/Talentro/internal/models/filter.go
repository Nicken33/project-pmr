package models

type ActivityFilter struct {
	Query *string

	CityID      *string
	DistrictIDs []string

	CategoryID *string
	Age        *int

	PriceMax *int
	Free     *bool

	Kind     *string
	Online   *bool
	Verified *bool

	Day  *string
	Time *string

	Latitude  *float64
	Longitude *float64
	Radius    *int

	Sort  *string
	Page  int
	Limit int
}
