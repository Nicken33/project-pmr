package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"talentro/internal/models"
)

// SearchCards отдаёт страницу каталога и общее число подходящих карточек.
//
// Одна карточка — ровно одна строка ответа (§5.9): фильтры не размножают
// карточки, они выбирают группу и точку, которые покажутся внутри неё.
// Город и район считаются по точкам, возраст, цена и расписание — по группам.
func (r *Repository) SearchCards(f models.CardFilter) ([]models.Card, int, error) {
	where, args := cardWhere(f)

	const cardColumns = `
				c.id AS card_id,
				c.slug AS card_slug,
				c.name AS card_name,
				c.kind AS card_kind,
				c.description AS card_description,
				c.status AS card_status,
				c.format AS card_format,
				c.lesson_type AS card_lesson_type,
				c.updated_at AS card_updated_at,
				COALESCE(c.contacts_verified_at >= current_date - 90, false) AS card_verified,
				o.id AS org_id,
				o.slug AS org_slug,
				o.name AS org_name,
				o.type AS org_type,
				o.phone AS org_phone,
				o.site AS org_site,
				cat.id AS category_id,
				cat.name AS category_name,
				cat.slug AS category_slug,
				p.name AS super_name,
				p.slug AS super_slug,
				g.id AS group_id,
				g.name AS group_name,
				g.age_from AS age_from,
				g.age_to AS age_to,
				g.price_from AS price_from,
				g.price_to AS price_to,
				g.price_period AS price_period,
				g.seats AS group_seats,
				l.id AS location_id,
				l.name AS location_name,
				l.address AS location_address,
				l.lat AS location_lat,
				l.lng AS location_lng,
				ci.name AS city_name,
				d.name AS district_name,
				(SELECT count(*) FROM groups gc WHERE gc.card_id = c.id) AS groups_count,
				(SELECT count(DISTINCT gl.location_id) FROM groups gl WHERE gl.card_id = c.id) AS locations_count,
				(SELECT m.path FROM media m
					WHERE m.entity = 'card' AND m.entity_id = c.id AND m.kind = 'photo'
					ORDER BY m.order_num, m.id LIMIT 1) AS photo_path`

	from := `
			FROM cards c
			JOIN organizations o ON o.id = c.org_id
			JOIN categories cat ON cat.id = c.category_id
			LEFT JOIN categories p ON p.id = cat.parent_id
			JOIN groups g ON g.card_id = c.id
			JOIN locations l ON l.id = g.location_id
			JOIN cities ci ON ci.id = l.city_id
			LEFT JOIN districts d ON d.id = l.district_id`

	listQuery := fmt.Sprintf(`
		SELECT *
		FROM (
			SELECT DISTINCT ON (c.id)%s
			%s%s
			ORDER BY c.id, %s
		) t
		ORDER BY %s, t.card_id
		LIMIT $%d OFFSET $%d`,
		cardColumns, from, where, groupPreference(f),
		cardOrder(f), len(args)+1, len(args)+2)

	listArgs := append(append([]any{}, args...), f.Limit, (f.Page-1)*f.Limit)

	rows, err := r.db.Query(listQuery, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("запрос каталога: %w", err)
	}
	defer rows.Close()

	cards := make([]models.Card, 0, f.Limit)
	for rows.Next() {
		card, err := scanCard(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("чтение строки каталога: %w", err)
		}
		cards = append(cards, card)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("обход строк каталога: %w", err)
	}

	// total — по той же where-секции; DISTINCT, потому что join по группам и
	// точкам умножает строки карточки.
	countQuery := fmt.Sprintf(`
		SELECT count(DISTINCT c.id)
		FROM cards c
		JOIN organizations o ON o.id = c.org_id
		JOIN categories cat ON cat.id = c.category_id
		LEFT JOIN categories p ON p.id = cat.parent_id
		JOIN groups g ON g.card_id = c.id
		JOIN locations l ON l.id = g.location_id
		JOIN cities ci ON ci.id = l.city_id
		LEFT JOIN districts d ON d.id = l.district_id%s`, where)

	var total int
	if err := r.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("подсчёт карточек: %w", err)
	}

	return cards, total, nil
}

