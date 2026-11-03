package repository

import (
	"strings"
	"testing"

	"talentro/internal/models"
)

func TestBuildSearchCardsQueryUsesCatalogFilters(t *testing.T) {
	city, district, direction := "17", "8", "4"
	age, price := 9, 500
	free, online, verified := true, true, true
	kind, day, at := "activity", "1", "вечер"
	queryText := "робот"
	sortBy := "rating"
	f := models.ActivityFilter{
		CityID:      &city,
		DistrictIDs: []string{district},
		CategoryID:  &direction,
		Age:         &age,
		PriceMax:    &price,
		Free:        &free,
		Online:      &online,
		Verified:    &verified,
		Kind:        &kind,
		Day:         &day,
		Time:        &at,
		Query:       &queryText,
		Sort:        &sortBy,
		Page:        2,
		Limit:       20,
	}

	sql, args := buildSearchCardsQuery(f)
	for _, fragment := range []string{
		"c.city_id = $1",
		"c.district_id = ANY($2)",
		"SELECT id FROM directions WHERE id = $3",
		"c.record_type = $6",
		"s.weekday = $7",
		"s.start_time >= $8::time",
		"c.contacts_checked_at >= now() - interval '90 days'",
		"LIMIT $11 OFFSET $12",
		"FROM card_ratings cr",
	} {
		if !strings.Contains(sql, fragment) {
			t.Errorf("query is missing %q:\n%s", fragment, sql)
		}
	}
	if len(args) != 12 {
		t.Fatalf("got %d query args, want 12: %#v", len(args), args)
	}
	if args[10] != 20 || args[11] != 20 {
		t.Errorf("limit/offset args = %v/%v, want 20/20", args[10], args[11])
	}
}

func TestBuildSearchCardsQueryAddsRadiusAndDistanceSort(t *testing.T) {
	lat, lon := 46.84, 29.63
	radius := 1000
	sort := "near"
	f := models.ActivityFilter{
		Latitude:  &lat,
		Longitude: &lon,
		Radius:    &radius,
		Sort:      &sort,
		Page:      1,
		Limit:     10,
	}

	sql, args := buildSearchCardsQuery(f)
	if !strings.Contains(sql, "c.latitude IS NOT NULL AND c.longitude IS NOT NULL") || !strings.Contains(sql, "ORDER BY 6371000 * 2 * ASIN") {
		t.Fatalf("query is missing radius filtering or distance sorting:\n%s", sql)
	}
	if len(args) != 5 || args[0] != lat || args[1] != lon || args[2] != radius {
		t.Errorf("unexpected arguments: %#v", args)
	}
}
