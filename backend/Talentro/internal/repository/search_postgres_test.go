package repository

import (
	"database/sql"
	"os"
	"reflect"
	"testing"

	"talentro/internal/models"
)

// TALENTRO_SEARCH_TEST_DSN points to a disposable PostgreSQL database with migration 006 applied.
// Fixtures use transaction-local temporary tables and are always rolled back.
func TestSearchPostgres(t *testing.T) {
	dsn := os.Getenv("TALENTRO_SEARCH_TEST_DSN")
	if dsn == "" {
		t.Skip("set TALENTRO_SEARCH_TEST_DSN to run PostgreSQL search tests")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	_, err = tx.Exec(`
 CREATE TEMP TABLE cities (id bigint, name text) ON COMMIT DROP;
 CREATE TEMP TABLE districts (id bigint, name text) ON COMMIT DROP;
 CREATE TEMP TABLE directions (id bigint, parent_id bigint, name text) ON COMMIT DROP;
 CREATE TEMP TABLE organizations (id bigint, name text, description text, address text, phone text, email text, website text, city_id bigint, contacts_checked_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE activities (id bigint, slug text, name text, description text, phone text, organization_id bigint, direction_id bigint, status text, is_active boolean, owner_id bigint, record_type text, class_type text, class_format text, contacts_checked_at timestamptz, created_at timestamptz, updated_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE locations (id bigint, name text, address text, phone text, city_id bigint, district_id bigint, latitude numeric, longitude numeric, is_active boolean, contacts_checked_at timestamptz) ON COMMIT DROP;
 CREATE TEMP TABLE age_groups (id bigint, activity_id bigint, location_id bigint, name text, price_from int, price_to int, price_period text, age_from int, age_to int, seats int) ON COMMIT DROP;
 CREATE TEMP TABLE activity_votes (activity_id bigint, value smallint) ON COMMIT DROP;
 CREATE TEMP TABLE schedules (id bigint, age_group_id bigint, weekday int, start_time time, end_time time, note text) ON COMMIT DROP;
 CREATE TEMP TABLE media (id bigint, activity_id bigint, location_id bigint, is_hidden boolean, media_type text, path text, caption text, sort_order int) ON COMMIT DROP;
 INSERT INTO cities VALUES (1, 'Тирасполь'), (2, 'Бендеры');
 INSERT INTO districts VALUES (1, 'Октябрьский');
 INSERT INTO directions VALUES (10, NULL, 'Творчество и искусство'), (11, 10, 'Живопись'), (12, NULL, 'Спорт');
 INSERT INTO organizations (id, name, city_id) VALUES (1, 'Студия', 1);
 INSERT INTO activities (id, name, description, organization_id, direction_id, status, is_active, class_format, created_at)
 VALUES (1, 'Рисование для детей', 'Работа с красками', 1, 11, 'published', true, 'offline', now()),
 (2, 'Ресование для детей', 'Кисти и холст', 1, 11, 'published', true, 'offline', now()),
 (3, 'Рисование', 'Черновик', 1, 11, 'draft', true, 'offline', now()),
 (4, 'Рисование', 'Выключено', 1, 11, 'published', false, 'offline', now()),
 (5, 'Футбол', 'Спорт', 1, 12, 'published', true, 'offline', now());
 INSERT INTO locations (id, name, address, city_id, district_id, is_active) VALUES (1, 'Мастерская', 'ул. Мира', 1, 1, true), (2, 'Стадион', 'ул. Ленина', 2, NULL, true);
 INSERT INTO age_groups (id, activity_id, location_id, name, price_from, age_from, age_to) VALUES (1, 1, 1, 'Начинающие', 100, 8, 12), (2, 2, 1, 'Начинающие', 100, 8, 12), (5, 5, 2, 'Юниоры', 0, 10, 16);
 ANALYZE cities; ANALYZE districts; ANALYZE directions; ANALYZE organizations; ANALYZE activities; ANALYZE locations; ANALYZE age_groups; ANALYZE media; ANALYZE activity_votes; ANALYZE schedules;
 `)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		text, term  string
		fuzzy, want bool
	}{
		{"Рисование для детей", "ресование", true, true},
		{"Рисование для детей", "ресование", false, false},
		{"Ёлка", "елка", true, true},
		{"Бокс", "бокз", true, false},
		{"Бокс", "бок", true, true},
		{"Футбол", "рисование", true, false},
		{"Секция", "%", true, false},
		{"Скидка 100%", "100%", true, true},
		{"Секция", "", true, false},
	} {
		var got bool
		if err := tx.QueryRow("SELECT public.talentro_search_match($1, $2, $3)", tc.text, tc.term, tc.fuzzy).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != tc.want {
			t.Errorf("match(%q, %q, %t) = %t", tc.text, tc.term, tc.fuzzy, got)
		}
	}
	city := int64(1)
	otherCity := int64(2)
	age := 15
	for _, tc := range []struct {
		name, search string
		city         *int64
		age          *int
		want         []int64
	}{
		{"exact before fuzzy", "рисование", nil, nil, []int64{1, 2}},
		{"literal typo before correction", "ресование", nil, nil, []int64{2, 1}},
		{"words in different fields with city typo", "рисование Терасполь", nil, nil, []int64{1, 2}},
		{"parent category typo", "творчестов", nil, nil, []int64{2, 1}},
		{"group name", "начинающие", nil, nil, []int64{2, 1}},
		{"description", "красками", nil, nil, []int64{1}},
		{"district typo", "октябрский", &city, nil, []int64{2, 1}},
		{"city filter preserved", "рисование", &otherCity, nil, []int64{}},
		{"age filter preserved", "рисование", nil, &age, []int64{}},
		{"unrelated query", "плавание", nil, nil, []int64{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			query, args, countQuery, countArgs := buildSearchCardsQueries(models.ActivityFilter{Query: &tc.search, CityID: tc.city, Age: tc.age, Page: 1, Limit: 20})
			var count int
			if err := tx.QueryRow(countQuery, countArgs...).Scan(&count); err != nil {
				t.Fatal(err)
			}
			rows, err := tx.Query(query, args...)
			if err != nil {
				t.Fatal(err)
			}
			defer rows.Close()
			cols, err := rows.Columns()
			if err != nil {
				t.Fatal(err)
			}
			ids := []int64{}
			for rows.Next() {
				var id int64
				dst := make([]any, len(cols))
				dst[0] = &id
				for i := 1; i < len(dst); i++ {
					dst[i] = new(any)
				}
				if err := rows.Scan(dst...); err != nil {
					t.Fatal(err)
				}
				ids = append(ids, id)
			}
			if err := rows.Err(); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(ids, tc.want) || count != len(tc.want) {
				t.Fatalf("got ids=%v total=%d; want %v", ids, count, tc.want)
			}
		})
	}
}
