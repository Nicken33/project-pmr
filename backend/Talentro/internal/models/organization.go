package models

type Organization struct {
	ID   int64  `json:"id"`
	Slug string `json:"slug"`
	Name string `json:"name"`
	Type string `json:"type"`

	Description *string `json:"description,omitempty"`

	Phone   string  `json:"phone"`
	Email   *string `json:"email,omitempty"`
	Website *string `json:"website,omitempty"`

	OwnerID *string `json:"owner_id,omitempty"`
}
