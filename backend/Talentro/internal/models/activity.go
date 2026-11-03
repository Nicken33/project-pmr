package models

import "time"

type Activity struct {
	ID          string  `json:"id"`
	Sluh        string  `json:"slug"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`

	OrganizationID string `json:"organization_id"`
	Kind           string `json:"kind"`
	DirectionID    string `json:"direction_id"`

	ActivityType *string `json:"activity_type,omitempty"`
	Format       string  `json:"format"`

	Phone *string `json:"phone,omitempty"`

	Status          string  `json:"status"`
	RejectionReason *string `json:"rejection_reason,omitempty"`
	OwnerID         *string `json:"owner_id,omitempty"`

	IsActive   bool       `json:"is_active"`
	VerifiedAt *time.Time `json:"verified_at,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ActivityDetails struct {
	Activity

	Organization Organization `json:"organization"`
	Groups       []Group      `json:"groups"`
	Locations    []Location   `json:"locations"`

	Photos []Photo `json:"photos"`

	Votes VoteCounts `json:"votes"`
}

type ActivityListItem struct {
	Activity

	GroupsCount    int `json:"groups_count"`
	LocationsCount int `json:"locations_count"`

	Group    Group    `json:"group"`
	Location Location `json:"location"`

	Votes VoteCounts `json:"votes"`
}

type VoteCounts struct {
	Plus  int `json:"plus"`
	Minus int `json:"minus"`
}

type Photo struct {
	ID       string `json:"id"`
	Path     string `json:"path"`
	Position int    `json:"position"`
}
