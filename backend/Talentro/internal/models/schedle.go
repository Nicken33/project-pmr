package models

type Schedule struct {
	ID      string `json:"id"`
	GroupID string `json:"group_id"`

	Weekday   string `json:"weekday"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`

	Note   *string `json:"note,omitempty"`
	Places *int    `json:"places,omitempty"`
}
