package repository

import (
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"talentro/internal/models"
)

func TestSearchQueryWordsAndFilters(t *testing.T) {
	text := "  БОКС   Тирасполь  "
	city := int64(1)
	query, args, countQuery, countArgs := buildSearchCardsQueries(models.ActivityFilter{Query: &text, CityID: &city, Page: 2, Limit: 10})
	if !reflect.DeepEqual(countArgs, []any{city, "бокс", "тирасполь"}) {
		t.Fatalf("unexpected search arguments: %#v", countArgs)
	}
	if !reflect.DeepEqual(args[len(args)-2:], []any{10, 10}) {
		t.Fatalf("pagination changed: %#v", args)
	}
	for _, sql := range []string{query, countQuery} {
		for _, condition := range []string{"c.status = 'published'", "c.is_active = true", "loc.city_id = $1", "search_location.is_active = true", "$2, true)", "$3, true)"} {
			if !strings.Contains(sql, condition) {
				t.Errorf("missing condition %q", condition)
			}
		}
	}
	// COUNT и выборка должны применять одинаковую строку поиска до сортировки.
	if !strings.Contains(query, countQuery[strings.Index(countQuery, " WHERE c.status"):]) {
		t.Fatal("search and count filters differ")
	}
}

func TestSearchInputIsLiteralAndParameterized(t *testing.T) {
	text := "100% _ ! ');DROP"
	query, args, _, countArgs := buildSearchCardsQueries(models.ActivityFilter{Query: &text})
	want := []any{"100%", "_", "!", "');drop"}
	if !reflect.DeepEqual(countArgs, want) {
		t.Fatalf("got %#v, want %#v", countArgs, want)
	}
	if strings.Contains(query, "');drop") {
		t.Fatal("user input entered SQL text")
	}
	placeholders := regexp.MustCompile(`\$(\d+)`).FindAllStringSubmatch(query, -1)
	for _, match := range placeholders {
		n, _ := strconv.Atoi(match[1])
		if n < 1 || n > len(args) {
			t.Fatalf("unbound placeholder: %s", match[0])
		}
	}
}

func TestNormalizeSearch(t *testing.T) {
	if got := normalizeSearch("  ЁЛКА  "); got != "елка" {
		t.Fatalf("got %q", got)
	}
}

func TestRelevanceRanksLiteralMatchesBeforeTypos(t *testing.T) {
	text := "рисование Тирасполь"
	query, args, _, countArgs := buildSearchCardsQueries(models.ActivityFilter{Query: &text})
	if len(countArgs) != 2 || len(args) != 7 {
		t.Fatalf("unexpected parameter counts: %d, %d", len(countArgs), len(args))
	}
	order := query[strings.Index(query, " ORDER BY CASE WHEN REPLACE(LOWER(c.name)"):]
	if !strings.Contains(order, "$3, false)") || !strings.Contains(order, "$4, false)") || !strings.Contains(order, "c.id DESC") {
		t.Fatal("literal-match ranking or stable pagination missing")
	}
}
