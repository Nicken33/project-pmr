package handlers

import (
	"net/http"
	"net/url"
	"testing"

	"talentro/internal/httpx"
)

func query(t *testing.T, raw string) url.Values {
	t.Helper()
	u, err := url.Parse("http://x/y?" + raw)
	if err != nil {
		t.Fatalf("не разобран URL %q: %v", raw, err)
	}
	return u.Query()
}

func TestParseCardFilterDefaults(t *testing.T) {
	f, err := parseCardFilter(query(t, ""))
	if err != nil {
		t.Fatalf("пустой query не должен давать ошибку, получил %v", err)
	}
	if f.Page != 1 || f.Limit != defaultLimit {
		t.Errorf("пагинация по умолчанию = page 1, limit %d; получили page %d, limit %d",
			defaultLimit, f.Page, f.Limit)
	}
	// Ни один фильтр не должен просочиться: пустой фильтр обязан сужать выдачу
	// ровно на ноль карточек.
	if f.Age != nil || f.PriceMax != nil || f.Free || f.Near != nil || f.Weekday != nil {
		t.Errorf("пустой query заполнил фильтры: %+v", f)
	}
}

func TestParseCardFilterValues(t *testing.T) {
	f, err := parseCardFilter(query(t,
		"city=1&district=%D0%A6%D0%B5%D0%BD%D1%82%D1%80,balka&age=9&price_max=300"+
			"&free=1&kind=activity&day=6&time=18:00&near=46.84,29.64&radius=3000"+
			"&sort=price&page=3&limit=50&q=%D1%88%D0%B0%D1%85%D0%BC%D0%B0%D1%82"))
	if err != nil {
		t.Fatalf("валидный query дал ошибку: %v", err)
	}

	if f.CityID == nil || *f.CityID != 1 {
		t.Errorf("city=1 → CityID 1, получили %+v", f.CityID)
	}
	if len(f.Districts) != 2 || f.Districts[0] != "Центр" || f.Districts[1] != "balka" {
		t.Errorf("district разобран как %q, ожидалось [Центр balka]", f.Districts)
	}
	if f.Age == nil || *f.Age != 9 {
		t.Errorf("age=9 → %v", f.Age)
	}
	if f.PriceMax == nil || *f.PriceMax != 300 {
		t.Errorf("price_max=300 → %v", f.PriceMax)
	}
	if !f.Free {
		t.Error("free=1 не установил признак «бесплатно»")
	}
	if f.Kind != "activity" {
		t.Errorf("kind=activity → %q", f.Kind)
	}
	if f.Weekday == nil || *f.Weekday != 6 {
		t.Errorf("day=6 → %v", f.Weekday)
	}
	if f.TimeAt == nil || *f.TimeAt != "18:00" {
		t.Errorf("time=18:00 → %v", f.TimeAt)
	}
	if f.Near == nil || f.Near.Lat != 46.84 || f.Near.Lng != 29.64 {
		t.Errorf("near=46.84,29.64 → %+v", f.Near)
	}
	if f.RadiusM == nil || *f.RadiusM != 3000 {
		t.Errorf("radius=3000 → %v", f.RadiusM)
	}
	if f.Sort != "price" || f.Page != 3 || f.Limit != 50 {
		t.Errorf("sort/page/limit → %q/%d/%d", f.Sort, f.Page, f.Limit)
	}
	if f.Query != "шахмат" {
		t.Errorf("q → %q, ожидалось «шахмат»", f.Query)
	}
}

// §5.8: пустые значения в URL — мусор, который ломает «назад» и шаринг. Для
// сервера это «фильтра нет», а не пустая строка в SQL.
func TestParseCardFilterTreatsEmptyAsAbsent(t *testing.T) {
	f, err := parseCardFilter(query(t, "city=&district=&age=&q=&sort=&near=&time="))
	if err != nil {
		t.Fatalf("пустые значения не должны считаться ошибкой: %v", err)
	}
	if f.CityID != nil || f.CitySlug != "" || len(f.Districts) != 0 || f.Age != nil ||
		f.Query != "" || f.Sort != "" || f.Near != nil || f.TimeAt != nil {
		t.Errorf("пустые параметры попали в фильтр: %+v", f)
	}
}

