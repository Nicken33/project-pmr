package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"talentro/internal/models"
)

var (
	ErrActivityNotReviewable   = errors.New("секция не найдена или не опубликована")
	ErrReviewAlreadyExists     = errors.New("пользователь уже оставил отзыв")
	ErrCannotReviewOwnActivity = errors.New("нельзя оставлять отзыв на свою секцию")
)

func (r *Repository) ListActivityReviews(
	activityID int64,
	page, limit int,
) (models.ReviewList, error) {
	var available bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM activities
			WHERE id = $1 AND status = 'published' AND is_active = true
		)`,
		activityID,
	).Scan(&available)
	if err != nil {
		return models.ReviewList{}, fmt.Errorf("проверка секции для отзывов: %w", err)
	}
	if !available {
		return models.ReviewList{}, ErrActivityNotReviewable
	}

	var total int
	err = r.db.QueryRow(`
		SELECT COUNT(*)
		FROM reviews
		WHERE activity_id = $1 AND status = 'published'`,
		activityID,
	).Scan(&total)
	if err != nil {
		return models.ReviewList{}, fmt.Errorf("подсчёт отзывов: %w", err)
	}

	offset := (page - 1) * limit
	rows, err := r.db.Query(`
		SELECT r.id, r.activity_id, r.author_id, u.name, r.text, r.created_at
		FROM reviews r
		JOIN users u ON u.id = r.author_id
		WHERE r.activity_id = $1 AND r.status = 'published'
		ORDER BY r.created_at DESC, r.id DESC
		LIMIT $2 OFFSET $3`,
		activityID, limit, offset,
	)
	if err != nil {
		return models.ReviewList{}, fmt.Errorf("получение отзывов: %w", err)
	}
	defer rows.Close()

	result := models.ReviewList{
		Items: make([]models.Review, 0),
		Total: total,
		Page:  page,
		Limit: limit,
	}

	for rows.Next() {
		var review models.Review
		if err := rows.Scan(
			&review.ID,
			&review.ActivityID,
			&review.AuthorID,
			&review.AuthorName,
			&review.Text,
			&review.CreatedAt,
		); err != nil {
			return models.ReviewList{}, fmt.Errorf("чтение отзыва: %w", err)
		}
		result.Items = append(result.Items, review)
	}
	if err := rows.Err(); err != nil {
		return models.ReviewList{}, fmt.Errorf("обход отзывов: %w", err)
	}

	return result, nil
}

func (r *Repository) CreateActivityReview(
	authorID, activityID int64,
	text string,
) (models.Review, error) {
	var review models.Review
	var ownsActivity bool
	var err error
	err = r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM activities a
			LEFT JOIN organizations o ON o.id = a.organization_id
			WHERE a.id = $1
			  AND (a.owner_id = $2 OR o.owner_id = $2)
		)`,
		activityID,
		authorID,
	).Scan(&ownsActivity)
	if err != nil {
		return models.Review{}, fmt.Errorf("проверка владельца секции: %w", err)
	}
	if ownsActivity {
		return models.Review{}, ErrCannotReviewOwnActivity
	}
	err = r.db.QueryRow(`
		WITH inserted AS (
			INSERT INTO reviews (activity_id, author_id, text)
			SELECT a.id, $2, $3
			FROM activities a
			WHERE a.id = $1 AND a.status = 'published' AND a.is_active = true
			AND (a.owner_id IS NULL OR a.owner_id <> $2)
			AND NOT EXISTS (
				SELECT 1
				FROM organizations o
				WHERE o.id = a.organization_id AND o.owner_id = $2
			)
			RETURNING id, activity_id, author_id, text, created_at
		)
		SELECT i.id, i.activity_id, i.author_id, u.name, i.text, i.created_at
		FROM inserted i
		JOIN users u ON u.id = i.author_id`,
		activityID, authorID, text,
	).Scan(
		&review.ID,
		&review.ActivityID,
		&review.AuthorID,
		&review.AuthorName,
		&review.Text,
		&review.CreatedAt,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return models.Review{}, ErrActivityNotReviewable
	}
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) &&
			pqErr.Code == "23505" &&
			pqErr.Constraint == "reviews_author_activity_unique" {
			return models.Review{}, ErrReviewAlreadyExists
		}
		return models.Review{}, fmt.Errorf("создание отзыва: %w", err)
	}

	return review, nil
}
