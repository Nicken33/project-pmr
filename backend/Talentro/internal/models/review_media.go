package models

type ReviewMedia struct {
	ID        int64   `json:"id,string"`
	Path      string  `json:"path"`
	MediaType string  `json:"media_type"`
	Position  int     `json:"position"`
	Caption   *string `json:"alt_text,omitempty"`
}