// cardWhere собирает условия §5. Пустые поля фильтра условием не становятся.
func cardWhere(f models.CardFilter) (string, []any) {
	conds := []string{
		"c.status = 'published'",
		"c.is_active",
		"o.is_active",
		"l.is_active",
	}
	args := []any{}

	next := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	// §5.4: район только вместе с городом — одноимённый район другого города
	// угадывать не будем, вызывающий обязан передать и city, и district.
	if len(f.Districts) > 0 {
		var byName, bySlug []string
		for _, d := range f.Districts {
			p := next(d)
			byName = append(byName, p)
			bySlug = append(bySlug, p)
		}
		// Один и тот же параметр подставляется в оба списка, имена и slug
		// различаются только у клиента на кириллице.
		conds = append(conds, fmt.Sprintf(
			"(d.name IN (%s) OR d.slug IN (%s))",
			strings.Join(byName, ", "), strings.Join(bySlug, ", ")))
	}

	if f.CityID != nil {
		conds = append(conds, "l.city_id = "+next(*f.CityID))
	}
	if f.CitySlug != "" {
		conds = append(conds, "ci.slug = "+next(f.CitySlug))
	}
	if f.CityName != "" {
		conds = append(conds, "ci.name = "+next(f.CityName))
	}
	if f.CategoryID != nil {
		p := next(*f.CategoryID)
		conds = append(conds, fmt.Sprintf("(cat.id = %s OR cat.parent_id = %s)", p, p))
	}
	if f.Category != "" {
		p := next(f.Category)
		conds = append(conds, fmt.Sprintf("(cat.slug = %s OR p.slug = %s)", p, p))
	}
	if f.Kind != "" {
		conds = append(conds, "c.kind = "+next(f.Kind))
	}
	// Фильтр по организации внутренним: наружу он не отдаётся (§5 его не
	// предусматривает), но страница организации собирается именно им.
	if f.OrganizationID != nil {
		conds = append(conds, "c.org_id = "+next(*f.OrganizationID))
	}
	if f.Online != nil {
		if *f.Online {
			conds = append(conds, "c.format IN ('online', 'both')")
		} else {
			conds = append(conds, "c.format = 'offline'")
		}
	}
	if f.Verified {
		conds = append(conds, "c.contacts_verified_at >= current_date - 90")
	}
	if f.Age != nil {
		// §5.2: возраст — одно число N, пустые границы группы означают
		// «ограничение снято».
		p := next(*f.Age)
		conds = append(conds, fmt.Sprintf(
			"(g.age_from IS NULL OR g.age_from <= %s) AND (g.age_to IS NULL OR g.age_to >= %s)", p, p))
		// Там же: «у услуги возраст пустой, и в фильтре она участвует только при
		// «без возраста»». Без этого условия услуга попадала в выдачу по любому
		// возрасту, потому что NULL-границы трактуются как «снято».
		conds = append(conds, "c.kind = 'activity'")
	}
	if f.PriceMax != nil {
		// §5.3: диапазон группы попадает в фильтр по нижней границе.
		conds = append(conds, "g.price_from <= "+next(*f.PriceMax))
	}
	if f.Free {
		// §7.4: «бесплатно» — это цена от = 0, а не пустое поле.
		conds = append(conds, "g.price_from = 0")
	}
	if f.Weekday != nil || f.TimeAt != nil {
		sub := []string{"s.group_id = g.id"}
		if f.Weekday != nil {
			sub = append(sub, "s.weekday = "+next(*f.Weekday))
		}
		if f.TimeAt != nil {
			// §5.6: «вечер» = начало 17:00–20:00; берём строку расписания,
			// которая идёт в указанный момент.
			p := next(*f.TimeAt) + "::time"
			sub = append(sub, fmt.Sprintf("%s BETWEEN s.time_from AND s.time_to", p))
		}
		conds = append(conds, "EXISTS (SELECT 1 FROM schedules s WHERE "+strings.Join(sub, " AND ")+")")
	}
	if f.Near != nil {
		if f.RadiusM != nil {
			// Координаты и радиус — уже проверенные числа, подставляются литералом,
			// чтобы ORDER BY не тянул параметры за пределы WHERE.
			conds = append(conds, fmt.Sprintf("%s <= %d", distanceExpr(f.Near), *f.RadiusM))
		} else {
			conds = append(conds, "l.lat IS NOT NULL AND l.lng IS NOT NULL")
		}
	}
	if trimmed := strings.TrimSpace(f.Query); trimmed != "" {
		// §5.1: название, организация, описание и направление; поиск БЕЗ опечаток,
		// поэтому просто подстрока, а регистр и ё снимает SQL-функция fold() — на
		// обеих сторонах сравнения, чтобы оно не разошлось с trigram-индексом.
		// Сам LIKE '%…%' ускоряется индексами gin (fold(name) gin_trgm_ops).
		like := "%" + escapeLike(trimmed) + "%"
		pName := next(like)
		pOrg := next(like)
		pDesc := next(like)
		pCat := next(like)
		conds = append(conds, fmt.Sprintf(
			"(fold(c.name) LIKE fold(%s) ESCAPE '\\'"+
				" OR fold(o.name) LIKE fold(%s) ESCAPE '\\'"+
				" OR fold(c.description) LIKE fold(%s) ESCAPE '\\'"+
				" OR fold(cat.name) LIKE fold(%s) ESCAPE '\\')",
			pName, pOrg, pDesc, pCat))
	}

	return " WHERE " + strings.Join(conds, " AND "), args
}

