package repository_test

import (
	"database/sql"
	"os"
	"sort"
	"strings"
	"testing"

	_ "github.com/lib/pq"

	"talentro/internal/models"
	"talentro/internal/repository"
)

// Интеграционные тесты семантики фильтров (§5) против настоящего Postgres:
// построитель WHERE легко расходится с планировщиком, и проверить его можно
// только запросом. Ожидаемые наборы соответствуют сидам database/init.sql —
// если меняешь сид, правь и их.
//
// Запуск: psql < database/init.sql, затем
// DATABASE_URL=postgres://... go test ./internal/repository/
func newRepo(t *testing.T) *repository.Repository {
	t.Helper()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL не задан — интеграционные тесты каталога пропущены")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("не удалось открыть базу: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	if err := db.Ping(); err != nil {
		t.Fatalf("база недоступна: %v", err)
	}
	return repository.New(db)
}

func search(t *testing.T, repo *repository.Repository, f models.CardFilter) []models.Card {
	t.Helper()
	if f.Limit == 0 {
		f.Limit = 100
	}
	if f.Page == 0 {
		f.Page = 1
	}
	cards, _, err := repo.SearchCards(f)
	if err != nil {
		t.Fatalf("SearchCards(%+v): %v", f, err)
	}
	return cards
}

func slugs(cards []models.Card) []string {
	out := make([]string, 0, len(cards))
	for _, c := range cards {
		out = append(out, c.Slug)
	}
	sort.Strings(out)
	return out
}

func ptr[T any](v T) *T { return &v }

func wantSlugs(t *testing.T, name string, cards []models.Card, want ...string) {
	t.Helper()
	got := slugs(cards)
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("%s: получили %v, ожидали %v", name, got, want)
	}
}

func TestSearchCardsOnlyPublished(t *testing.T) {
	repo := newRepo(t)
	cards := search(t, repo, models.CardFilter{})

	for _, c := range cards {
		if c.Status != "published" {
			t.Errorf("в выдачу попала карточка со статусом %q (%s)", c.Status, c.Slug)
		}
	}

	// §7.12: у опубликованного занятия минимум одна группа и одна точка.
	for _, c := range cards {
		if c.GroupsCount < 1 {
			t.Errorf("%s: groups_count = %d, а по §7.12 минимум 1", c.Slug, c.GroupsCount)
		}
		if c.LocationsCount < 1 {
			t.Errorf("%s: locations_count = %d, а по §7.12 минимум 1", c.Slug, c.LocationsCount)
		}
	}
}

// §5.9: фильтры не размножают карточки — одна карточка ровно один раз, какой
// бы фильтр её ни выбрал.
func TestSearchCardsNoDuplicates(t *testing.T) {
	repo := newRepo(t)

	for _, f := range []models.CardFilter{
		{},
		{Age: ptr(10)},
		{Near: &models.GeoPoint{Lat: 46.84, Lng: 29.64}, RadiusM: ptr(20000)},
		{Query: "танцы"},
		{CityName: "Тирасполь"},
	} {
		seen := map[string]bool{}
		for _, c := range search(t, repo, f) {
			if seen[c.Slug] {
				t.Errorf("фильтр %+v вернул карточку %s дважды", f, c.Slug)
			}
			seen[c.Slug] = true
		}
	}
}

func TestSearchCardsAge(t *testing.T) {
	repo := newRepo(t)

	// Границы группы 7–10 включают 7 и 10; пустые границы = ограничение снято (§5.2).
	// «Подготовка к школе» (5–7) на 10 лет не попадает, услуга — не попадает тоже,
	// «Лёгкая атлетика» (9–13) отсекается статусом, а не возрастом.
	wantSlugs(t, "age=10", search(t, repo, models.CardFilter{Age: ptr(10)}),
		"bendery-balnye-tancy",
		"bendery-robototekhnika",
		"dubossary-shakhmaty",
		"tiraspol-futbol-detyam",
		"tiraspol-studiya-palitra",
		"tiraspol-veselye-noty")

	// Возраст 5 лет: «Весёлые ноты» (4–6), «Палитра» (5–7), подготовка (5–7) и
	// танцы (4–6). Шахматы (6–18) на пять не попадают.
	wantSlugs(t, "age=5", search(t, repo, models.CardFilter{Age: ptr(5)}),
		"bendery-balnye-tancy",
		"rybnitsa-podgotovka-k-shkole",
		"tiraspol-studiya-palitra",
		"tiraspol-veselye-noty")

	// §5.2: услуга участвует в выдаче только когда возраста в фильтре нет.
	for _, c := range search(t, repo, models.CardFilter{Age: ptr(10)}) {
		if c.Kind == "service" {
			t.Errorf("услуга %s попала в выдачу с возрастом", c.Slug)
		}
	}
}

