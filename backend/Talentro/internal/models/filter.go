package models

type ActivityFilter struct {
	Query          *string
	Slug           *string
	ID             *int64
	FavoriteUserID *int64
	OrganizationID *int64
	MinVotes       int
	RecentDays     int

	CityID      *int64
	DistrictIDs []int64

	CategoryID *int64
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
