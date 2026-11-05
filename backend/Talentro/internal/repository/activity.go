package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"talentro/internal/models"
)

// ErrNotFound — карточка не найдена или снята с публикации (§9 → 404).
var ErrNotFound = errors.New("запись не найдена")

const dateLayout = "2006-01-02"

// ActivityBySlug собирает карточку целиком по §9.3. Ключ — slug, но числовое id
// тоже принимается: старые клиенты (и `/api/cards`) ссылались на карточку по id.
func (r *Repository) ActivityBySlug(slugOrID string) (*models.Activity, error) {
	var (
		activity  models.Activity
		id        int64
		updatedAt time.Time
		verified  bool

		descr          sql.NullString
		site           sql.NullString
		phone          sql.NullString
		lesson         sql.NullString
		superName      sql.NullString
		superSlug      sql.NullString
		orgDescr       sql.NullString
		orgEmail       sql.NullString
		orgAddress     sql.NullString
		orgCity        sql.NullString
		orgVerified    sql.NullTime
		cardVerifiedAt sql.NullTime
		catID          sql.NullInt64
		catName        sql.NullString
		catSlug        sql.NullString
		photo          sql.NullString
	)

	cardQuery := `
		SELECT c.id, c.slug, c.name, c.kind, c.description, c.status, c.format,
			c.lesson_type, c.updated_at,
			COALESCE(c.contacts_verified_at >= current_date - 90, false),
			c.contacts_verified_at,
			o.id, o.slug, o.name, o.type, o.phone, o.site, o.description, o.email,
			o.address, oc.name, o.contacts_verified_at,
			cat.id, cat.name, cat.slug, p.name, p.slug,
			(SELECT count(*) FROM groups gc WHERE gc.card_id = c.id),
			(SELECT count(DISTINCT gl.location_id) FROM groups gl WHERE gl.card_id = c.id),
			(SELECT m.path FROM media m
				WHERE m.entity = 'card' AND m.entity_id = c.id AND m.kind = 'photo'
				ORDER BY m.order_num, m.id LIMIT 1)
		FROM cards c
		JOIN organizations o ON o.id = c.org_id
		LEFT JOIN cities oc ON oc.id = o.city_id
		JOIN categories cat ON cat.id = c.category_id
		LEFT JOIN categories p ON p.id = cat.parent_id
		WHERE (c.slug = $1 OR c.id::text = $1)
		  AND c.status = 'published' AND c.is_active AND o.is_active`

	err := r.db.QueryRow(cardQuery, slugOrID).Scan(
		&id, &activity.Slug, &activity.Name, &activity.Kind, &descr, &activity.Status,
		&activity.Format, &lesson, &updatedAt, &verified, &cardVerifiedAt,
		&activity.OrganizationID, &activity.OrganizationSlug, &activity.OrganizationName,
		&activity.OrganizationType, &phone, &site, &orgDescr, &orgEmail,
		&orgAddress, &orgCity, &orgVerified,
		&catID, &catName, &catSlug, &superName, &superSlug,
		&activity.GroupsCount, &activity.LocationsCount, &photo,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("чтение карточки: %w", err)
	}

	activity.ID = strconv.FormatInt(id, 10)
	activity.UpdatedAt = updatedAt
	activity.Verified = verified
	activity.ContactsVerifiedAt = nullDate(cardVerifiedAt)
	activity.Description = nullText(descr)
	activity.Link = nullText(site)
	activity.LessonType = nullText(lesson)
	activity.Photo = nullText(photo)
	activity.Phone = phone.String
	if catID.Valid {
		v := catID.Int64
		activity.CategoryID = &v
	}
	activity.Category = nullText(catName)
	activity.CategorySlug = nullText(catSlug)
	activity.SuperCategory = nullText(superName)
	activity.SuperCategorySlug = nullText(superSlug)

	activity.Organization = &models.Organization{
		ID:               activity.OrganizationID,
		Slug:             activity.OrganizationSlug,
		Name:             activity.OrganizationName,
		Type:             activity.OrganizationType,
		Description:      nullText(orgDescr),
		Phone:            phone.String,
		Email:            nullText(orgEmail),
		Site:             nullText(site),
		Address:          nullText(orgAddress),
		City:             nullText(orgCity),
		ContactsVerified: nullDate(orgVerified),
	}

	if activity.Locations, err = r.activityLocations(id); err != nil {
		return nil, err
	}
	if activity.Groups, err = r.activityGroups(id); err != nil {
		return nil, err
	}
	if activity.Photos, activity.Videos, err = r.activityMedia(id); err != nil {
		return nil, err
	}

	// Поля «подходящей группы и точки» в полном ответе не имеют смысла — там и
	// так лежат все группы и точки. Заполняем первую точку и первую группу,
	// чтобы `/api/cards`-клиенты не увидели null там, где он не ожидаем.
	if len(activity.Locations) > 0 {
		loc := activity.Locations[0]
		activity.City = loc.City
		activity.District = loc.District
		activity.Address = &loc.Address
		activity.Lat = loc.Lat
		activity.Lng = loc.Lng
		activity.LocationID = &loc.ID
		activity.LocationName = loc.Name
	}
	if len(activity.Groups) > 0 {
		g := activity.Groups[0]
		activity.GroupID = &g.ID
		activity.GroupName = g.Name
		activity.Age.MinAge = g.AgeFrom
		activity.Age.MaxAge = g.AgeTo
		activity.Price = g.PriceFrom
		activity.PriceTo = g.PriceTo
		activity.PricePeriod = g.PricePeriod
		activity.Seats = g.Seats
	}

	return &activity, nil
}

