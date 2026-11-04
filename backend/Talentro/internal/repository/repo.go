package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"talentro/internal/config"
	"talentro/internal/models"
	"time"

	// Именованный импорт заодно регистрирует драйвер "postgres".
	"github.com/lib/pq"
)

// ErrNotFound — карточка существует с другим status либо отсутствует вовсе.
// Handler обязан отдать 404, а не пустой объект: иначе фронт нарисует
// «занятие без названия» вместо честной ошибки.
var ErrNotFound = errors.New("карточка не найдена")

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

// cardColumns — один список для списка и для детали: расхождение полей между
// /api/cards и /api/cards/{id} фронт ловил бы как «в каталоге цена есть, на
// странице занятия — нет».
const cardColumns = `
	c.id, c.name, c.organization_id, c.city_id, ci.name, c.district,
	c.age_from, c.age_to, c.link, c.description, c.price, c.category,
	COALESCE(cat.slug, ''), COALESCE(sup.slug, ''),
	COALESCE(o.slug, ''), COALESCE(o.name, '')`

const cardJoins = `
	FROM cards c
	JOIN cities ci ON ci.id = c.city_id
	LEFT JOIN organizations o ON o.id = c.organization_id
	LEFT JOIN categories cat ON cat.id = c.direction_id
	LEFT JOIN supercategories sup ON sup.slug = cat.super_slug`

func scanCard(scan func(dest ...any) error) (models.Card, error) {
	var (
		c         models.Card
		cityID    int
		district  sql.NullString
		link      sql.NullString
		desc      sql.NullString
		price     sql.NullFloat64
		category  sql.NullString
		catSlug   string
		superSlug string
		orgSlug   string
		orgName   string
	)
	if err := scan(&c.ID, &c.Name, &c.OrganizationID, &cityID, &c.City, &district,
		&c.Age.MinAge, &c.Age.MaxAge, &link, &desc, &price, &category,
		&catSlug, &superSlug, &orgSlug, &orgName); err != nil {
		return models.Card{}, err
	}

	c.Locations = []models.Location{}
	c.Photos = []models.Photo{}
	if link.Valid {
		c.Link = &link.String
	}
	if desc.Valid {
		c.Description = &desc.String
	}
	if district.Valid {
		c.District = &district.String
	}
	if price.Valid {
		c.Price = &price.Float64
	}
	if category.Valid {
		c.Category = &category.String
	}
	if catSlug != "" {
		c.CategorySlug = &catSlug
	}
	if superSlug != "" {
		c.SuperSlug = &superSlug
	}
	if orgSlug != "" {
		c.Organization = &models.CardOrg{ID: c.OrganizationID, Slug: orgSlug, Name: orgName}
	}
	return c, nil
}

func (r *Repository) SearchCards(f models.CardFilter) ([]models.Card, error) {
	query := `SELECT` + cardColumns + cardJoins + `
		WHERE c.status = 'published'`

	args := []any{}

	if f.CityName != nil {
		args = append(args, *f.CityName)
		query += fmt.Sprintf(" AND ci.name ILIKE $%d", len(args))
	}
	if f.CityID != nil {
		args = append(args, *f.CityID)
		query += fmt.Sprintf(" AND c.city_id = $%d", len(args))
	}
	if f.DirectionID != nil {
		args = append(args, *f.DirectionID)
		query += fmt.Sprintf(" AND c.direction_id = $%d", len(args))
	}
	if f.Age != nil {
		args = append(args, *f.Age)
		query += fmt.Sprintf(" AND (c.age_from IS NULL OR c.age_from <= $%d)", len(args))
		query += fmt.Sprintf(" AND (c.age_to IS NULL OR c.age_to >= $%d)", len(args))
	}
	if f.PriceMax != nil {
		args = append(args, *f.PriceMax)
		// Анкета без цены в фильтр не попадает: «не указано» — не «дёшево».
		query += fmt.Sprintf(" AND c.price IS NOT NULL AND c.price <= $%d", len(args))
	}
	if f.Search != nil {
		args = append(args, "%"+*f.Search+"%")
		query += fmt.Sprintf(" AND (c.name ILIKE $%d OR COALESCE(c.description, '') ILIKE $%d)", len(args), len(args))
	}
	query += " ORDER BY c.id DESC"

	log.Println("query:", query, "args:", args)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("ошибка при выполнении запроса: %w", err)
	}
	defer rows.Close()

	cards := make([]models.Card, 0)
	for rows.Next() {
		c, err := scanCard(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("ошибка чтения строки: %w", err)
		}
		cards = append(cards, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ошибка при обходе строк: %w", err)
	}

	if err := r.attachMedia(cards); err != nil {
		return nil, err
	}
	return cards, nil
}

func (r *Repository) GetCardByID(id int64) (models.Card, error) {
	query := `SELECT` + cardColumns + cardJoins + `
		WHERE c.id = $1 AND c.status = 'published'`

	row := r.db.QueryRow(query, id)
	c, err := scanCard(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return models.Card{}, ErrNotFound
	}
	if err != nil {
		return models.Card{}, fmt.Errorf("ошибка чтения карточки: %w", err)
	}

	cards := []models.Card{c}
	if err := r.attachMedia(cards); err != nil {
		return models.Card{}, err
	}
	return cards[0], nil
}

