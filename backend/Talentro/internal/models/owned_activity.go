package models

// OwnedActivityInput — данные занятия, которые владелец создаёт или редактирует.
type OwnedActivityInput struct {
	Name        string               `json:"name"`
	Description *string              `json:"description"`
	RecordType  string               `json:"record_type"`
	DirectionID int64                `json:"direction_id,string"`
	ClassType   *string              `json:"class_type"`
	ClassFormat string               `json:"class_format"`
	Phone       *string              `json:"phone"`
	Locations   []OwnedLocationInput `json:"locations"`
	Groups      []OwnedAgeGroupInput `json:"groups"`
}

// OwnedLocationInput — место проведения, добавленное в форме занятия.
// Key нужен, чтобы связать новую точку с группой до получения ID из базы.
// ID используется, если владелец редактирует уже существующую точку организации.
type OwnedLocationInput struct {
	Key        string   `json:"key"`
	ID         *int64   `json:"id,string"`
	Name       *string  `json:"name"`
	CityID     int64    `json:"city_id,string"`
	DistrictID *int64   `json:"district_id,string"`
	Address    string   `json:"address"`
	Latitude   *float64 `json:"latitude"`
	Longitude  *float64 `json:"longitude"`
	Phone      *string  `json:"phone"`
	SourceType string   `json:"source_type"`
	SourceURL  *string  `json:"source_url"`
}

// OwnedAgeGroupInput — возраст, цена и расписание одной группы.
type OwnedAgeGroupInput struct {
	Name        *string              `json:"name"`
	AgeFrom     *int                 `json:"age_from"`
	AgeTo       *int                 `json:"age_to"`
	PriceFrom   int                  `json:"price_from"`
	PriceTo     *int                 `json:"price_to"`
	PricePeriod *string              `json:"price_period"`
	LocationKey string               `json:"location_key"`
	Seats       *int                 `json:"seats"`
	Schedules   []OwnedScheduleInput `json:"schedules"`
}

// OwnedScheduleInput — один день и временной интервал группы.
type OwnedScheduleInput struct {
	Weekday   int     `json:"weekday"`
	StartTime string  `json:"start_time"`
	EndTime   string  `json:"end_time"`
	Note      *string `json:"note"`
	Seats     *int    `json:"seats"`
}

type OwnedActivity struct {
	Card
	RejectionReason *string `json:"rejection_reason,omitempty"`
	IsActive        bool    `json:"is_active"`
}