func distanceExpr(p *models.GeoPoint) string {
	return fmt.Sprintf(
		"(6371000 * acos(LEAST(1.0, GREATEST(-1.0, "+
			"cos(radians(%f)) * cos(radians(l.lat)) * cos(radians(l.lng) - radians(%f))"+
			" + sin(radians(%f)) * sin(radians(l.lat))))))",
		p.Lat, p.Lng, p.Lat)
}

// escapeLike экранирует % и _ пользовательского ввода: запрос «20_21» не должен
// превращаться в LIKE-маску.
func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, "%", `\%`)
	s = strings.ReplaceAll(s, "_", `\_`)
	return s
}

// groupPreference выбирает, какая из подходящих группа и точка поедут внутри
// карточки: ближайшая точка — если запрошен near, иначе самая дешёвая.
func groupPreference(f models.CardFilter) string {
	if f.Near != nil {
		return distanceExpr(f.Near) + " NULLS LAST, g.price_from NULLS LAST, g.id"
	}
	return "g.price_from NULLS LAST, g.id"
}

// cardOrder — сортировка страницы по §9.2 (sort). rating появится вместе с
// таблицей голосов; пока что это порядок по свежести.
func cardOrder(f models.CardFilter) string {
	switch f.Sort {
	case "price":
		return "t.price_from NULLS LAST"
	case "updated":
		return "t.card_updated_at DESC"
	case "name":
		return "t.card_name"
	case "verified":
		return "t.card_verified DESC, t.card_updated_at DESC"
	default:
		return "t.card_id DESC"
	}
}

func scanCard(rows *sql.Rows) (models.Card, error) {
	var (
		c         models.Card
		id        int64
		desc      sql.NullString
		site      sql.NullString
		phone     sql.NullString
		superName sql.NullString
		superSlug sql.NullString
		groupName sql.NullString
		ageFrom   sql.NullInt64
		ageTo     sql.NullInt64
		priceFrom sql.NullInt64
		priceTo   sql.NullInt64
		period    sql.NullString
		seats     sql.NullInt64
		lesson    sql.NullString
		locName   sql.NullString
		address   sql.NullString
		lat       sql.NullFloat64
		lng       sql.NullFloat64
		district  sql.NullString
		photo     sql.NullString
	)

	err := rows.Scan(
		&id, &c.Slug, &c.Name, &c.Kind, &desc, &c.Status, &c.Format, &lesson,
		&c.UpdatedAt, &c.Verified,
		&c.OrganizationID, &c.OrganizationSlug, &c.OrganizationName, &c.OrganizationType,
		&phone, &site,
		&c.CategoryID, &c.Category, &c.CategorySlug, &superName, &superSlug,
		&c.GroupID, &groupName, &ageFrom, &ageTo, &priceFrom, &priceTo, &period, &seats,
		&c.LocationID, &locName, &address, &lat, &lng,
		&c.City, &district,
		&c.GroupsCount, &c.LocationsCount, &photo,
	)
	if err != nil {
		return c, err
	}

	c.ID = fmt.Sprintf("%d", id)
	c.Description = nullText(desc)
	c.Link = nullText(site)
	c.LessonType = nullText(lesson)
	c.GroupName = nullText(groupName)
	c.LocationName = nullText(locName)
	c.Address = nullText(address)
	c.District = nullText(district)
	c.Photo = nullText(photo)
	c.SuperCategory = nullText(superName)
	c.SuperCategorySlug = nullText(superSlug)
	c.PricePeriod = nullText(period)
	c.Phone = phone.String

	if ageFrom.Valid {
		v := int(ageFrom.Int64)
		c.Age.MinAge = &v
	}
	if ageTo.Valid {
		v := int(ageTo.Int64)
		c.Age.MaxAge = &v
	}
	if priceFrom.Valid {
		v := int(priceFrom.Int64)
		c.Price = &v
	}
	if priceTo.Valid {
		v := int(priceTo.Int64)
		c.PriceTo = &v
	}
	if seats.Valid {
		v := int(seats.Int64)
		c.Seats = &v
	}
	if lat.Valid {
		c.Lat = &lat.Float64
	}
	if lng.Valid {
		c.Lng = &lng.Float64
	}

	return c, nil
}