func (r *Repository) activityLocations(cardID int64) ([]models.Location, error) {
	rows, err := r.db.Query(`
		SELECT l.id, l.name, ci.name, d.name, l.address, l.lat, l.lng, l.phone,
			l.contacts_verified_at,
			(SELECT count(*) FROM groups gl WHERE gl.location_id = l.id AND gl.card_id = $1)
		FROM locations l
		JOIN cities ci ON ci.id = l.city_id
		LEFT JOIN districts d ON d.id = l.district_id
		WHERE l.is_active AND l.id = ANY (SELECT location_id FROM groups WHERE card_id = $1)
		ORDER BY l.id`, cardID)
	if err != nil {
		return nil, fmt.Errorf("чтение точек: %w", err)
	}
	defer rows.Close()

	locations := make([]models.Location, 0)
	for rows.Next() {
		var (
			l        models.Location
			name     sql.NullString
			district sql.NullString
			lat      sql.NullFloat64
			lng      sql.NullFloat64
			phone    sql.NullString
			verified sql.NullTime
		)
		if err := rows.Scan(&l.ID, &name, &l.City, &district, &l.Address, &lat, &lng,
			&phone, &verified, &l.GroupsCount); err != nil {
			return nil, fmt.Errorf("чтение строки точки: %w", err)
		}
		l.Name = nullText(name)
		l.District = nullText(district)
		l.Phone = nullText(phone)
		l.ContactsVerified = nullDate(verified)
		l.Photos = make([]models.Media, 0)
		if lat.Valid {
			l.Lat = &lat.Float64
		}
		if lng.Valid {
			l.Lng = &lng.Float64
		}
		locations = append(locations, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return r.attachLocationPhotos(cardID, locations)
}

// attachLocationPhotos одним запросом добирает фото точек этой карточки. Отдельный
// запрос, а не join в основном: join размножил бы строки точек, а §7.13 требует
// одну точку один раз.
func (r *Repository) attachLocationPhotos(cardID int64, locations []models.Location) ([]models.Location, error) {
	rows, err := r.db.Query(`
		SELECT m.entity_id, m.path, m.caption, m.source_url, m.author, m.order_num
		FROM media m
		WHERE m.entity = 'location' AND m.kind = 'photo'
		  AND m.entity_id = ANY (SELECT location_id FROM groups WHERE card_id = $1)
		ORDER BY m.entity_id, m.order_num, m.id`, cardID)
	if err != nil {
		return nil, fmt.Errorf("чтение фото точек: %w", err)
	}
	defer rows.Close()

	byLocation := make(map[int64]int, len(locations))
	for i := range locations {
		byLocation[locations[i].ID] = i
	}

	for rows.Next() {
		var (
			locationID int64
			m          models.Media
			caption    sql.NullString
			source     sql.NullString
			author     sql.NullString
		)
		if err := rows.Scan(&locationID, &m.Path, &caption, &source, &author, &m.Order); err != nil {
			return nil, fmt.Errorf("чтение строки фото точки: %w", err)
		}
		m.Caption, m.Source, m.Author = nullText(caption), nullText(source), nullText(author)
		if idx, ok := byLocation[locationID]; ok {
			locations[idx].Photos = append(locations[idx].Photos, m)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход фото точек: %w", err)
	}

	return locations, nil
}

func (r *Repository) activityGroups(cardID int64) ([]models.Group, error) {
	rows, err := r.db.Query(`
		SELECT g.id, g.name, g.age_from, g.age_to, g.price_from, g.price_to,
			g.price_period, g.location_id, g.seats,
			s.weekday, s.time_from, s.time_to, s.note, s.seats
		FROM groups g
		LEFT JOIN schedules s ON s.group_id = g.id
		WHERE g.card_id = $1
		ORDER BY g.id, s.weekday, s.time_from`, cardID)
	if err != nil {
		return nil, fmt.Errorf("чтение групп: %w", err)
	}
	defer rows.Close()

	groups := make([]models.Group, 0)
	byID := make(map[int64]int)
	for rows.Next() {
		var (
			g          models.Group
			weekday    sql.NullInt64
			timeFrom   sql.NullTime
			timeTo     sql.NullTime
			note       sql.NullString
			schedSeats sql.NullInt64
			name       sql.NullString
			ageFrom    sql.NullInt64
			ageTo      sql.NullInt64
			priceFrom  sql.NullInt64
			priceTo    sql.NullInt64
			period     sql.NullString
			seats      sql.NullInt64
		)
		if err := rows.Scan(&g.ID, &name, &ageFrom, &ageTo, &priceFrom, &priceTo,
			&period, &g.LocationID, &seats,
			&weekday, &timeFrom, &timeTo, &note, &schedSeats); err != nil {
			return nil, fmt.Errorf("чтение строки группы: %w", err)
		}

		idx, seen := byID[g.ID]
		if !seen {
			g.Name = nullText(name)
			g.AgeFrom = nullSmallInt(ageFrom)
			g.AgeTo = nullSmallInt(ageTo)
			g.PriceFrom = nullInt(priceFrom)
			g.PriceTo = nullInt(priceTo)
			g.PricePeriod = nullText(period)
			g.Seats = nullInt(seats)
			g.Schedules = make([]models.Lesson, 0)
			byID[g.ID] = len(groups)
			groups = append(groups, g)
			idx = len(groups) - 1
		}
		if weekday.Valid {
			groups[idx].Schedules = append(groups[idx].Schedules, models.Lesson{
				Weekday:  int(weekday.Int64),
				TimeFrom: timeOrEmpty(timeFrom),
				TimeTo:   timeOrEmpty(timeTo),
				Note:     nullText(note),
				Seats:    nullInt(schedSeats),
			})
		}
	}
	return groups, rows.Err()
}

func (r *Repository) activityMedia(cardID int64) (photos, videos []models.Media, err error) {
	rows, err := r.db.Query(`
		SELECT kind, path, caption, source_url, author, order_num
		FROM media
		WHERE entity = 'card' AND entity_id = $1
		ORDER BY kind, order_num, id`, cardID)
	if err != nil {
		return nil, nil, fmt.Errorf("чтение медиа: %w", err)
	}
	defer rows.Close()

	photos = make([]models.Media, 0)
	videos = make([]models.Media, 0)
	for rows.Next() {
		var (
			kind    string
			m       models.Media
			caption sql.NullString
			source  sql.NullString
			author  sql.NullString
		)
		if err := rows.Scan(&kind, &m.Path, &caption, &source, &author, &m.Order); err != nil {
			return nil, nil, fmt.Errorf("чтение строки медиа: %w", err)
		}
		m.Caption, m.Source, m.Author = nullText(caption), nullText(source), nullText(author)
		if kind == "video" {
			videos = append(videos, m)
		} else {
			photos = append(photos, m)
		}
	}
	return photos, videos, rows.Err()
}

func nullDate(t sql.NullTime) *string {
	if !t.Valid {
		return nil
	}
	s := t.Time.Format(dateLayout)
	return &s
}

func nullSmallInt(v sql.NullInt64) *int {
	if !v.Valid {
		return nil
	}
	n := int(v.Int64)
	return &n
}

func nullInt(v sql.NullInt64) *int {
	return nullSmallInt(v)
}

// timeOrEmpty — value TIME из lib/pq приходит time.Time с датой 0001-01-01 в
// таймзоне подключения; наружу отдаём только ЧЧ:ММ (§8, таблица 6).
func timeOrEmpty(v sql.NullTime) string {
	if !v.Valid {
		return ""
	}
	return v.Time.Format("15:04")
}
