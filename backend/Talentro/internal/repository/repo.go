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
		rows, err := r.db.Query(`SELECT channel, contact FROM organization_messengers WHERE organization_id = $1 ORDER BY sort_order, channel`, *details.OrganizationID)
		if err != nil {
			return models.CardDetails{}, fmt.Errorf("ошибка чтения мессенджеров организации: %w", err)
		}
		defer rows.Close()
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
		SELECT id, name, organization_type, description, phone, email, website, city_id, district_id, owner_id
		FROM organizations WHERE id = $1`, id).Scan(
		&organization.ID, &organization.Name, &organization.Type, &organization.Description,
		&organization.Phone, &organization.Email, &organization.Website, &organization.CityID,
		&organization.DistrictID, &organization.OwnerID,
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
	cards, err := r.SearchCards(models.ActivityFilter{OrganizationID: &orgID, Page: 1, Limit: 100})
	if err != nil {
		return models.OrganizationDetails{}, err
	}
	organization.Cards = cards.Items
	return organization, nil
}

func (r *Repository) organizationMessengers(id int64) ([]models.OrganizationMessenger, error) {
	rows, err := r.db.Query(`SELECT channel, contact FROM organization_messengers WHERE organization_id = $1 ORDER BY sort_order, channel`, id)
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
	return items, rows.Err()
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
		var schedulesJSON, photosJSON []byte
		if err := rows.Scan(
			&card.ID, &card.Slug, &card.Name, &card.Description, &card.RecordType, &card.Status,
			&card.CityID, &card.City, &card.DistrictID, &card.District, &card.DirectionID, &card.Direction,
			&card.OrganizationID, &card.Organization, &card.ClassType, &card.ClassFormat,
			&card.PriceFrom, &card.PriceTo, &card.PricePeriod, &card.AgeFrom, &card.AgeTo,
			&card.Address, &card.Latitude, &card.Longitude, &card.Phone, &card.Email, &card.Website,
			&card.CoverPath, &card.CoverAlt, &card.ContactsCheckedAt, &card.CreatedAt, &card.UpdatedAt,
			&card.Verified, &card.Rating.Score, &card.Rating.VotesCount, &card.Rating.Likes,
			&card.Rating.Dislikes, &schedulesJSON, &photosJSON,
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
	return models.CardSearchResult{Items: cards, Total: total, Page: page, Limit: limit}, nil
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
	query := `SELECT
		c.id, c.slug, c.name, c.description, c.record_type, c.status,
		c.city_id, ci.name, c.district_id, d.name, c.direction_id, dir.name,
		c.organization_id, o.name, c.class_type, c.class_format,
		c.price_from, c.price_to, c.price_period, c.age_from, c.age_to,
		c.address, c.latitude, c.longitude, COALESCE(c.phone, o.phone), o.email, o.website,
		cover.path, cover.alt_text, c.contacts_checked_at, c.created_at, c.updated_at,
		(c.contacts_checked_at >= now() - interval '90 days'),
		COALESCE(cr.score, 0), COALESCE(cr.votes_count, 0), COALESCE(cr.likes, 0), COALESCE(cr.dislikes, 0),
		COALESCE((SELECT json_agg(json_build_object(
			'weekday', s.weekday, 'start_time', s.start_time, 'end_time', s.end_time, 'note', s.note
		) ORDER BY s.weekday, s.start_time) FROM schedules s WHERE s.card_id = c.id), '[]'::json),
		COALESCE((SELECT json_agg(json_build_object(
			'path', p.path, 'alt_text', p.alt_text, 'position', p.sort_order, 'is_cover', p.is_cover
		) ORDER BY p.sort_order) FROM card_photos p WHERE p.card_id = c.id), '[]'::json)
		FROM cards c
		JOIN cities ci ON ci.id = c.city_id
		LEFT JOIN districts d ON d.id = c.district_id
		JOIN directions dir ON dir.id = c.direction_id
		LEFT JOIN organizations o ON o.id = c.organization_id
		LEFT JOIN card_ratings cr ON cr.card_id = c.id
		LEFT JOIN LATERAL (
			SELECT p.path, p.alt_text FROM card_photos p
			WHERE p.card_id = c.id ORDER BY p.is_cover DESC, p.sort_order LIMIT 1
		) cover ON true
		WHERE c.status = 'published' AND c.is_active = true`

	args := []any{}
	if f.ID != nil {
		args = append(args, *f.ID)
		query += fmt.Sprintf(" AND c.id = $%d", len(args))
	}
	if f.Slug != nil {
		args = append(args, *f.Slug)
		query += fmt.Sprintf(" AND c.slug = $%d", len(args))
	}
	if f.FavoriteUserID != nil {
		args = append(args, *f.FavoriteUserID)
		query += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM favorites fav WHERE fav.card_id = c.id AND fav.user_id = $%d)", len(args))
	}
	if f.OrganizationID != nil {
		args = append(args, *f.OrganizationID)
		query += fmt.Sprintf(" AND c.organization_id = $%d", len(args))
	}
	if f.MinVotes > 0 {
		args = append(args, f.MinVotes)
		query += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM card_ratings rated WHERE rated.card_id = c.id AND rated.votes_count >= $%d)", len(args))
	}
	if f.RecentDays > 0 {
		args = append(args, f.RecentDays)
		query += fmt.Sprintf(" AND c.created_at >= now() - ($%d * interval '1 day')", len(args))
	}

	if f.CityID != nil {
		args = append(args, *f.CityID)
		query += fmt.Sprintf(" AND c.city_id = $%d", len(args))
	}
	if len(f.DistrictIDs) > 0 {
		args = append(args, pq.Array(f.DistrictIDs))
		query += fmt.Sprintf(
			" AND c.district_id = ANY($%d)",
			len(args),
		)
	}
	if f.CategoryID != nil {
		args = append(args, *f.CategoryID)
		query += fmt.Sprintf(` AND c.direction_id IN (
			WITH RECURSIVE direction_tree(id) AS (
				SELECT id FROM directions WHERE id = $%d
				UNION
				SELECT d.id FROM directions d JOIN direction_tree parent ON d.parent_id = parent.id
			)
			SELECT id FROM direction_tree
		)`, len(args))
	}
	if f.Age != nil {
		args = append(args, *f.Age)
		query += fmt.Sprintf(" AND c.age_from <= $%d", len(args))
		query += fmt.Sprintf(" AND (c.age_to IS NULL OR c.age_to >= $%d)", len(args))
	}
	if f.PriceMax != nil {
		args = append(args, *f.PriceMax)
		query += fmt.Sprintf(" AND c.price_from <= $%d", len(args))
	}
	if f.Free != nil {
		if *f.Free {
			query += " AND c.price_from = 0"
		} else {
			query += " AND c.price_from > 0"
		}
	}
	if f.Kind != nil {
		args = append(args, *f.Kind)
		query += fmt.Sprintf(" AND c.record_type = $%d", len(args))
	}
	if f.Online != nil {
		if *f.Online {
			query += " AND c.class_format IN ('online', 'mixed')"
		} else {
			query += " AND c.class_format = 'offline'"
		}
	}
	if f.Verified != nil {
		if *f.Verified {
			query += " AND c.contacts_checked_at >= now() - interval '90 days'"
		} else {
			query += " AND (c.contacts_checked_at IS NULL OR c.contacts_checked_at < now() - interval '90 days')"
		}
	}
	if f.Day != nil || f.Time != nil {
		query += " AND EXISTS (SELECT 1 FROM schedules s WHERE s.card_id = c.id"
		if f.Day != nil {
			day, _ := parseFilterID(*f.Day)
			args = append(args, day)
			query += fmt.Sprintf(" AND s.weekday = $%d", len(args))
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
			args = append(args, from, to)
			query += fmt.Sprintf(" AND s.start_time >= $%d::time AND s.start_time < $%d::time", len(args)-1, len(args))
		}
		query += ")"
	}
	distanceExpr := ""
	if f.Latitude != nil && f.Longitude != nil && (f.Radius != nil || (f.Sort != nil && *f.Sort == "near")) {
		args = append(args, *f.Latitude, *f.Longitude)
		latParam, lonParam := len(args)-1, len(args)
		distanceExpr = haversineSQL(latParam, lonParam)
		if f.Radius != nil {
			args = append(args, *f.Radius)
			query += fmt.Sprintf(" AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND %s <= $%d", distanceExpr, len(args))
		}
	}
	if f.Query != nil {
		needle := "%" + normalizeSearch(*f.Query) + "%"
		args = append(args, needle)
		param := len(args)
		query += fmt.Sprintf(` AND (
			LOWER(REPLACE(COALESCE(c.name, ''), 'ё', 'е')) LIKE $%d OR
			LOWER(REPLACE(COALESCE(c.description, ''), 'ё', 'е')) LIKE $%d OR
			EXISTS (SELECT 1 FROM organizations o WHERE o.id = c.organization_id AND LOWER(REPLACE(o.name, 'ё', 'е')) LIKE $%d) OR
			EXISTS (SELECT 1 FROM directions d WHERE d.id = c.direction_id AND LOWER(REPLACE(d.name, 'ё', 'е')) LIKE $%d)
		)`, param, param, param, param)
	}
	whereAt := strings.Index(query, "WHERE c.status")
	countQuery := "SELECT COUNT(*) FROM cards c " + query[whereAt:]
	countArgs := append([]any(nil), args...)
	switch {
	case f.Sort != nil && *f.Sort == "near" && distanceExpr != "":
		query += " ORDER BY " + distanceExpr + " ASC, c.id DESC"
	case f.Sort != nil && *f.Sort == "rating":
		query += " ORDER BY (SELECT cr.score FROM card_ratings cr WHERE cr.card_id = c.id AND cr.votes_count >= 3) DESC NULLS LAST, c.id DESC"
	case f.Sort != nil && *f.Sort == "free":
		query += " ORDER BY (c.price_from = 0) DESC, c.id DESC"
	case f.Sort != nil && *f.Sort == "updated_week":
		query += " ORDER BY (c.updated_at >= now() - interval '7 days') DESC, c.updated_at DESC, c.id DESC"
	case f.Sort != nil && *f.Sort == "new":
		query += " ORDER BY c.created_at DESC, c.id DESC"
	case (f.Sort == nil || *f.Sort == "relevance") && f.Query != nil:
		args = append(args, normalizeSearch(*f.Query))
		param := len(args)
		query += fmt.Sprintf(" ORDER BY CASE WHEN LOWER(REPLACE(c.name, 'ё', 'е')) = $%d THEN 0 WHEN LOWER(REPLACE(c.name, 'ё', 'е')) LIKE $%d || '%%' THEN 1 ELSE 2 END, c.created_at DESC", param, param)
	default:
		query += " ORDER BY c.created_at DESC, c.id DESC"
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

func haversineSQL(latParam, lonParam int) string {
	return fmt.Sprintf(`6371000 * 2 * ASIN(SQRT(LEAST(1.0,
		POWER(SIN(RADIANS(c.latitude - $%d) / 2), 2) +
		COS(RADIANS($%d)) * COS(RADIANS(c.latitude)) * POWER(SIN(RADIANS(c.longitude - $%d) / 2), 2)
	)))`, latParam, latParam, lonParam)
}

func (r *Repository) Ping(ctx context.Context) error {
	if err := r.db.PingContext(ctx); err != nil {
		return fmt.Errorf("ошибка проверки подключения к БД: %w", err)
	}
	return nil
}
