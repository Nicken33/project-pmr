package repository

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"talentro/internal/config"
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

// nullText превращает sql.NullString в *string: §7.4 требует публиковать пустое
// поле как null, а не как пустую строку.
func nullText(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	return &s.String
}

func (r *Repository) Ping(ctx context.Context) error {
	if err := r.db.PingContext(ctx); err != nil {
		return fmt.Errorf("ошибка проверки подключения к БД: %w", err)
	}
	return nil
}
