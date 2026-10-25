package repository

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"talentro/internal/models"

	_ "github.com/lib/pq"
)

type Repository struct {
	db *sql.DB
}

func New(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func NewDB() *sql.DB {
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		log.Fatal("не задана переменная DATABASE_URL")
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Ошибка при создании соединения с БД: %v", err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatalf("Не удалось достучаться до базы данных: %v", err)
	}

	log.Println("успешное подключение к базе данных main_db!")

	return db
}

func (r *Repository) GetSections() ([]models.Section, error) {
	query := `
		SELECT name, price_from, description
		FROM cards
		WHERE status = 'published'
	`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("Ошибка при выполнении запроса: %w", err)
	}
	defer rows.Close()

	sections := make([]models.Section, 0)

	for rows.Next() {
		var s models.Section

		if err := rows.Scan(&s.Name, &s.Price, &s.Description); err != nil {
			return nil, fmt.Errorf("Ошибка чтения строки %w", err)
		}
		sections = append(sections, s)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("Ошибка при обходе строк: %w", err)
	}

	return sections, nil
}