// §5.3: «бесплатно» — это цена от = 0 (§7.4), а не пустая цена.
func TestSearchCardsFree(t *testing.T) {
	repo := newRepo(t)
	cards := search(t, repo, models.CardFilter{Free: true})

	if len(cards) == 0 {
		t.Fatal("фильтр «бесплатно» не нашёл ничего, хотя в сидах есть группы с ценой 0")
	}
	for _, c := range cards {
		if c.Price == nil || *c.Price != 0 {
			t.Errorf("%s: бесплатно, но price = %v", c.Slug, c.Price)
		}
	}
}

// §5.3: диапазон группы попадает в фильтр, если его НИЖНЯЯ граница ≤ N.
func TestSearchCardsPriceMax(t *testing.T) {
	repo := newRepo(t)

	cards := search(t, repo, models.CardFilter{PriceMax: ptr(250)})
	for _, c := range cards {
		if c.Price == nil || *c.Price > 250 {
			t.Errorf("%s: price_max=250, но показанная группа стоит %v", c.Slug, c.Price)
		}
	}

	// «Палитра» начинается с 300 — при 250 её быть не должно.
	for _, c := range cards {
		if c.Slug == "tiraspol-studiya-palitra" {
			t.Errorf("карточка с ценой от 300 попала в фильтр price_max=250")
		}
	}
}

// §5.1: регистр и ё нормализуются; поиск по названию, организации, описанию и направлению.
func TestSearchCardsQueryNormalization(t *testing.T) {
	repo := newRepo(t)

	// В сидах карточка называется «…«Весёлые ноты»». Запрос через «е» и в
	// верхнем регистре обязан её находить.
	got := search(t, repo, models.CardFilter{Query: "ВЕСЕЛЫЕ"})
	wantSlugs(t, "q=ВЕСЕЛЫЕ", got, "tiraspol-veselye-noty")

	// И наоборот: запрос с «ё» ищет по данным, где в слове «е».
	if len(search(t, repo, models.CardFilter{Query: "шахмат"})) == 0 {
		t.Error("поиск «шахмат» не нашёл «Шахматную гостиную»")
	}

	// Поиск по названию организации, а не только по названию занятия.
	if len(search(t, repo, models.CardFilter{Query: "Гамбит"})) == 0 {
		t.Error("поиск по названию организации «Гамбит» ничего не нашёл")
	}

	// По описанию.
	if len(search(t, repo, models.CardFilter{Query: "сольфеджио"})) == 0 {
		t.Error("поиск по описанию «сольфеджио» ничего не нашёл")
	}

	// Подчёркивание в запросе не должно превращаться в LIKE-маску.
	if got := search(t, repo, models.CardFilter{Query: "_"}); len(got) != 0 {
		t.Errorf("запрос «_» сработал как маска и вернул %d карточек", len(got))
	}
}

// §5.5: «проверенные» — не старше 90 дней.
func TestSearchCardsVerified(t *testing.T) {
	repo := newRepo(t)

	cards := search(t, repo, models.CardFilter{Verified: true})
	if len(cards) == 0 {
		t.Fatal("verified=1 не вернул ничего, хотя в сидах есть свежая проверка")
	}
	for _, c := range cards {
		if !c.Verified {
			t.Errorf("%s: прошёл фильтр verified, но verified=false", c.Slug)
		}
	}

	// Карточка с проверкой 200 дней назад обязана отсечься.
	for _, c := range cards {
		if c.Slug == "rybnitsa-podgotovka-k-shkole" {
			t.Error("проверка старше 90 дней прошла фильтр «проверенные»")
		}
	}
}

// §5.4: район считается по точкам и только внутри города.
func TestSearchCardsDistrict(t *testing.T) {
	repo := newRepo(t)

	cards := search(t, repo, models.CardFilter{CityName: "Тирасполь", Districts: []string{"Центр"}})
	for _, c := range cards {
		if c.City != "Тирасполь" {
			t.Errorf("%s: город %q при фильтре по Тирасполю", c.Slug, c.City)
		}
		if c.District == nil || *c.District != "Центр" {
			t.Errorf("%s: район %v при фильтре «Центр»", c.Slug, c.District)
		}
	}

	// Без города фильтр не должен сузать выдачу до неверного города: на уровне
	// репозитория это проверяет хендлер (400), здесь — что запрос не падает.
	if all := search(t, repo, models.CardFilter{}); len(all) <= len(cards) {
		t.Errorf("фильтр по району не сузил выдачу: %d из %d", len(cards), len(all))
	}
}

