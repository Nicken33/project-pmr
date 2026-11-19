package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"talentro/internal/models"
)

var (
	ErrFavoriteExists = errors.New("карточка уже в избранном")
	ErrCardNotFound   = errors.New("опубликованная карточка не найдена")
	ErrCardNotPending = errors.New("карточка не ожидает модерации")
)

func (r *Repository) AddFavorite(userID, activityID int64) error {
	var inserted int64

	err := r.db.QueryRow(`
		INSERT INTO favorites (user_id, activity_id)
		SELECT $1, a.id
		FROM activities a
		WHERE a.id = $2 AND a.status = 'published' AND a.is_active = true
		ON CONFLICT (user_id, activity_id) DO NOTHING
		RETURNING activity_id`,
		userID, activityID,
	).Scan(&inserted)

	if err == nil {
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23503" {
			return ErrCardNotFound
		}
		return fmt.Errorf("добавление избранного: %w", err)
	}

	var exists bool
	err = r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM activities
			WHERE id = $1 AND status = 'published' AND is_active = true
		)`,
		activityID,
	).Scan(&exists)
	if err != nil {
		return fmt.Errorf("проверка занятия: %w", err)
	}
	if !exists {
		return ErrCardNotFound
	}
	return ErrFavoriteExists
}

func (r *Repository) RemoveFavorite(userID, activityID int64) error {
	result, err := r.db.Exec(`
		DELETE FROM favorites
		WHERE user_id = $1 AND activity_id = $2`,
		userID, activityID,
	)
	if err != nil {
		return fmt.Errorf("удаление избранного: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("проверка удаления избранного: %w", err)
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repository) ListFavorites(userID int64, page, limit int) (models.CardSearchResult, error) {
	filter := models.ActivityFilter{
		FavoriteUserID: &userID,
		Page:           page,
		Limit:          limit,
	}
	return r.SearchCards(filter)
}

func (r *Repository) SaveVote(userID, activityID int64, value *int) (models.VoteResult, error) {
	if value != nil && *value != -1 && *value != 1 {
		return models.VoteResult{}, fmt.Errorf("голос должен быть -1 или 1")
	}

	tx, err := r.db.Begin()
	if err != nil {
		return models.VoteResult{}, err
	}
	defer tx.Rollback()

	var id int64
	err = tx.QueryRow(`
		SELECT id FROM activities
		WHERE id = $1 AND status = 'published' AND is_active = true
		FOR UPDATE`, activityID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return models.VoteResult{}, ErrCardNotFound
	}
	if err != nil {
		return models.VoteResult{}, fmt.Errorf("проверка занятия: %w", err)
	}

	if value == nil {
		_, err := tx.Exec(`
			DELETE FROM activity_votes
			WHERE user_id = $1 AND activity_id = $2`,
			userID, activityID,
		)
		if err != nil {
			return models.VoteResult{}, fmt.Errorf("отзыв голоса: %w", err)
		}
	} else {
		_, err := tx.Exec(`
			INSERT INTO activity_votes (user_id, activity_id, value)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, activity_id)
			DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
			userID, activityID, *value,
		)
		if err != nil {
			return models.VoteResult{}, fmt.Errorf("сохранение голоса: %w", err)
		}
	}

	var result models.VoteResult
	err = tx.QueryRow(`
		SELECT COUNT(*) FILTER (WHERE value = 1), COUNT(*) FILTER (WHERE value = -1)
		FROM activity_votes WHERE activity_id = $1`, activityID).Scan(&result.Plus, &result.Minus)
	if err != nil {
		return models.VoteResult{}, fmt.Errorf("чтение счётчиков голосов: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return models.VoteResult{}, err
	}
	return result, nil
}

