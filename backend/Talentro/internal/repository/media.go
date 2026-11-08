package repository

import (
	"fmt"

	"talentro/internal/models"
)

// AddOwnedActivityPhoto привязывает фотографию к своей секции.
// path — относительный путь внутри MEDIA_DIR, не имя файла из запроса.
func (r *Repository) AddOwnedActivityPhoto(
	ownerID int64,
	activityID int64,
	path string,
	caption *string,
	sourceURL *string,
	license *string,
) (models.CardPhoto, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.CardPhoto{}, err
	}
	defer tx.Rollback()

	var status string
	err = tx.QueryRow(`
		SELECT status
		FROM activities
		WHERE id = $1 AND owner_id = $2
		FOR UPDATE`,
		activityID,
		ownerID,
	).Scan(&status)
	if err != nil {
		return models.CardPhoto{}, err
	}

	// Изменение опубликованной секции возвращает её на модерацию.
	if status == "published" {
		_, err = tx.Exec(`
			UPDATE activities
			SET status = 'pending', rejection_reason = NULL
			WHERE id = $1`,
			activityID,
		)
		if err != nil {
			return models.CardPhoto{}, fmt.Errorf("обновление статуса секции: %w", err)
		}
	} else if status == "rejected" {
		_, err = tx.Exec(`
			UPDATE activities
			SET status = 'draft', rejection_reason = NULL
			WHERE id = $1`,
			activityID,
		)
		if err != nil {
			return models.CardPhoto{}, fmt.Errorf("обновление статуса секции: %w", err)
		}
	}

	var position int
	err = tx.QueryRow(`
		SELECT COALESCE(MAX(sort_order) + 1, 0)
		FROM media
		WHERE activity_id = $1`,
		activityID,
	).Scan(&position)
	if err != nil {
		return models.CardPhoto{}, fmt.Errorf("определение порядка фотографии: %w", err)
	}

	var photo models.CardPhoto
	err = tx.QueryRow(`
		INSERT INTO media (
			activity_id, media_type, path, sort_order, caption, source_url, license
		)
		VALUES ($1, 'photo', $2, $3, $4, $5, $6)
		RETURNING id, path, caption, sort_order`,
		activityID,
		path,
		position,
		caption,
		sourceURL,
		license,
	).Scan(&photo.ID, &photo.Path, &photo.AltText, &photo.Position)
	if err != nil {
		return models.CardPhoto{}, fmt.Errorf("сохранение фотографии: %w", err)
	}

	photo.IsCover = position == 0

	if err := tx.Commit(); err != nil {
		return models.CardPhoto{}, fmt.Errorf("завершение сохранения фотографии: %w", err)
	}

	return photo, nil
}

func (r *Repository) AddOwnedActivityVideo(
	ownerID int64,
	activityID int64,
	path string,
) (models.CardVideo, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.CardVideo{}, err
	}
	defer tx.Rollback()

	var status string
	err = tx.QueryRow(`
		SELECT status
		FROM activities
		WHERE id = $1 AND owner_id = $2
		FOR UPDATE`,
		activityID,
		ownerID,
	).Scan(&status)
	if err != nil {
		return models.CardVideo{}, err
	}

	if status == "published" {
		_, err = tx.Exec(`
			UPDATE activities
			SET status = 'pending', rejection_reason = NULL
			WHERE id = $1`,
			activityID,
		)
		if err != nil {
			return models.CardVideo{}, fmt.Errorf("обновление статуса секции: %w", err)
		}
	} else if status == "rejected" {
		_, err = tx.Exec(`
			UPDATE activities
			SET status = 'draft', rejection_reason = NULL
			WHERE id = $1`,
			activityID,
		)
		if err != nil {
			return models.CardVideo{}, fmt.Errorf("обновление статуса секции: %w", err)
		}
	}

	var position int
	err = tx.QueryRow(`
		SELECT COALESCE(MAX(sort_order) + 1, 0)
		FROM media
		WHERE activity_id = $1`,
		activityID,
	).Scan(&position)
	if err != nil {
		return models.CardVideo{}, fmt.Errorf("определение порядка видео: %w", err)
	}

	var video models.CardVideo
	err = tx.QueryRow(`
		INSERT INTO media (activity_id, media_type, path, sort_order)
		VALUES ($1, 'video', $2, $3)
		RETURNING id, path, sort_order`,
		activityID,
		path,
		position,
	).Scan(&video.ID, &video.Path, &video.Position)
	if err != nil {
		return models.CardVideo{}, fmt.Errorf("сохранение видео в базе: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return models.CardVideo{}, fmt.Errorf("завершение сохранения видео: %w", err)
	}

	return video, nil
}

func (r *Repository) DeleteOwnedActivityMedia(
	ownerID int64,
	activityID int64,
	mediaID int64,
) (string, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	var path string
	var status string

	err = tx.QueryRow(`
		SELECT m.path, a.status
		FROM media m
		JOIN activities a ON a.id = m.activity_id
		WHERE m.id = $1
		  AND m.activity_id = $2
		  AND a.owner_id = $3
		FOR UPDATE OF m, a`,
		mediaID,
		activityID,
		ownerID,
	).Scan(&path, &status)
	if err != nil {
		return "", err
	}

	if status == "published" {
		_, err = tx.Exec(`
			UPDATE activities
			SET status = 'pending', rejection_reason = NULL
			WHERE id = $1`,
			activityID,
		)
	} else if status == "rejected" {
		_, err = tx.Exec(`
			UPDATE activities
			SET status = 'draft', rejection_reason = NULL
			WHERE id = $1`,
			activityID,
		)
	}
	if err != nil {
		return "", fmt.Errorf("обновление статуса секции: %w", err)
	}

	_, err = tx.Exec(`
		DELETE FROM media
		WHERE id = $1 AND activity_id = $2`,
		mediaID,
		activityID,
	)
	if err != nil {
		return "", fmt.Errorf("удаление медиа из базы: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("завершение удаления медиа: %w", err)
	}

	return path, nil
}