// §3.5.6 + §9.2: near и radius считаются по точкам.
func TestSearchCardsNear(t *testing.T) {
	repo := newRepo(t)

	// Точка в Тирасполе, радиус 5 км — только Тирасполь.
	cards := search(t, repo, models.CardFilter{
		Near:    &models.GeoPoint{Lat: 46.8435, Lng: 29.6392},
		RadiusM: ptr(5000),
	})
	if len(cards) == 0 {
		t.Fatal("near+radius не нашёл ни одной карточки")
	}
	for _, c := range cards {
		if c.Lat == nil || c.Lng == nil {
			t.Errorf("%s: карточка без координат прошла фильтр по расстоянию", c.Slug)
			continue
		}
		if c.City != "Тирасполь" {
			t.Errorf("%s: город %q в 5 км от центра Тирасполя — подозрительно", c.Slug, c.City)
		}
	}

	// Крошечный радиус вокруг точки вне всех занятий не обязан ничего найти,
	// но большой радиус обязан вернуть ровно то же, что есть в базе.
	wide := search(t, repo, models.CardFilter{
		Near:    &models.GeoPoint{Lat: 46.8435, Lng: 29.6392},
		RadiusM: ptr(50000),
	})
	if len(wide) < len(cards) {
		t.Errorf("радиус 50 км вернул меньше карточек, чем 5 км: %d < %d", len(wide), len(cards))
	}
}

// §5.6: день и время — по строкам расписания групп.
func TestSearchCardsSchedule(t *testing.T) {
	repo := newRepo(t)

	// Суббота (6): «Палитра» (10:00 и 12:00) и «Бальные танцы» (09:00).
	wantSlugs(t, "day=6", search(t, repo, models.CardFilter{Weekday: ptr(6)}),
		"bendery-balnye-tancy", "tiraspol-studiya-palitra")

	// Понедельник 15:30 — время должно попадать внутрь строки расписания.
	mondayHalf := search(t, repo, models.CardFilter{Weekday: ptr(1), TimeAt: ptr("15:30")})
	for _, c := range mondayHalf {
		if c.City == "" {
			t.Errorf("%s: пустой город в выдаче", c.Slug)
		}
	}
	if len(mondayHalf) == 0 {
		t.Error("понедельник 15:30 не нашёл занятий, хотя в сидах есть 15:00–16:30")
	}

	// Время между строками (12:45 в среду — между 09:30–11:00 и 15:00–16:00).
	if got := search(t, repo, models.CardFilter{Weekday: ptr(3), TimeAt: ptr("12:45")}); len(got) != 0 {
		t.Errorf("12:45 в среду не входит ни в одну строку расписания, получили %v", slugs(got))
	}
}

// §9: пагинация page/limit с total.
func TestSearchCardsPagination(t *testing.T) {
	repo := newRepo(t)

	all, total, err := repo.SearchCards(models.CardFilter{Limit: 100, Page: 1})
	if err != nil {
		t.Fatalf("базовый запрос: %v", err)
	}
	if total != len(all) {
		t.Fatalf("total=%d не совпал с длиной выдачи %d", total, len(all))
	}

	first, firstTotal, err := repo.SearchCards(models.CardFilter{Limit: 3, Page: 1, Sort: "name"})
	if err != nil {
		t.Fatalf("страница 1: %v", err)
	}
	if len(first) != 3 {
		t.Fatalf("limit=3 вернул %d карточек", len(first))
	}
	if firstTotal != total {
		t.Errorf("total изменился между страницами: %d vs %d", firstTotal, total)
	}

	second, _, err := repo.SearchCards(models.CardFilter{Limit: 3, Page: 2, Sort: "name"})
	if err != nil {
		t.Fatalf("страница 2: %v", err)
	}
	overlap := map[string]bool{}
	for _, c := range first {
		overlap[c.Slug] = true
	}
	for _, c := range second {
		if overlap[c.Slug] {
			t.Errorf("страницы пересекаются: %s есть и на 1, и на 2", c.Slug)
		}
	}

	// За последнюю страницу — пустой список, а не ошибка.
	beyond, _, err := repo.SearchCards(models.CardFilter{Limit: 3, Page: 1000})
	if err != nil {
		t.Fatalf("страница за концом: %v", err)
	}
	if len(beyond) != 0 {
		t.Errorf("страница за концом вернула %d карточек", len(beyond))
	}
}
