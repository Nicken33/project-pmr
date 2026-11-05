package models

type Schedule struct {
	ID      int64 `json:"id"`
	GroupID int64 `json:"group_id"`

	Weekday   string `json:"weekday"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`

	Note   *string `json:"note,omitempty"`
	Places *int    `json:"places,omitempty"`
}
