package models

import "time"

// Card is the compact public representation returned by the current search query.
type Card struct {
	ID                int64          `json:"id,string"`
	Slug              string         `json:"slug"`
	Name              string         `json:"name"`
	Description       *string        `json:"description,omitempty"`
	RecordType        string         `json:"record_type"`
	Status            string         `json:"status"`
	CityID            int64          `json:"city_id,string"`
	City              string         `json:"city"`
	DistrictID        *int64         `json:"district_id,string,omitempty"`
	District          *string        `json:"district,omitempty"`
	DirectionID       int64          `json:"direction_id,string"`
	Direction         string         `json:"direction"`
	OrganizationID    *int64         `json:"organization_id,string,omitempty"`
	Organization      *string        `json:"organization,omitempty"`
	ClassType         string         `json:"class_type"`
	ClassFormat       string         `json:"class_format"`
	PriceFrom         *int64         `json:"price_from,omitempty"`
	PriceTo           *int64         `json:"price_to,omitempty"`
	PricePeriod       *string        `json:"price_period,omitempty"`
	AgeFrom           *int           `json:"age_from,omitempty"`
	AgeTo             *int           `json:"age_to,omitempty"`
	Age               CardAge        `json:"age"`
	Address           *string        `json:"address,omitempty"`
	Latitude          *float64       `json:"latitude,omitempty"`
	Longitude         *float64       `json:"longitude,omitempty"`
	Phone             *string        `json:"phone,omitempty"`
	Email             *string        `json:"email,omitempty"`
	Website           *string        `json:"website,omitempty"`
	CoverPath         *string        `json:"cover_path,omitempty"`
	CoverAlt          *string        `json:"cover_alt,omitempty"`
	ContactsCheckedAt *time.Time     `json:"contacts_checked_at,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	Verified          bool           `json:"verified"`
	Rating            CardRating     `json:"rating"`
	Schedules         []CardSchedule `json:"schedules,omitempty"`
	Photos            []CardPhoto    `json:"photos,omitempty"`
}

type CardSearchResult struct {
	Items []Card `json:"items"`
	Total int64  `json:"total"`
	Page  int    `json:"page"`
	Limit int    `json:"limit"`
}

type CardAge struct {
	MinAge *int `json:"min_age"`
	MaxAge *int `json:"max_age"`
}

type CardRating struct {
	Score      int64 `json:"score"`
	VotesCount int64 `json:"votes_count"`
	Likes      int64 `json:"likes"`
	Dislikes   int64 `json:"dislikes"`
}

type CardSchedule struct {
	Weekday   int     `json:"weekday"`
	StartTime string  `json:"start_time"`
	EndTime   string  `json:"end_time"`
	Note      *string `json:"note,omitempty"`
}

type CardPhoto struct {
	Path     string  `json:"path"`
	AltText  *string `json:"alt_text,omitempty"`
	Position int     `json:"position"`
	IsCover  bool    `json:"is_cover"`
}

type Reference struct {
	ID         int64  `json:"id,string"`
	Name       string `json:"name"`
	CityID     *int64 `json:"city_id,string,omitempty"`
	ParentID   *int64 `json:"parent_id,string,omitempty"`
	SortOrder  int    `json:"sort_order,omitempty"`
	RecordType string `json:"record_type,omitempty"`
}

type Category struct {
	ID         int64      `json:"id,string"`
	Name       string     `json:"name"`
	RecordType string     `json:"record_type"`
	SortOrder  int        `json:"sort_order"`
	Children   []Category `json:"children,omitempty"`
}

type CardDetails struct {
	Card
	Messengers []OrganizationMessenger `json:"messengers,omitempty"`
}

type OrganizationMessenger struct {
	Channel string `json:"channel"`
	Contact string `json:"contact"`
}

type OrganizationDetails struct {
	ID          int64                   `json:"id,string"`
	Name        string                  `json:"name"`
	Type        string                  `json:"type"`
	Description *string                 `json:"description,omitempty"`
	Phone       string                  `json:"phone"`
	Email       *string                 `json:"email,omitempty"`
	Website     *string                 `json:"website,omitempty"`
	CityID      int64                   `json:"city_id,string"`
	DistrictID  int64                   `json:"district_id,string"`
	OwnerID     int64                   `json:"-"`
	Messengers  []OrganizationMessenger `json:"messengers,omitempty"`
	Cards       []Card                  `json:"cards,omitempty"`
}

type Favorite struct {
	CardID int64 `json:"card_id,string"`
}

type Vote struct {
	Value *int `json:"value"`
}

type VoteResult struct {
	Plus  int64 `json:"plus"`
	Minus int64 `json:"minus"`
}

type User struct {
	ID           int64  `json:"id,string"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	AccountType  string `json:"account_type"`
	PasswordHash string `json:"-"`
}

type ModerationDecision struct {
	Comment string `json:"comment"`
}

type ModerationCard struct {
	ID              int64   `json:"id,string"`
	Slug            string  `json:"slug"`
	Name            string  `json:"name"`
	Status          string  `json:"status"`
	RejectionReason *string `json:"rejection_reason,omitempty"`
}

type CardMutation struct {
	Slug           string   `json:"slug"`
	Name           string   `json:"name"`
	Description    *string  `json:"description"`
	RecordType     string   `json:"record_type"`
	OrganizationID *int64   `json:"organization_id"`
	CityID         int64    `json:"city_id"`
	DistrictID     *int64   `json:"district_id"`
	Address        *string  `json:"address"`
	Latitude       *float64 `json:"latitude"`
	Longitude      *float64 `json:"longitude"`
	DirectionID    int64    `json:"direction_id"`
	PriceFrom      *int64   `json:"price_from"`
	PriceTo        *int64   `json:"price_to"`
	PricePeriod    *string  `json:"price_period"`
	ClassType      string   `json:"class_type"`
	ClassFormat    string   `json:"class_format"`
	AgeFrom        *int     `json:"age_from"`
	AgeTo          *int     `json:"age_to"`
}

type CreateUser struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	Name        string `json:"name"`
	AccountType string `json:"account_type"`
}

type AuthCredentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type UpdateUser struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type AuthToken struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type OrganizationMutation struct {
	Name        string                  `json:"name"`
	Type        string                  `json:"organization_type"`
	Description *string                 `json:"description"`
	Phone       string                  `json:"phone"`
	Email       *string                 `json:"email"`
	Website     *string                 `json:"website"`
	CityID      int64                   `json:"city_id"`
	DistrictID  int64                   `json:"district_id"`
	Messengers  []OrganizationMessenger `json:"messengers"`
}

type Review struct {
	ID        int64     `json:"id,string"`
	CardID    int64     `json:"card_id,string"`
	UserID    int64     `json:"user_id,string"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}