func TestParseCardFilterCitySlugVsID(t *testing.T) {
	f, err := parseCardFilter(query(t, "city=tiraspol"))
	if err != nil {
		t.Fatalf("unexpected: %v", err)
	}
	if f.CityID != nil || f.CitySlug != "tiraspol" {
		t.Errorf("не-числовой city обязан уйти в slug: %+v", f)
	}

	// direction — прежнее имя параметра направления, обязан значить то же, что category.
	f, err = parseCardFilter(query(t, "direction=10"))
	if err != nil {
		t.Fatalf("unexpected: %v", err)
	}
	if f.CategoryID == nil || *f.CategoryID != 10 {
		t.Errorf("direction=10 → CategoryID 10, получили %+v", f.CategoryID)
	}
}

func TestParseCardFilterErrors(t *testing.T) {
	tcs := []struct {
		name  string
		query string
		field string
	}{
		{"район без города", "district=%D0%A6%D0%B5%D0%BD%D1%82%D1%80", "district"},
		{"возраст не число", "age=abc", "age"},
		{"возраст ноль", "age=0", "age"},
		{"возраст за пределами", "age=121", "age"},
		{"отрицательная цена", "price_max=-5", "price_max"},
		{"limit выше максимума", "limit=101", "limit"},
		{"limit ноль", "limit=0", "limit"},
		{"page ноль", "page=0", "page"},
		{"неизвестный день", "day=8", "day"},
		{"день не число", "day=пн", "day"},
		{"время без минут", "time=18", "time"},
		{"время 25 часов", "time=25:00", "time"},
		{"near без долготы", "near=46.84", "near"},
		{"near вне Приднестровья", "near=99,99", "near"},
		{"radius без near", "radius=5000", "radius"},
		{"radius слишком мал", "near=46.84,29.64&radius=50", "radius"},
		{"неизвестный kind", "kind=course", "kind"},
		{"неизвестный sort", "sort=rating", "sort"},
		{"free не bool", "free=maybe", "free"},
		{"online не bool", "online=maybe", "online"},
		// Байты вне UTF-8 Postgres отвергает сам, и без проверки это 500. Escapes
		// полные, поэтому url.Query() отдаёт их как есть — валидность ловит парсер.
		{"не UTF-8 в q", "q=%F1%EE%EB", "q"},
		{"не UTF-8 в city_name", "city_name=%F1%EE%EB", "city_name"},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			_, err := parseCardFilter(query(t, tc.query))
			if err == nil {
				t.Fatalf("ожидалась 400 на %q, получили nil", tc.query)
			}
			if got := httpx.Status(err); got != http.StatusBadRequest {
				t.Fatalf("статус = %d, want %d", got, http.StatusBadRequest)
			}
			fields := httpx.Fields(err)
			if _, ok := fields[tc.field]; !ok {
				t.Errorf("в fields нет ключа %q: %+v", tc.field, fields)
			}
		})
	}
}

// Комбинация «near+radius» обязана проходить: поодиножке эти параметры в тестах
// выше отклоняются, и легко перепутать порядок проверок.
func TestParseCardFilterNearWithRadiusIsValid(t *testing.T) {
	f, err := parseCardFilter(query(t, "near=46.84,29.64&radius=5000"))
	if err != nil {
		t.Fatalf("near+radius валидны вместе: %v", err)
	}
	if f.Near == nil || f.RadiusM == nil || *f.RadiusM != 5000 {
		t.Errorf("near/radius не долетели до фильтра: %+v", f)
	}
}

func TestIsHHMM(t *testing.T) {
	for _, s := range []string{"00:00", "07:30", "23:59"} {
		if !isHHMM(s) {
			t.Errorf("%q должен быть валидным временем", s)
		}
	}
	for _, s := range []string{"", "7:30", "07:3", "24:00", "07:60", "1800", "18:00:00"} {
		if isHHMM(s) {
			t.Errorf("%q не должен проходить как ЧЧ:ММ", s)
		}
	}
}