func (r *Repository) ModerationQueue(status string) ([]models.ModerationCard, error) {
	rows, err := r.db.Query(`
		SELECT a.id, a.slug, a.name, a.status, a.rejection_reason,
			photo.id, photo.path, photo.caption, photo.sort_order
		FROM activities a
		LEFT JOIN LATERAL (
			SELECT m.id, m.path, m.caption, m.sort_order
			FROM media m
			WHERE m.media_type = 'photo'
			  AND (
				m.activity_id = a.id OR
				m.location_id IN (
					SELECT ag.location_id
					FROM age_groups ag
					WHERE ag.activity_id = a.id
				)
			  )
			ORDER BY m.sort_order, m.id
			LIMIT 1
		) photo ON true
		WHERE a.status = $1
		ORDER BY a.created_at ASC`,
		status,
	)
	if err != nil {
		return nil, fmt.Errorf("получение очереди модерации: %w", err)
	}
	defer rows.Close()

	items := make([]models.ModerationCard, 0)
	for rows.Next() {
		var item models.ModerationCard
		var photoID sql.NullInt64
		var photoPath, photoCaption sql.NullString
		var photoPosition sql.NullInt64
		if err := rows.Scan(
			&item.ID, &item.Slug, &item.Name, &item.Status, &item.RejectionReason,
			&photoID, &photoPath, &photoCaption, &photoPosition,
		); err != nil {
			return nil, fmt.Errorf("чтение очереди модерации: %w", err)
		}
		item.Photos = make([]models.CardPhoto, 0, 1)
		if photoID.Valid {
			var altText *string
			if photoCaption.Valid {
				altText = &photoCaption.String
			}
			item.Photos = append(item.Photos, models.CardPhoto{
				ID:       photoID.Int64,
				Path:     photoPath.String,
				AltText:  altText,
				Position: int(photoPosition.Int64),
				IsCover:  true,
			})
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход очереди модерации: %w", err)
	}
	return items, nil
}

func (r *Repository) DecideCard(
	activityID, moderatorID int64,
	decision, comment string,
) (models.ModerationCard, error) {
	if decision != "approved" && decision != "rejected" {
		return models.ModerationCard{}, fmt.Errorf("недопустимое решение модерации")
	}

	status := "published"
	logDecision := "published"
	var rejectionReason any
	var auditComment any

	if decision == "rejected" {
		status = "rejected"
		logDecision = "rejected"
		rejectionReason = comment
		auditComment = comment
	}

	tx, err := r.db.Begin()
	if err != nil {
		return models.ModerationCard{}, fmt.Errorf("начало транзакции модерации: %w", err)
	}
	defer tx.Rollback()

	var currentStatus string
	err = tx.QueryRow(`
		SELECT status
		FROM activities
		WHERE id = $1
		FOR UPDATE`,
		activityID,
	).Scan(&currentStatus)

	if errors.Is(err, sql.ErrNoRows) {
		return models.ModerationCard{}, ErrCardNotFound
	}
	if err != nil {
		return models.ModerationCard{}, fmt.Errorf("чтение занятия для модерации: %w", err)
	}
	if currentStatus != "pending" {
		return models.ModerationCard{}, ErrCardNotPending
	}

	var item models.ModerationCard
	item.Photos = []models.CardPhoto{}
	err = tx.QueryRow(`
		UPDATE activities
		SET status = $2, rejection_reason = $3
		WHERE id = $1
		RETURNING id, slug, name, status, rejection_reason`,
		activityID, status, rejectionReason,
	).Scan(&item.ID, &item.Slug, &item.Name, &item.Status, &item.RejectionReason)
	if err != nil {
		return models.ModerationCard{}, fmt.Errorf("обновление занятия: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO moderation_log (activity_id, moderator_id, decision, comment)
		VALUES ($1, $2, $3, $4)`,
		activityID, moderatorID, logDecision, auditComment,
	)
	if err != nil {
		return models.ModerationCard{}, fmt.Errorf("запись решения модерации: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return models.ModerationCard{}, fmt.Errorf("сохранение решения модератора: %w", err)
	}
	return item, nil
}
