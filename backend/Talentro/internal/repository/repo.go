package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"talentro/internal/config"
	"talentro/internal/models"
	"time"

	"github.com/lib/pq"
)

type Repository struct {
	db *sql.DB
}

func New(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func NewDB(cfg *config.Config) (*sql.DB, error) {
	connStr := cfg.DatabaseURL
	if connStr == "" {
		return nil, fmt.Errorf("не задана переменная DATABASE_URL")
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("ошибка создания подключения к БД: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("не удалось подключиться к БД: %w", err)
	}

	log.Println("успешное подключение к базе данных main_db!")

	return db, nil
}

func (r *Repository) GetActivity(identifier string) (models.CardDetails, error) {
	f := models.ActivityFilter{Page: 1, Limit: 1}
	if id, err := strconv.ParseInt(identifier, 10, 64); err == nil {
		f.ID = &id
	} else {
		f.Slug = &identifier
	}
	result, err := r.SearchCards(f)
	if err != nil {
		return models.CardDetails{}, err
	}
	if len(result.Items) == 0 {
		return models.CardDetails{}, sql.ErrNoRows
	}
	details := models.CardDetails{Card: result.Items[0]}
	if details.OrganizationID != nil {
		rows, err := r.db.Query(`
			SELECT channel, contact
			FROM messengers
			WHERE activity_id = $1 OR organization_id = $2
			ORDER BY sort_order, channel, id`,
			details.ID, *details.OrganizationID,
		)
		if err != nil {
			return models.CardDetails{}, fmt.Errorf("ошибка чтения мессенджеров: %w", err)
		}
		defer rows.Close()

		details.Messengers = make([]models.OrganizationMessenger, 0)
		for rows.Next() {
			var messenger models.OrganizationMessenger
			if err := rows.Scan(&messenger.Channel, &messenger.Contact); err != nil {
				return models.CardDetails{}, fmt.Errorf("ошибка чтения мессенджера: %w", err)
			}
			details.Messengers = append(details.Messengers, messenger)
		}
		if err := rows.Err(); err != nil {
			return models.CardDetails{}, fmt.Errorf("ошибка обхода мессенджеров: %w", err)
		}
	}
	return details, nil
}

func (r *Repository) GetOrganization(id int64) (models.OrganizationDetails, error) {
	var organization models.OrganizationDetails

	err := r.db.QueryRow(`
		SELECT
			id, name, organization_type, description, phone,
			email, website, city_id, address, latitude, longitude,
			contacts_checked_at, owner_id
		FROM organizations
		WHERE id = $1`,
		id,
	).Scan(
		&organization.ID,
		&organization.Name,
		&organization.Type,
		&organization.Description,
		&organization.Phone,
		&organization.Email,
		&organization.Website,
		&organization.CityID,
		&organization.Address,
		&organization.Latitude,
		&organization.Longitude,
		&organization.ContactsCheckedAt,
		&organization.OwnerID,
	)
	if err != nil {
		return models.OrganizationDetails{}, err
	}

	messengers, err := r.organizationMessengers(id)
	if err != nil {
		return models.OrganizationDetails{}, err
	}
	organization.Messengers = messengers

	organization.Cards = make([]models.Card, 0)
	orgID := id
	cards, err := r.SearchCards(models.ActivityFilter{
		OrganizationID: &orgID,
		Page:           1,
		Limit:          100,
	})
	if err != nil {
		return models.OrganizationDetails{}, err
	}
	organization.Cards = cards.Items

	return organization, nil
}

func (r *Repository) organizationMessengers(id int64) ([]models.OrganizationMessenger, error) {
	rows, err := r.db.Query(`
		SELECT channel, contact
		FROM messengers
		WHERE organization_id = $1
		ORDER BY sort_order, channel, id`,
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("чтение мессенджеров организации: %w", err)
	}
	defer rows.Close()

	items := make([]models.OrganizationMessenger, 0)
	for rows.Next() {
		var item models.OrganizationMessenger
		if err := rows.Scan(&item.Channel, &item.Contact); err != nil {
			return nil, fmt.Errorf("чтение мессенджера организации: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход мессенджеров организации: %w", err)
	}
	return items, nil
}

func (r *Repository) ListCities() ([]models.Reference, error) {
	rows, err := r.db.Query(`SELECT id, name, sort_order FROM cities ORDER BY sort_order, name`)
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения городов: %w", err)
	}
	defer rows.Close()
	items := make([]models.Reference, 0)
	for rows.Next() {
		var item models.Reference
		if err := rows.Scan(&item.ID, &item.Name, &item.SortOrder); err != nil {
			return nil, fmt.Errorf("ошибка чтения города: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) ListDistricts(cityID *int64) ([]models.Reference, error) {
	query := `SELECT id, city_id, name, sort_order FROM districts`
	args := []any{}
	if cityID != nil {
		args = append(args, *cityID)
		query += " WHERE city_id = $1"
	}
	query += " ORDER BY sort_order, name"
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения районов: %w", err)
	}
	defer rows.Close()
	items := make([]models.Reference, 0)
	for rows.Next() {
		var item models.Reference
		if err := rows.Scan(&item.ID, &item.CityID, &item.Name, &item.SortOrder); err != nil {
			return nil, fmt.Errorf("ошибка чтения района: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) ListDirections() ([]models.Reference, error) {
	rows, err := r.db.Query(`SELECT id, name, parent_id, record_type, sort_order FROM directions ORDER BY COALESCE(parent_id, 0), sort_order, name`)
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения направлений: %w", err)
	}
	defer rows.Close()
	items := make([]models.Reference, 0)
	for rows.Next() {
		var item models.Reference
		if err := rows.Scan(&item.ID, &item.Name, &item.ParentID, &item.RecordType, &item.SortOrder); err != nil {
			return nil, fmt.Errorf("ошибка чтения направления: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) Recommendations(cityID string) (models.CardSearchResult, error) {
	filter := models.ActivityFilter{Page: 1, Limit: 10, MinVotes: 3}
	if cityID != "" {
		id, _ := parseFilterID(cityID)
		filter.CityID = &id
	}
	sort := "rating"
	filter.Sort = &sort
	result, err := r.SearchCards(filter)
	if err != nil || result.Total > 0 {
		return result, err
	}
	filter.MinVotes = 0
	filter.RecentDays = 30
	sort = "new"
	filter.Sort = &sort
	return r.SearchCards(filter)
}

func (r *Repository) SearchCards(f models.ActivityFilter) (models.CardSearchResult, error) {
	query, args, countQuery, countArgs := buildSearchCardsQueries(f)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return models.CardSearchResult{}, fmt.Errorf("ошибка при выполнении запроса: %w", err)
	}
	defer rows.Close()

	cards := make([]models.Card, 0)
	for rows.Next() {
		var card models.Card
		var schedulesJSON, photosJSON, groupsJSON []byte
		var videosJSON []byte

		if err := rows.Scan(
			&card.ID, &card.Slug, &card.Name, &card.Description, &card.RecordType, &card.Status,
			&card.CityID, &card.City, &card.DistrictID, &card.District, &card.DirectionID, &card.Direction,
			&card.OrganizationID, &card.Organization, &card.ClassType, &card.ClassFormat,
			&card.PriceFrom, &card.PriceTo, &card.PricePeriod, &card.AgeFrom, &card.AgeTo,
			&card.Address, &card.Latitude, &card.Longitude, &card.Phone, &card.Email, &card.Website,
			&card.CoverPath, &card.CoverAlt, &card.ContactsCheckedAt, &card.CreatedAt, &card.UpdatedAt,
			&card.Verified, &card.Rating.Score, &card.Rating.VotesCount, &card.Rating.Likes,
			&card.Rating.Dislikes, &schedulesJSON, &photosJSON, &videosJSON, &groupsJSON,
		); err != nil {
			return models.CardSearchResult{}, fmt.Errorf("ошибка чтения строки: %w", err)
		}

		card.Age = models.CardAge{MinAge: card.AgeFrom, MaxAge: card.AgeTo}

		if err := json.Unmarshal(schedulesJSON, &card.Schedules); err != nil {
			return models.CardSearchResult{}, fmt.Errorf("ошибка чтения расписания: %w", err)
		}
		if err := json.Unmarshal(photosJSON, &card.Photos); err != nil {
			return models.CardSearchResult{}, fmt.Errorf("ошибка чтения фотографий: %w", err)
		}
		if err := json.Unmarshal(videosJSON, &card.Videos); err != nil {
			return models.CardSearchResult{}, fmt.Errorf("ошибка чтения видео: %w", err)
		}
		if err := json.Unmarshal(groupsJSON, &card.Groups); err != nil {
			return models.CardSearchResult{}, fmt.Errorf("ошибка чтения групп: %w", err)
		}

		cards = append(cards, card)
	}

	if err := rows.Err(); err != nil {
		return models.CardSearchResult{}, fmt.Errorf("ошибка при обходе строк: %w", err)
	}
	if err := rows.Close(); err != nil {
		return models.CardSearchResult{}, fmt.Errorf("ошибка закрытия результата запроса: %w", err)
	}

	var total int64
	if err := r.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return models.CardSearchResult{}, fmt.Errorf("ошибка подсчёта карточек: %w", err)
	}

	page, limit := f.Page, f.Limit
	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	return models.CardSearchResult{
		Items: cards,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

func buildSearchCardsQuery(f models.ActivityFilter) (string, []any) {
	query, args, _, _ := buildSearchCardsQueries(f)
	return query, args
}

func buildSearchCardsCountQuery(f models.ActivityFilter) (string, []any) {
	_, _, query, args := buildSearchCardsQueries(f)
	return query, args
}

func buildSearchCardsQueries(f models.ActivityFilter) (string, []any, string, []any) {
	args := make([]any, 0)
	groupConditions := make([]string, 0)

	// Эти фильтры проверяются на одной и той же группе и её месте.
	if f.CityID != nil {
		args = append(args, *f.CityID)
		groupConditions = append(groupConditions, fmt.Sprintf("loc.city_id = $%d", len(args)))
	}

	if len(f.DistrictIDs) > 0 {
		args = append(args, pq.Array(f.DistrictIDs))
		groupConditions = append(groupConditions, fmt.Sprintf("loc.district_id = ANY($%d)", len(args)))
	}

	if f.Age != nil {
		args = append(args, *f.Age)
		groupConditions = append(groupConditions, fmt.Sprintf(
			"(ag.age_from IS NULL OR ag.age_from <= $%d) AND (ag.age_to IS NULL OR ag.age_to >= $%d)",
			len(args), len(args),
		))
	}

	if f.PriceMax != nil {
		args = append(args, *f.PriceMax)
		groupConditions = append(groupConditions, fmt.Sprintf("ag.price_from <= $%d", len(args)))
	}

	if f.Free != nil {
		if *f.Free {
			groupConditions = append(groupConditions, "ag.price_from = 0")
		} else {
			groupConditions = append(groupConditions, "ag.price_from > 0")
		}
	}

	if f.Day != nil || f.Time != nil {
		scheduleCondition := "EXISTS (SELECT 1 FROM schedules s WHERE s.age_group_id = ag.id"

		if f.Day != nil {
			day, _ := parseFilterID(*f.Day)
			args = append(args, day)
			scheduleCondition += fmt.Sprintf(" AND s.weekday = $%d", len(args))
		}

		if f.Time != nil {
			var from, to string
			switch *f.Time {
			case "утро", "morning":
				from, to = "06:00", "12:00"
			case "день", "day":
				from, to = "12:00", "17:00"
			case "вечер", "evening":
				from, to = "17:00", "20:00"
			}

			if from != "" {
				args = append(args, from, to)
				scheduleCondition += fmt.Sprintf(
					" AND s.start_time >= $%d::time AND s.start_time < $%d::time",
					len(args)-1, len(args),
				)
			}
		}

		scheduleCondition += ")"
		groupConditions = append(groupConditions, scheduleCondition)
	}

	distanceLatParam, distanceLonParam := 0, 0
	if f.Radius != nil && f.Latitude != nil && f.Longitude != nil {
		args = append(args, *f.Latitude, *f.Longitude)
		distanceLatParam, distanceLonParam = len(args)-1, len(args)

		args = append(args, *f.Radius)
		groupConditions = append(groupConditions, fmt.Sprintf(
			"loc.latitude IS NOT NULL AND loc.longitude IS NOT NULL AND %s <= $%d",
			haversineSQL("loc.latitude", "loc.longitude", distanceLatParam, distanceLonParam),
			len(args),
		))
	}

	groupFilter := strings.Join(groupConditions, " AND ")

	where := " WHERE c.status = 'published' AND c.is_active = true"

	if f.OwnerOnly {
		if f.OwnerID == nil || *f.OwnerID <= 0 {
			where += " AND false"
		} else {
			args = append(args, *f.OwnerID)
			where = fmt.Sprintf(" WHERE c.owner_id = $%d", len(args))
		}
	}

	if f.ID != nil {
		args = append(args, *f.ID)
		where += fmt.Sprintf(" AND c.id = $%d", len(args))
	}
	if f.Slug != nil {
		args = append(args, *f.Slug)
		where += fmt.Sprintf(" AND c.slug = $%d", len(args))
	}
	if f.FavoriteUserID != nil {
		args = append(args, *f.FavoriteUserID)
		where += fmt.Sprintf(
			" AND EXISTS (SELECT 1 FROM favorites fav WHERE fav.activity_id = c.id AND fav.user_id = $%d)",
			len(args),
		)
	}
	if f.OrganizationID != nil {
		args = append(args, *f.OrganizationID)
		where += fmt.Sprintf(" AND c.organization_id = $%d", len(args))
	}
	if f.MinVotes > 0 {
		args = append(args, f.MinVotes)
		where += fmt.Sprintf(
			" AND EXISTS (SELECT 1 FROM activity_ratings rated WHERE rated.activity_id = c.id AND rated.votes_count >= $%d)",
			len(args),
		)
	}
	if f.RecentDays > 0 {
		args = append(args, f.RecentDays)
		where += fmt.Sprintf(" AND c.created_at >= now() - ($%d * interval '1 day')", len(args))
	}

	if groupFilter != "" {
		where += " AND EXISTS (" +
			"SELECT 1 FROM age_groups ag " +
			"JOIN locations loc ON loc.id = ag.location_id " +
			"WHERE ag.activity_id = c.id AND " + groupFilter +
			")"
	}

	if f.CategoryID != nil {
		args = append(args, *f.CategoryID)
		where += fmt.Sprintf(` AND c.direction_id IN (
			WITH RECURSIVE direction_tree(id) AS (
				SELECT id FROM directions WHERE id = $%d
				UNION
				SELECT d.id FROM directions d
				JOIN direction_tree parent ON d.parent_id = parent.id
			)
			SELECT id FROM direction_tree
		)`, len(args))
	}

	if f.Kind != nil {
		args = append(args, *f.Kind)
		where += fmt.Sprintf(" AND c.record_type = $%d", len(args))
	}

	if f.Online != nil {
		if *f.Online {
			where += " AND c.class_format IN ('online', 'both')"
		} else {
			where += " AND c.class_format = 'offline'"
		}
	}

	contactsCheckedAt := `COALESCE(
		c.contacts_checked_at,
		(SELECT MAX(loc_checked.contacts_checked_at)
		 FROM age_groups ag_checked
		 JOIN locations loc_checked ON loc_checked.id = ag_checked.location_id
		 WHERE ag_checked.activity_id = c.id),
		o.contacts_checked_at
	)`

	if f.Verified != nil {
		if *f.Verified {
			where += " AND " + contactsCheckedAt + " >= now() - interval '90 days'"
		} else {
			where += " AND (" + contactsCheckedAt +
				" IS NULL OR " + contactsCheckedAt + " < now() - interval '90 days')"
		}
	}

	if f.Query != nil {
		args = append(args, "%"+normalizeSearch(*f.Query)+"%")
		param := len(args)
		where += fmt.Sprintf(` AND (
			LOWER(REPLACE(COALESCE(c.name, ''), 'ё', 'е')) LIKE $%d OR
			LOWER(REPLACE(COALESCE(c.description, ''), 'ё', 'е')) LIKE $%d OR
			EXISTS (
				SELECT 1 FROM organizations org_search
				WHERE org_search.id = c.organization_id
				  AND LOWER(REPLACE(org_search.name, 'ё', 'е')) LIKE $%d
			) OR
			EXISTS (
				SELECT 1 FROM directions dir_search
				WHERE dir_search.id = c.direction_id
				  AND LOWER(REPLACE(dir_search.name, 'ё', 'е')) LIKE $%d
			)
		)`, param, param, param, param)
	}

	countArgs := append([]any(nil), args...)
	countQuery := `
		SELECT COUNT(*)
		FROM activities c
		JOIN organizations o ON o.id = c.organization_id` + where

	// Для sort=near координаты нужны даже без фильтра radius.
	if f.Sort != nil && *f.Sort == "near" &&
		distanceLatParam == 0 && f.Latitude != nil && f.Longitude != nil {
		args = append(args, *f.Latitude, *f.Longitude)
		distanceLatParam, distanceLonParam = len(args)-1, len(args)
	}

	lateralOrder := "ag.id"
	if f.Sort != nil && *f.Sort == "near" && distanceLatParam > 0 {
		lateralOrder = haversineSQL(
			"loc.latitude", "loc.longitude",
			distanceLatParam, distanceLonParam,
		) + " ASC NULLS LAST, ag.id"
	}

	query := `
		SELECT
			c.id, c.slug, c.name, c.description, c.record_type, c.status,
			COALESCE(g.city_id, o.city_id, 0),
			COALESCE(g.city_name, (SELECT city.name FROM cities city WHERE city.id = o.city_id), ''),
			g.district_id, g.district_name, c.direction_id, dir.name,
			c.organization_id, o.name, COALESCE(c.class_type, ''), c.class_format,
			g.price_from, g.price_to, g.price_period, g.age_from, g.age_to,
			g.address, g.latitude, g.longitude, COALESCE(c.phone, g.phone, o.phone),
			o.email, o.website,
			cover.path, cover.caption,
			` + contactsCheckedAt + `,
			c.created_at, c.updated_at,
			COALESCE(` + contactsCheckedAt + ` >= now() - interval '90 days', false),
			COALESCE(rating.score, 0), COALESCE(rating.votes_count, 0),
			COALESCE(rating.likes, 0), COALESCE(rating.dislikes, 0),
			COALESCE((
				SELECT json_agg(json_build_object(
					'weekday', s.weekday,
					'start_time', s.start_time,
					'end_time', s.end_time,
					'note', s.note
				) ORDER BY s.weekday, s.start_time)
				FROM schedules s
				WHERE s.age_group_id = g.id
			), '[]'::json),
			COALESCE((
				SELECT json_agg(json_build_object(
					'id', m.id::text,
					'path', m.path,
					'alt_text', m.caption,
					'position', m.sort_order,
					'is_cover', m.id = cover.id
				) ORDER BY m.sort_order, m.id)
				FROM media m
				WHERE m.media_type = 'photo'
				  AND (
					m.activity_id = c.id OR
					m.location_id IN (
						SELECT ag_media.location_id
						FROM age_groups ag_media
						WHERE ag_media.activity_id = c.id
					)
				  )
			), '[]'::json),
			COALESCE((
			    SELECT json_agg(json_build_object(
			        'id', m.id::text,
			        'path', m.path,
			        'position', m.sort_order
			    ) ORDER BY m.sort_order, m.id)
			    FROM media m
			    WHERE m.media_type = 'video'
			      AND m.activity_id = c.id
			), '[]'::json),
			COALESCE((
				SELECT json_agg(json_build_object(
					'id', ag_all.id::text,
					'name', ag_all.name,
					'age_from', ag_all.age_from,
					'age_to', ag_all.age_to,
					'price_from', ag_all.price_from,
					'price_to', ag_all.price_to,
					'price_period', ag_all.price_period,
					'seats', ag_all.seats,
					'location', json_build_object(
						'id', loc_all.id::text,
						'city_id', loc_all.city_id::text,
						'city', city_all.name,
						'district_id', loc_all.district_id::text,
						'district', district_all.name,
						'address', loc_all.address,
						'latitude', loc_all.latitude,
						'longitude', loc_all.longitude,
						'phone', loc_all.phone
					),
					'schedules', COALESCE((
						SELECT json_agg(json_build_object(
							'weekday', s_all.weekday,
							'start_time', s_all.start_time,
							'end_time', s_all.end_time,
							'note', s_all.note
						) ORDER BY s_all.weekday, s_all.start_time)
						FROM schedules s_all
						WHERE s_all.age_group_id = ag_all.id
					), '[]'::json)
				) ORDER BY ag_all.id)
				FROM age_groups ag_all
				JOIN locations loc_all ON loc_all.id = ag_all.location_id
				JOIN cities city_all ON city_all.id = loc_all.city_id
				LEFT JOIN districts district_all ON district_all.id = loc_all.district_id
				WHERE ag_all.activity_id = c.id
			), '[]'::json)
		FROM activities c
		JOIN organizations o ON o.id = c.organization_id
		JOIN directions dir ON dir.id = c.direction_id
		LEFT JOIN activity_ratings rating ON rating.activity_id = c.id
		LEFT JOIN LATERAL (
			SELECT
				ag.*,
				loc.city_id,
				city.name AS city_name,
				loc.district_id,
				district.name AS district_name,
				loc.address,
				loc.latitude,
				loc.longitude,
				loc.phone,
				loc.contacts_checked_at
			FROM age_groups ag
			JOIN locations loc ON loc.id = ag.location_id
			JOIN cities city ON city.id = loc.city_id
			LEFT JOIN districts district ON district.id = loc.district_id
			WHERE ag.activity_id = c.id` +
		func() string {
			if groupFilter == "" {
				return ""
			}
			return " AND " + groupFilter
		}() +
		`
			ORDER BY ` + lateralOrder + `
			LIMIT 1
		) g ON true
		LEFT JOIN LATERAL (
			SELECT m.id, m.path, m.caption
			FROM media m
			WHERE m.media_type = 'photo'
			  AND (
				m.activity_id = c.id OR
				m.location_id IN (
					SELECT ag_media.location_id
					FROM age_groups ag_media
					WHERE ag_media.activity_id = c.id
				)
			  )
			ORDER BY m.sort_order, m.id
			LIMIT 1
		) cover ON true` + where

	if f.Sort != nil && *f.Sort == "near" && distanceLatParam > 0 {
		distance := haversineSQL("g.latitude", "g.longitude", distanceLatParam, distanceLonParam)
		query += " ORDER BY " + distance + " ASC NULLS LAST, c.id DESC"
	} else {
		switch {
		case f.Sort != nil && *f.Sort == "rating":
			query += ` ORDER BY (
				SELECT rating_sort.score
				FROM activity_ratings rating_sort
				WHERE rating_sort.activity_id = c.id
				  AND rating_sort.votes_count >= 3
			) DESC NULLS LAST, c.id DESC`
		case f.Sort != nil && *f.Sort == "free":
			query += ` ORDER BY EXISTS (
				SELECT 1 FROM age_groups free_group
				WHERE free_group.activity_id = c.id AND free_group.price_from = 0
			) DESC, c.id DESC`
		case f.Sort != nil && *f.Sort == "updated_week":
			query += " ORDER BY (c.updated_at >= now() - interval '7 days') DESC, c.updated_at DESC, c.id DESC"
		case f.Sort != nil && *f.Sort == "new":
			query += " ORDER BY c.created_at DESC, c.id DESC"
		case (f.Sort == nil || *f.Sort == "relevance") && f.Query != nil:
			args = append(args, normalizeSearch(*f.Query))
			param := len(args)
			query += fmt.Sprintf(
				" ORDER BY CASE WHEN LOWER(REPLACE(c.name, 'ё', 'е')) = $%d "+
					"THEN 0 WHEN LOWER(REPLACE(c.name, 'ё', 'е')) LIKE $%d || '%%' "+
					"THEN 1 ELSE 2 END, c.created_at DESC",
				param, param,
			)
		default:
			query += " ORDER BY c.created_at DESC, c.id DESC"
		}
	}

	limit := f.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}

	args = append(args, limit)
	query += fmt.Sprintf(" LIMIT $%d", len(args))
	args = append(args, (page-1)*limit)
	query += fmt.Sprintf(" OFFSET $%d", len(args))

	return query, args, countQuery, countArgs
}

func parseFilterID(value string) (int64, error) {
	return strconv.ParseInt(value, 10, 64)
}

func normalizeSearch(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	return strings.ReplaceAll(value, "ё", "е")
}

func haversineSQL(latitudeColumn, longitudeColumn string, latParam, lonParam int) string {
	return fmt.Sprintf(`6371000 * 2 * ASIN(SQRT(LEAST(1.0,
		POWER(SIN(RADIANS(%s - $%d) / 2), 2) +
		COS(RADIANS($%d)) * COS(RADIANS(%s)) *
		POWER(SIN(RADIANS(%s - $%d) / 2), 2)
	)))`,
		latitudeColumn, latParam,
		latParam, latitudeColumn,
		longitudeColumn, lonParam,
	)
}

func (r *Repository) Ping(ctx context.Context) error {
	if err := r.db.PingContext(ctx); err != nil {
		return fmt.Errorf("ошибка проверки подключения к БД: %w", err)
	}
	return nil
}

func (r *Repository) UpdateOwnedActivity(
	ownerID int64,
	activityID int64,
	input models.OwnedActivityInput,
) (models.OwnedActivity, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.OwnedActivity{}, err
	}
	defer tx.Rollback()

	// Находим организацию владельца.
	var organizationID int64
	err = tx.QueryRow(
		`SELECT id FROM organizations WHERE owner_id = $1 ORDER BY id LIMIT 1`,
		ownerID,
	).Scan(&organizationID)
	if err != nil {
		return models.OwnedActivity{}, fmt.Errorf("поиск организации владельца: %w", err)
	}

	// Проверяем, что секция существует и принадлежит этому владельцу.
	var currentStatus string
	err = tx.QueryRow(`
		SELECT status
		FROM activities
		WHERE id = $1 AND owner_id = $2
		FOR UPDATE`,
		activityID,
		ownerID,
	).Scan(&currentStatus)
	if err != nil {
		return models.OwnedActivity{}, err
	}

	// Проверяем направление.
	var directionExists bool
	err = tx.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM directions
			WHERE id = $1 AND record_type IN ('activity', 'both')
		)`,
		input.DirectionID,
	).Scan(&directionExists)
	if err != nil {
		return models.OwnedActivity{}, fmt.Errorf("проверка направления: %w", err)
	}
	if !directionExists {
		return models.OwnedActivity{}, fmt.Errorf("направление для секции не найдено")
	}

	// Правка опубликованной секции возвращает её на модерацию.
	status := currentStatus
	if currentStatus == "published" {
		status = "pending"
	}
	if currentStatus == "rejected" {
		status = "draft"
	}

	_, err = tx.Exec(`
		UPDATE activities
		SET name = $3,
		    description = $4,
		    direction_id = $5,
		    class_type = $6,
		    class_format = $7,
		    phone = $8,
		    status = $9,
		    rejection_reason = NULL
		WHERE id = $1 AND owner_id = $2`,
		activityID,
		ownerID,
		strings.TrimSpace(input.Name),
		input.Description,
		input.DirectionID,
		input.ClassType,
		input.ClassFormat,
		input.Phone,
		status,
	)
	if err != nil {
		return models.OwnedActivity{}, fmt.Errorf("обновление секции: %w", err)
	}

	// Запоминаем старые точки, чтобы определить, какие карточки затронет их правка.
	oldRows, err := tx.Query(`
		SELECT DISTINCT location_id
		FROM age_groups
		WHERE activity_id = $1`,
		activityID,
	)
	if err != nil {
		return models.OwnedActivity{}, err
	}

	oldLocationIDs := make([]int64, 0)
	for oldRows.Next() {
		var id int64
		if err := oldRows.Scan(&id); err != nil {
			oldRows.Close()
			return models.OwnedActivity{}, err
		}
		oldLocationIDs = append(oldLocationIDs, id)
	}
	if err := oldRows.Err(); err != nil {
		oldRows.Close()
		return models.OwnedActivity{}, err
	}
	oldRows.Close()

	// Удаляем группы. Их расписания удалятся автоматически через связь в БД.
	_, err = tx.Exec(`DELETE FROM age_groups WHERE activity_id = $1`, activityID)
	if err != nil {
		return models.OwnedActivity{}, fmt.Errorf("удаление старых групп: %w", err)
	}

	// Сохраняем точки и запоминаем соответствие key -> ID точки в БД.
	locationIDs := make(map[string]int64, len(input.Locations))
	for _, location := range input.Locations {
		var locationID int64
		sourceType := location.SourceType
		if sourceType == "" {
			sourceType = "person"
		}

		if location.ID != nil {
			// Существующую точку разрешаем менять только в своей организации.
			result, err := tx.Exec(`
				UPDATE locations
				SET name = $3,
				    city_id = $4,
				    district_id = $5,
				    address = $6,
				    latitude = $7,
				    longitude = $8,
				    phone = $9,
				    source_type = $10,
				    source_url = $11,
				    updated_at = now()
				WHERE id = $1 AND organization_id = $2`,
				*location.ID,
				organizationID,
				location.Name,
				location.CityID,
				location.DistrictID,
				strings.TrimSpace(location.Address),
				location.Latitude,
				location.Longitude,
				location.Phone,
				sourceType,
				location.SourceURL,
			)
			if err != nil {
				return models.OwnedActivity{}, fmt.Errorf("обновление точки: %w", err)
			}

			affected, err := result.RowsAffected()
			if err != nil || affected == 0 {
				return models.OwnedActivity{}, fmt.Errorf("точка не найдена у этой организации")
			}
			locationID = *location.ID

			// Другие опубликованные секции с этим адресом тоже нужно перепроверить.
			_, err = tx.Exec(`
				UPDATE activities
				SET status = 'pending', rejection_reason = NULL
				WHERE status = 'published'
				  AND id IN (
				    SELECT activity_id FROM age_groups WHERE location_id = $1
				  )`,
				locationID,
			)
			if err != nil {
				return models.OwnedActivity{}, fmt.Errorf("обновление статусов секций с этой точкой: %w", err)
			}
		} else {
			err = tx.QueryRow(`
				INSERT INTO locations (
					organization_id, name, city_id, district_id, address,
					latitude, longitude, phone, source_type, source_url
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
				RETURNING id`,
				organizationID,
				location.Name,
				location.CityID,
				location.DistrictID,
				strings.TrimSpace(location.Address),
				location.Latitude,
				location.Longitude,
				location.Phone,
				sourceType,
				location.SourceURL,
			).Scan(&locationID)
			if err != nil {
				return models.OwnedActivity{}, fmt.Errorf("создание точки: %w", err)
			}
		}

		locationIDs[location.Key] = locationID
	}

	// Создаём новые группы и расписания.
	for _, group := range input.Groups {
		locationID, ok := locationIDs[group.LocationKey]
		if !ok {
			return models.OwnedActivity{}, fmt.Errorf("для группы не найдена точка location_key=%q", group.LocationKey)
		}

		var groupID int64
		err = tx.QueryRow(`
			INSERT INTO age_groups (
				activity_id, name, age_from, age_to, price_from,
				price_to, price_period, location_id, seats
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id`,
			activityID,
			group.Name,
			group.AgeFrom,
			group.AgeTo,
			group.PriceFrom,
			group.PriceTo,
			group.PricePeriod,
			locationID,
			group.Seats,
		).Scan(&groupID)
		if err != nil {
			return models.OwnedActivity{}, fmt.Errorf("сохранение группы: %w", err)
		}

		for _, schedule := range group.Schedules {
			_, err = tx.Exec(`
				INSERT INTO schedules (
					age_group_id, weekday, start_time, end_time, note, seats
				)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				groupID,
				schedule.Weekday,
				schedule.StartTime,
				schedule.EndTime,
				schedule.Note,
				schedule.Seats,
			)
			if err != nil {
				return models.OwnedActivity{}, fmt.Errorf("сохранение расписания: %w", err)
			}
		}
	}

	// Удаляем старые точки только если ими больше не пользуется ни одна группа.
	if len(oldLocationIDs) > 0 {
		_, err = tx.Exec(`
			DELETE FROM locations l
			WHERE l.organization_id = $1
			  AND l.id = ANY($2)
			  AND NOT EXISTS (
			    SELECT 1 FROM age_groups ag WHERE ag.location_id = l.id
			  )`,
			organizationID,
			pq.Array(oldLocationIDs),
		)
		if err != nil {
			return models.OwnedActivity{}, fmt.Errorf("удаление неиспользуемых точек: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return models.OwnedActivity{}, fmt.Errorf("сохранение изменений секции: %w", err)
	}

	return r.GetOwnedActivity(ownerID, activityID)
}
