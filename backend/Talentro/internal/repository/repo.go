package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"talentro/internal/config"
	"talentro/internal/models"
	"time"

	_ "github.com/lib/pq"
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

func (r *Repository) SearchCards(f models.CardFilter) ([]models.Card, error) {
	query := `
		SELECT c.id, c.name, ci.name, c.age_from, c.age_to
		FROM cards c
		JOIN cities ci on ci.id = c.city_id
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
	/*if f.DirectionID != nil {
		args = append(args, *f.DirectionID)
		query += fmt.Sprintf(" AND c.direction_id = $%d", len(args))
	}*/
	if f.Age != nil {
		args = append(args, *f.Age)
		query += fmt.Sprintf(" AND (c.age_from IS NULL OR c.age_from <= $%d)", len(args))
		query += fmt.Sprintf(" AND (c.age_to IS NULL OR c.age_to >= $%d)", len(args))
	}
	/*if f.PriceMax != nil {
		args = append(args, *f.PriceMax)
		query += fmt.Sprintf(" AND c.price_from <= $%d", len(args))
	}
	if f.Search != nil {
		args = append(args, "%"+*f.Search+"%")
		query += fmt.Sprintf(" AND c.name ILIKE $%d", len(args))
	}*/
	query += " ORDER BY c.id DESC"

	log.Println("query:", query, "args:", args)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("ошибка при выполнении запроса: %w", err)
	}
	defer rows.Close()

	sections := make([]models.Card, 0)
	for rows.Next() {
		var s models.Card
		if err := rows.Scan(&s.ID, &s.Name, &s.City, &s.Age.MinAge, &s.Age.MaxAge); err != nil {
			return nil, fmt.Errorf("ошибка чтения строки: %w", err)
		}
		sections = append(sections, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("ошибка при обходе строк: %w", err)
	}
	return sections, nil
}

func (r *Repository) Ping(ctx context.Context) error {
	if err := r.db.PingContext(ctx); err != nil {
		return fmt.Errorf("ошибка проверки подключения к БД: %w", err)
	}
	return nil
}