// attachMedia одним запросом на точки и одним на иллюстрации: JOIN в основном
// запросе размножил бы строки карточек (анкет с двумя точками — дважды).
func (r *Repository) attachMedia(cards []models.Card) error {
	if len(cards) == 0 {
		return nil
	}

	ids := make([]int64, 0, len(cards))
	for _, c := range cards {
		ids = append(ids, c.ID)
	}

	locations, err := r.loadLocations(ids)
	if err != nil {
		return err
	}
	photos, err := r.loadPhotos(ids)
	if err != nil {
		return err
	}

	for i := range cards {
		if ls, ok := locations[cards[i].ID]; ok {
			cards[i].Locations = ls
		}
		if ps, ok := photos[cards[i].ID]; ok {
			cards[i].Photos = ps
		}
	}
	return nil
}

func (r *Repository) loadLocations(ids []int64) (map[int64][]models.Location, error) {
	rows, err := r.db.Query(`
		SELECT id, card_id, name, address, district, lat, lng
		FROM card_locations
		WHERE card_id = ANY($1)
		ORDER BY card_id, id`, pq.Int64Array(ids))
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения точек проведения: %w", err)
	}
	defer rows.Close()

	out := make(map[int64][]models.Location)
	for rows.Next() {
		var (
			l        models.Location
			address  sql.NullString
			district sql.NullString
		)
		if err := rows.Scan(&l.ID, &l.CardID, &l.Name, &address, &district, &l.Lat, &l.Lng); err != nil {
			return nil, fmt.Errorf("ошибка чтения точки проведения: %w", err)
		}
		if address.Valid {
			l.Address = &address.String
		}
		if district.Valid {
			l.District = &district.String
		}
		out[l.CardID] = append(out[l.CardID], l)
	}
	return out, rows.Err()
}

func (r *Repository) loadPhotos(ids []int64) (map[int64][]models.Photo, error) {
	rows, err := r.db.Query(`
		SELECT card_id, url, alt
		FROM card_photos
		WHERE card_id = ANY($1)
		ORDER BY card_id, order_num, id`, pq.Int64Array(ids))
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения иллюстраций: %w", err)
	}
	defer rows.Close()

	out := make(map[int64][]models.Photo)
	for rows.Next() {
		var (
			cardID int64
			p      models.Photo
			alt    sql.NullString
		)
		if err := rows.Scan(&cardID, &p.URL, &alt); err != nil {
			return nil, fmt.Errorf("ошибка чтения иллюстрации: %w", err)
		}
		if alt.Valid {
			p.Alt = &alt.String
		}
		out[cardID] = append(out[cardID], p)
	}
	return out, rows.Err()
}

func (r *Repository) Dictionaries() (models.Dictionaries, error) {
	out := models.Dictionaries{
		SuperCategories: []models.SuperCategory{},
		Categories:      []models.Category{},
	}

	rows, err := r.db.Query(`
		SELECT slug, title, short_title, order_num
		FROM supercategories
		ORDER BY order_num, slug`)
	if err != nil {
		return out, fmt.Errorf("ошибка чтения направлений: %w", err)
	}
	for rows.Next() {
		var s models.SuperCategory
		if err := rows.Scan(&s.Slug, &s.Title, &s.ShortTitle, &s.Order); err != nil {
			rows.Close()
			return out, fmt.Errorf("ошибка чтения направления: %w", err)
		}
		out.SuperCategories = append(out.SuperCategories, s)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, fmt.Errorf("ошибка при обходе направлений: %w", err)
	}

	rows, err = r.db.Query(`
		SELECT slug, title, super_slug, kind, order_num
		FROM categories
		ORDER BY super_slug, order_num, slug`)
	if err != nil {
		return out, fmt.Errorf("ошибка чтения категорий: %w", err)
	}
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.Slug, &c.Title, &c.SuperSlug, &c.Kind, &c.Order); err != nil {
			rows.Close()
			return out, fmt.Errorf("ошибка чтения категории: %w", err)
		}
		out.Categories = append(out.Categories, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return out, fmt.Errorf("ошибка при обходе категорий: %w", err)
	}

	return out, nil
}

func (r *Repository) Cities() ([]models.City, error) {
	rows, err := r.db.Query(`
		SELECT ci.id, ci.name,
		       COALESCE(array_agg(DISTINCT c.district) FILTER (WHERE c.district IS NOT NULL), '{}'::text[])
		FROM cities ci
		LEFT JOIN cards c ON c.city_id = ci.id AND c.status = 'published'
		GROUP BY ci.id, ci.name
		ORDER BY ci.order_num, ci.name`)
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения городов: %w", err)
	}
	defer rows.Close()

	out := make([]models.City, 0)
	for rows.Next() {
		var (
			c         models.City
			districts []string
		)
		if err := rows.Scan(&c.ID, &c.Name, pq.Array(&districts)); err != nil {
			return nil, fmt.Errorf("ошибка чтения города: %w", err)
		}
		c.Districts = districts
		if c.Districts == nil {
			c.Districts = []string{}
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repository) Ping(ctx context.Context) error {
	if err := r.db.PingContext(ctx); err != nil {
		return fmt.Errorf("ошибка проверки подключения к БД: %w", err)
	}
	return nil
}
