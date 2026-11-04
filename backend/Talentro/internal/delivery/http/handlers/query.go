package handlers

import (
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"talentro/internal/httpx"
	"talentro/internal/models"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

var (
	allowedSort = map[string]bool{"updated": true, "price": true, "name": true, "verified": true}
	allowedKind = map[string]bool{"activity": true, "service": true}
)

// parseCardFilter разбирает параметры каталога по §9.2 и проверяет их по §5.
// Пустое значение (§5.8) означает «фильтра нет», а не пустую строку в SQL:
// иначе ?city= ломает кнопку «назад» и пересланный ссылка.
func parseCardFilter(q url.Values) (models.CardFilter, error) {
	f := models.CardFilter{Page: 1, Limit: defaultLimit}
	fields := map[string]string{}

	get := func(name string) string { return strings.TrimSpace(q.Get(name)) }

	// Postgres отказывается принимать биты, которые не являются валидным UTF-8, и
	// отвечает ошибкой. Без этой проверки кривой %D0 в URL превращался бы в 500
	// вместо честного 400 с именем поля (§9.3).
	for name, values := range q {
		for _, v := range values {
			if !utf8.ValidString(v) {
				fields[name] = "значение должно быть корректной строкой в UTF-8"
			}
		}
	}

	// intOrSlug нужен потому, что справочники (§7.2) живут с id и slug, а клиент
	// исторически присылал то и другое.
	intOrSlug := func(v string) (*int64, string) {
		if id, err := strconv.ParseInt(v, 10, 64); err == nil {
			return &id, ""
		}
		return nil, v
	}

	f.Query = get("q")

	if v := get("city"); v != "" {
		f.CityID, f.CitySlug = intOrSlug(v)
	}
	f.CityName = get("city_name")

	if v := get("district"); v != "" {
		for _, d := range strings.Split(v, ",") {
			if d = strings.TrimSpace(d); d != "" {
				f.Districts = append(f.Districts, d)
			}
		}
		// §5.4: район без города не имеет смысла — одноимённый район встречается
		// в нескольких городах, и угадывать мы не вправе.
		if len(f.Districts) > 0 && f.CityID == nil && f.CitySlug == "" && f.CityName == "" {
			fields["district"] = "район передаётся только вместе с городом"
		}
	}

	if v := get("category"); v != "" {
		f.CategoryID, f.Category = intOrSlug(v)
	}
	// direction — прежнее имя параметра направления у фронтенда, тот же смысл.
	if v := get("direction"); v != "" {
		f.CategoryID, f.Category = intOrSlug(v)
	}

	if v := get("age"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 120 {
			fields["age"] = "age — целое число от 1 до 120, возраст ребёнка"
		} else {
			f.Age = &n
		}
	}

	if v := get("price_max"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			fields["price_max"] = "price_max — целое число рублей ПМР, не меньше 0"
		} else {
			f.PriceMax = &n
		}
	}

	if s := get("free"); s != "" {
		if v, ok := parseBool(s); ok {
			f.Free = v
		} else {
			fields["free"] = "free — 1/0 или true/false"
		}
	}

	if s := get("online"); s != "" {
		v, ok := parseBool(s)
		if !ok {
			fields["online"] = "online — 1/0 или true/false"
		} else {
			f.Online = &v
		}
	}

	if s := get("verified"); s != "" {
		v, ok := parseBool(s)
		if !ok {
			fields["verified"] = "verified — 1/0 или true/false"
		} else {
			f.Verified = v
		}
	}

	if v := get("kind"); v != "" {
		if !allowedKind[v] {
			fields["kind"] = "kind — activity или service"
		} else {
			f.Kind = v
		}
	}

	if v := get("day"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 7 {
			fields["day"] = "day — от 1 (понедельник) до 7 (воскресенье)"
		} else {
			f.Weekday = &n
		}
	}

	if v := get("time"); v != "" {
		if !isHHMM(v) {
			fields["time"] = "time — ЧЧ:ММ локального времени, например 18:00"
		} else {
			f.TimeAt = &v
		}
	}

	if v := get("near"); v != "" {
		point, ok := parseGeo(v)
		if !ok {
			fields["near"] = "near — «широта,долгота» в границах Приднестровья, например 46.84,29.64"
		} else {
			f.Near = point
		}
	}

	if v := get("radius"); v != "" {
		n, err := strconv.Atoi(v)
		switch {
		case err != nil || n < 100 || n > 50000:
			fields["radius"] = "radius — от 100 до 50000 метров"
		case f.Near == nil:
			fields["radius"] = "radius работает только вместе с near"
		default:
			f.RadiusM = &n
		}
	}

	if v := get("sort"); v != "" {
		if !allowedSort[v] {
			// rating появится вместе с таблицей голосов (§8, таблица 10); до её
			// появления сортировка «по рейтингу» значила бы «по свежести».
			fields["sort"] = "sort — updated, price, name или verified; rating ещё не считается"
		} else {
			f.Sort = v
		}
	}

	if v := get("page"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			fields["page"] = "page — целое число от 1"
		} else {
			f.Page = n
		}
	}

	if v := get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > maxLimit {
			fields["limit"] = "limit — от 1 до 100"
		} else {
			f.Limit = n
		}
	}

	if len(fields) > 0 {
		return f, httpx.NewBadRequest(fields)
	}
	return f, nil
}

func parseBool(s string) (bool, bool) {
	switch strings.ToLower(s) {
	case "1", "true", "yes":
		return true, true
	case "0", "false", "no":
		return false, true
	}
	return false, false
}

func isHHMM(s string) bool {
	if len(s) != 5 || s[2] != ':' {
		return false
	}
	h, errHour := strconv.Atoi(s[0:2])
	m, errMin := strconv.Atoi(s[3:5])
	return errHour == nil && errMin == nil && h <= 23 && m <= 59
}

// parseGeo разбирает «широта,долгота» в тех же границах, что CHECK на locations:
// за их пределами координата означала бы не Приднестровье.
func parseGeo(s string) (*models.GeoPoint, bool) {
	parts := strings.Split(s, ",")
	if len(parts) != 2 {
		return nil, false
	}
	lat, err := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
	if err != nil {
		return nil, false
	}
	lng, err := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
	if err != nil {
		return nil, false
	}
	if lat < 45.9 || lat > 48.9 || lng < 27.4 || lng > 30.6 {
		return nil, false
	}
	return &models.GeoPoint{Lat: lat, Lng: lng}, true
}
