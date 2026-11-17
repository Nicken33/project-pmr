package repository

import (
	"errors"
	"talentro/internal/models"
)

var ErrReviewMediaLimit = errors.New("к отзыву можно прикрепить до пяти фото и одного видео")

func (r *Repository) CanUploadReviewMedia(authorID, reviewID int64) error {
	var id int64
	return r.db.QueryRow(`SELECT v.id FROM reviews v JOIN activities a ON a.id=v.activity_id
 WHERE v.id=$1 AND v.author_id=$2 AND v.status='published' AND a.status='published' AND a.is_active=true`, reviewID, authorID).Scan(&id)
}

func (r *Repository) AddReviewMedia(authorID, reviewID int64, kind, path string, caption *string) (models.ReviewMedia, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.ReviewMedia{}, err
	}
	defer tx.Rollback()
	var id int64
	err = tx.QueryRow(`SELECT v.id FROM reviews v JOIN activities a ON a.id=v.activity_id
 WHERE v.id=$1 AND v.author_id=$2 AND v.status='published' AND a.status='published' AND a.is_active=true FOR UPDATE OF v`, reviewID, authorID).Scan(&id)
	if err != nil {
		return models.ReviewMedia{}, err
	}
	var count, position int
	err = tx.QueryRow(`SELECT COUNT(*) FILTER(WHERE media_type=$2),COALESCE(MAX(sort_order)+1,0) FROM media WHERE review_id=$1`, reviewID, kind).Scan(&count, &position)
	if err != nil {
		return models.ReviewMedia{}, err
	}
	max := 5
	if kind == "video" {
		max = 1
	}
	if count >= max {
		return models.ReviewMedia{}, ErrReviewMediaLimit
	}
	x := models.ReviewMedia{MediaType: kind}
	err = tx.QueryRow(`INSERT INTO media(review_id,media_type,path,caption,sort_order) VALUES($1,$2,$3,$4,$5)
 RETURNING id,path,sort_order,caption`, reviewID, kind, path, caption, position).Scan(&x.ID, &x.Path, &x.Position, &x.Caption)
	if err != nil {
		return x, err
	}
	return x, tx.Commit()
}

func (r *Repository) DeleteReviewMedia(authorID, reviewID, mediaID int64) (string, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	var id int64
	if err = tx.QueryRow(`SELECT id FROM reviews WHERE id=$1 AND author_id=$2 FOR UPDATE`, reviewID, authorID).Scan(&id); err != nil {
		return "", err
	}
	var path string
	if err = tx.QueryRow(`DELETE FROM media WHERE id=$1 AND review_id=$2 RETURNING path`, mediaID, reviewID).Scan(&path); err != nil {
		return "", err
	}
	return path, tx.Commit()
}
