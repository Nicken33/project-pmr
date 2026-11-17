package models

import "time"

type ReportInput struct {
	TargetType string `json:"target_type"`
	TargetID   int64  `json:"target_id,string"`
	Reason     string `json:"reason"`
	Detail     string `json:"detail"`
}

type ContentReport struct {
	ID            int64     `json:"id,string"`
	TargetType    string    `json:"target_type"`
	TargetID      int64     `json:"target_id,string"`
	ActivityID    int64     `json:"card_id,string"`
	ActivitySlug  string    `json:"card_slug"`
	ActivityTitle string    `json:"card_title"`
	Excerpt       string    `json:"target_excerpt"`
	ReporterName  string    `json:"reporter_name"`
	Reason        string    `json:"reason"`
	Detail        string    `json:"detail"`
	Status        string    `json:"status"`
	HideReason    *string   `json:"hide_reason"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ReportList struct {
	Items []ContentReport `json:"items"`
	Total int             `json:"total"`
	Page  int             `json:"page"`
	Limit int             `json:"limit"`
}
