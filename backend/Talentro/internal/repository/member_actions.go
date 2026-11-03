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

func (r *Repository) AddFavorite(userID, cardID int64) error {
	var inserted int64
	err := r.db.QueryRow(`
		INSERT INTO favorites (user_id, card_id)
		SELECT $1, c.id FROM cards c WHERE c.id = $2 AND c.status = 'published' AND c.is_active = true
		ON CONFLICT (user_id, card_id) DO NOTHING
		RETURNING card_id`, userID, cardID).Scan(&inserted)
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
	if err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM cards WHERE id = $1 AND status = 'published' AND is_active = true)`, cardID).Scan(&exists); err != nil {
		return fmt.Errorf("проверка карточки: %w", err)
	}
	if !exists {
		return ErrCardNotFound
	}
	return ErrFavoriteExists
}

func (r *Repository) ModerationQueue(status string) ([]models.ModerationCard, error) {
	rows, err := r.db.Query(`
		SELECT id, slug, name, status, rejection_reason
		FROM cards WHERE status = $1 ORDER BY created_at ASC`, status)
	if err != nil {
		return nil, fmt.Errorf("получение очереди модерации: %w", err)
	}
	defer rows.Close()
	items := make([]models.ModerationCard, 0)
	for rows.Next() {
		var item models.ModerationCard
		if err := rows.Scan(&item.ID, &item.Slug, &item.Name, &item.Status, &item.RejectionReason); err != nil {
			return nil, fmt.Errorf("чтение очереди модерации: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) DecideCard(cardID, moderatorID int64, decision, comment string) (models.ModerationCard, error) {
	if decision != "approved" && decision != "rejected" {
		return models.ModerationCard{}, fmt.Errorf("недопустимое решение модерации")
	}
	status := "published"
	var rejectionReason any
	var auditComment any
	if decision == "rejected" {
		status = "rejected"
		rejectionReason = comment
		auditComment = comment
	}
	tx, err := r.db.Begin()
	if err != nil {
		return models.ModerationCard{}, fmt.Errorf("начало транзакции модерации: %w", err)
	}
	defer tx.Rollback()
	var currentStatus string
	err = tx.QueryRow(`SELECT status FROM cards WHERE id = $1 FOR UPDATE`, cardID).Scan(&currentStatus)
	if errors.Is(err, sql.ErrNoRows) {
		return models.ModerationCard{}, ErrCardNotFound
	}
	if err != nil {
		return models.ModerationCard{}, fmt.Errorf("чтение карточки для модерации: %w", err)
	}
	if currentStatus != "pending" {
		return models.ModerationCard{}, ErrCardNotPending
	}
	var item models.ModerationCard
	err = tx.QueryRow(`
		UPDATE cards SET status = $2, rejection_reason = $3
		WHERE id = $1
		RETURNING id, slug, name, status, rejection_reason`, cardID, status, rejectionReason).
		Scan(&item.ID, &item.Slug, &item.Name, &item.Status, &item.RejectionReason)
	if err != nil {
		return models.ModerationCard{}, fmt.Errorf("обновление карточки: %w", err)
	}
	_, err = tx.Exec(`INSERT INTO moderation_log (card_id, moderator_id, decision, comment) VALUES ($1, $2, $3, $4)`, cardID, moderatorID, decision, auditComment)
	if err != nil {
		return models.ModerationCard{}, fmt.Errorf("запись решения модерации: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return models.ModerationCard{}, fmt.Errorf("сохранение решения модерации: %w", err)
	}
	return item, nil
}

func (r *Repository) RemoveFavorite(userID, cardID int64) error {
	result, err := r.db.Exec(`DELETE FROM favorites WHERE user_id = $1 AND card_id = $2`, userID, cardID)
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
	f := models.ActivityFilter{FavoriteUserID: &userID, Page: page, Limit: limit}
	return r.SearchCards(f)
}

func (r *Repository) SaveVote(userID, cardID int64, value *int) (models.VoteResult, error) {
	var exists bool
	if err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM cards WHERE id = $1 AND status = 'published' AND is_active = true)`, cardID).Scan(&exists); err != nil {
		return models.VoteResult{}, fmt.Errorf("проверка карточки: %w", err)
	}
	if !exists {
		return models.VoteResult{}, ErrCardNotFound
	}
	if value == nil {
		_, err := r.db.Exec(`DELETE FROM votes WHERE user_id = $1 AND card_id = $2`, userID, cardID)
		if err != nil {
			return models.VoteResult{}, fmt.Errorf("отзыв голоса: %w", err)
		}
	} else {
		_, err := r.db.Exec(`
			INSERT INTO votes (user_id, card_id, value) VALUES ($1, $2, $3)
			ON CONFLICT (user_id, card_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, userID, cardID, *value)
		if err != nil {
			return models.VoteResult{}, fmt.Errorf("сохранение голоса: %w", err)
		}
	}
	var result models.VoteResult
	err := r.db.QueryRow(`
		SELECT COALESCE((SELECT likes FROM card_ratings WHERE card_id = $1), 0),
		       COALESCE((SELECT dislikes FROM card_ratings WHERE card_id = $1), 0)`, cardID).
		Scan(&result.Plus, &result.Minus)
	if err != nil {
		return models.VoteResult{}, fmt.Errorf("чтение счётчиков голосов: %w", err)
	}
	return result, nil
}
