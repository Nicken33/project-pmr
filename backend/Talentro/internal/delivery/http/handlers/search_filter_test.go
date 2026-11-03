package handlers

import (
	"net/url"
	"testing"
)

func TestParseActivityFilter(t *testing.T) {
	q := url.Values{
		"city":      {"17"},
		"district":  {"2, 3", "4"},
		"category":  {"8"},
		"q":         {"робот"},
		"age":       {"9"},
		"price_max": {"500"},
		"free":      {"false"},
		"kind":      {"activity"},
		"online":    {"true"},
		"verified":  {"true"},
		"day":       {"1"},
		"time":      {"вечер"},
		"near":      {"46.84,29.63"},
		"radius":    {"1000"},
		"sort":      {"relevance"},
		"page":      {"2"},
		"limit":     {"25"},
	}

	f, err := parseActivityFilter(q)
	if err != nil {
		t.Fatalf("parseActivityFilter returned error: %v", err)
	}
	if f.CityID == nil || *f.CityID != "17" {
		t.Errorf("CityID = %v, want 17", f.CityID)
	}
	if len(f.DistrictIDs) != 3 || f.DistrictIDs[0] != "2" || f.DistrictIDs[2] != "4" {
		t.Errorf("DistrictIDs = %v, want [2 3 4]", f.DistrictIDs)
	}
	if f.Query == nil || *f.Query != "робот" {
		t.Errorf("Query = %v, want робот", f.Query)
	}
	if f.Age == nil || *f.Age != 9 || f.PriceMax == nil || *f.PriceMax != 500 {
		t.Errorf("numeric filters were not parsed: age=%v price_max=%v", f.Age, f.PriceMax)
	}
	if f.Free == nil || *f.Free || f.Online == nil || !*f.Online || f.Verified == nil || !*f.Verified {
		t.Errorf("boolean filters were not parsed: free=%v online=%v verified=%v", f.Free, f.Online, f.Verified)
	}
	if f.Page != 2 || f.Limit != 25 || f.Sort == nil || *f.Sort != "relevance" {
		t.Errorf("paging/sort = page %d limit %d sort %v", f.Page, f.Limit, f.Sort)
	}
}

func TestParseActivityFilterRejectsInvalidValues(t *testing.T) {
	for _, q := range []url.Values{
		{"city": {"not-an-id"}},
		{"age": {"many"}},
		{"online": {"sometimes"}},
		{"latitude": {"100"}},
		{"limit": {"101"}},
		{"day": {"8"}},
		{"time": {"25:00"}},
		{"latitude": {"46.8"}},
	} {
		if _, err := parseActivityFilter(q); err == nil {
			t.Errorf("parseActivityFilter(%v) expected an error", q)
		}
	}
}
