package handlers

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"talentro/internal/models"
)

// Парсит query-парметры и заполняет фильтр на основе этих данных
func parseActivityFilter(q url.Values) (models.ActivityFilter, error) {
	f := models.ActivityFilter{Page: 1, Limit: 20}

	f.Query = optionalString(q, "q")

	if city := q.Get("city"); city != "" {
		id, err := parsePositiveID("city", city)
		if err != nil {
			return f, err
		}
		f.CityID = &id
	}

	for _, district := range q["district"] {
		for _, rawID := range strings.Split(district, ",") {
			if rawID == "" {
				continue
			}

			id, err := parsePositiveID("district", rawID)
			if err != nil {
				return f, err
			}
			f.DistrictIDs = append(f.DistrictIDs, id)
		}
	}

	if category := q.Get("category"); category != "" {
		id, err := parsePositiveID("category", category)
		if err != nil {
			return f, err
		}
		f.CategoryID = &id
	}
	var err error

	if f.Age, err = optionalInt(q, "age", 0); err != nil {
		return f, err
	}
	if f.PriceMax, err = optionalInt(q, "price_max", 0); err != nil {
		return f, err
	}
	if f.Free, err = optionalBool(q, "free"); err != nil {
		return f, err
	}
	if f.Online, err = optionalBool(q, "online"); err != nil {
		return f, err
	}
	if f.Verified, err = optionalBool(q, "verified"); err != nil {
		return f, err
	}
	if f.Kind = optionalString(q, "kind"); f.Kind != nil && *f.Kind != "activity" && *f.Kind != "service" {
		return f, fmt.Errorf("параметр kind должен быть activity или service")
	}
	f.Day = optionalString(q, "day")
	if f.Day != nil {
		day, err := strconv.Atoi(*f.Day)
		if err != nil || day < 1 || day > 7 {
			return f, fmt.Errorf("параметр day должен быть числом от 1 до 7")
		}
	}
	f.Time = optionalString(q, "time")
	if f.Time != nil {
		switch *f.Time {
		case "утро", "morning", "день", "day", "вечер", "evening":
		default:
			return f, fmt.Errorf("параметр time должен быть утро, день или вечер")
		}
	}
	near := strings.TrimSpace(q.Get("near"))
	if near != "" {
		parts := strings.Split(near, ",")
		if len(parts) != 2 {
			return f, fmt.Errorf("параметр near должен иметь вид широта,долгота")
		}
		lat, err := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
		if err != nil || lat < -90 || lat > 90 {
			return f, fmt.Errorf("широта в near должна быть числом от -90 до 90")
		}
		lon, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		if err != nil || lon < -180 || lon > 180 {
			return f, fmt.Errorf("долгота в near должна быть числом от -180 до 180")
		}
		f.Latitude, f.Longitude = &lat, &lon
	} else if q.Get("latitude") != "" || q.Get("longitude") != "" {
		if f.Latitude, err = optionalFloat(q, "latitude", -90, 90); err != nil {
			return f, err
		}
		if f.Longitude, err = optionalFloat(q, "longitude", -180, 180); err != nil {
			return f, err
		}
		if (f.Latitude == nil) != (f.Longitude == nil) {
			return f, fmt.Errorf("параметры latitude и longitude нужно передавать вместе")
		}
	}
	if f.Radius, err = optionalInt(q, "radius", 1); err != nil {
		return f, err
	}
	if f.Radius != nil && (*f.Radius < 500 || *f.Radius > 10000) {
		return f, fmt.Errorf("параметр radius должен быть от 500 до 10000 метров")
	}
	if f.Latitude != nil && f.Radius == nil {
		defaultRadius := 3000
		f.Radius = &defaultRadius
	}
	if f.Sort = optionalString(q, "sort"); f.Sort != nil && *f.Sort != "relevance" && *f.Sort != "near" && *f.Sort != "rating" && *f.Sort != "new" && *f.Sort != "free" && *f.Sort != "updated_week" {
		return f, fmt.Errorf("параметр sort должен быть relevance, near, rating, new, free или updated_week")
	}
	if f.Page, err = optionalIntValue(q, "page", 1, 1, 1000000); err != nil {
		return f, err
	}
	if f.Limit, err = optionalIntValue(q, "limit", 20, 1, 100); err != nil {
		return f, err
	}
	if f.Radius != nil && f.Latitude == nil {
		return f, fmt.Errorf("параметр radius требует near")
	}
	if f.Sort != nil && *f.Sort == "near" && f.Latitude == nil {
		return f, fmt.Errorf("сортировка near требует near")
	}
	return f, nil
}

func optionalString(q url.Values, key string) *string {
	value := strings.TrimSpace(q.Get(key))
	if value == "" {
		return nil
	}
	return &value
}

func optionalID(q url.Values, key string) (*string, error) {
	value := strings.TrimSpace(q.Get(key))
	if value == "" {
		return nil, nil
	}
	if err := validatePositiveID(key, value); err != nil {
		return nil, err
	}
	return &value, nil
}

func coalesceQueryValue(q url.Values, keys ...string) (string, error) {
	var result string
	for _, key := range keys {
		value := strings.TrimSpace(q.Get(key))
		if value == "" {
			continue
		}
		if result != "" && result != value {
			return "", fmt.Errorf("параметры %s содержат разные значения", strings.Join(keys, ", "))
		}
		result = value
	}
	return result, nil
}

func validatePositiveID(key, value string) error {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return fmt.Errorf("параметр %s должен быть положительным целым числом", key)
	}
	return nil
}

func optionalInt(q url.Values, key string, min int) (*int, error) {
	value := strings.TrimSpace(q.Get(key))
	if value == "" {
		return nil, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n < min {
		return nil, fmt.Errorf("параметр %s должен быть целым числом не меньше %d", key, min)
	}
	return &n, nil
}

func optionalIntValue(q url.Values, key string, fallback, min, max int) (int, error) {
	value := strings.TrimSpace(q.Get(key))
	if value == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n < min || (max > 0 && n > max) {
		if max > 0 {
			return 0, fmt.Errorf("параметр %s должен быть от %d до %d", key, min, max)
		}
		return 0, fmt.Errorf("параметр %s должен быть не меньше %d", key, min)
	}
	return n, nil
}

func optionalBool(q url.Values, key string) (*bool, error) {
	value := strings.TrimSpace(q.Get(key))
	if value == "" {
		return nil, nil
	}
	b, err := strconv.ParseBool(value)
	if err != nil {
		return nil, fmt.Errorf("параметр %s должен быть true или false", key)
	}
	return &b, nil
}

func optionalFloat(q url.Values, key string, min, max float64) (*float64, error) {
	value := strings.TrimSpace(q.Get(key))
	if value == "" {
		return nil, nil
	}
	n, err := strconv.ParseFloat(value, 64)
	if err != nil || n < min || n > max {
		return nil, fmt.Errorf("параметр %s должен быть числом от %g до %g", key, min, max)
	}
	return &n, nil
}

func stringPtr(value string) *string { return &value }

func parsePositiveID(key, value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf(
			"параметр %s должен быть положительным целым числом",
			key,
		)
	}
	return id, nil
}
