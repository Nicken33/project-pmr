package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"
	"talentro/internal/models"
)

var ErrReportExists = errors.New("жалоба уже отправлена и ожидает рассмотрения")
var ErrReportDecided = errors.New("жалоба уже рассмотрена с другим решением")

const reportSelect = `SELECT r.id,r.target_type,r.target_id,r.activity_id,a.slug,a.name,
 r.target_excerpt,COALESCE(u.name,'Удалённый пользователь'),r.reason,r.detail,
 r.status,r.hide_reason,r.created_at,r.updated_at
 FROM reports r JOIN activities a ON a.id=r.activity_id LEFT JOIN users u ON u.id=r.reporter_id `

type reportScanner interface{ Scan(...any) error }

func scanReport(row reportScanner) (models.ContentReport, error) {
	var x models.ContentReport
	err := row.Scan(&x.ID, &x.TargetType, &x.TargetID, &x.ActivityID, &x.ActivitySlug, &x.ActivityTitle,
		&x.Excerpt, &x.ReporterName, &x.Reason, &x.Detail, &x.Status, &x.HideReason, &x.CreatedAt, &x.UpdatedAt)
	return x, err
}

func (r *Repository) CreateReport(userID int64, input models.ReportInput) (models.ContentReport, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.ContentReport{}, err
	}
	defer tx.Rollback()
	var activityID int64
	var reviewID, mediaID sql.NullInt64
	var excerpt string
	switch input.TargetType {
	case "card":
		err = tx.QueryRow(`SELECT id,name FROM activities WHERE id=$1 AND status='published' AND is_active=true FOR SHARE`, input.TargetID).Scan(&activityID, &excerpt)
	case "review":
		err = tx.QueryRow(`SELECT v.activity_id,v.id,v.text FROM reviews v JOIN activities a ON a.id=v.activity_id
   WHERE v.id=$1 AND v.status='published' AND a.status='published' AND a.is_active=true FOR SHARE OF v,a`, input.TargetID).Scan(&activityID, &reviewID, &excerpt)
	case "media":
		err = tx.QueryRow(`SELECT a.id,m.review_id,m.id,m.path FROM media m
   LEFT JOIN reviews v ON v.id=m.review_id JOIN activities a ON a.id=COALESCE(m.activity_id,v.activity_id,
    (SELECT ag.activity_id FROM age_groups ag JOIN activities visible ON visible.id=ag.activity_id WHERE ag.location_id=m.location_id AND visible.status='published' AND visible.is_active=true ORDER BY ag.id LIMIT 1))
   WHERE m.id=$1 AND NOT m.is_hidden AND (m.review_id IS NULL OR v.status='published')
   AND a.status='published' AND a.is_active=true FOR SHARE OF m,a`, input.TargetID).Scan(&activityID, &reviewID, &mediaID, &excerpt)
	default:
		return models.ContentReport{}, fmt.Errorf("неподдерживаемый тип жалобы")
	}
	if err != nil {
		return models.ContentReport{}, err
	}
	var id int64
	err = tx.QueryRow(`INSERT INTO reports(reporter_id,activity_id,review_id,media_id,target_type,target_id,target_excerpt,reason,detail)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, userID, activityID, reviewID, mediaID, input.TargetType, input.TargetID, excerpt, input.Reason, input.Detail).Scan(&id)
	if err != nil {
		var pe *pq.Error
		if errors.As(err, &pe) && pe.Code == "23505" && pe.Constraint == "reports_one_open_per_user_target" {
			return models.ContentReport{}, ErrReportExists
		}
		return models.ContentReport{}, err
	}
	result, err := scanReport(tx.QueryRow(reportSelect+`WHERE r.id=$1`, id))
	if err != nil {
		return result, err
	}
	return result, tx.Commit()
}

func (r *Repository) ListReports(kind, status string, page, limit int) (models.ReportList, error) {
	result := models.ReportList{Items: []models.ContentReport{}, Page: page, Limit: limit}
	where := `WHERE ($1='' OR r.target_type=$1) AND r.status=$2`
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM reports r `+where, kind, status).Scan(&result.Total); err != nil {
		return result, err
	}
	rows, err := r.db.Query(reportSelect+where+` ORDER BY r.created_at,r.id LIMIT $3 OFFSET $4`, kind, status, limit, (page-1)*limit)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		x, err := scanReport(rows)
		if err != nil {
			return result, err
		}
		result.Items = append(result.Items, x)
	}
	return result, rows.Err()
}

func (r *Repository) DecideReport(moderatorID, id int64, action, reason string) (models.ContentReport, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.ContentReport{}, err
	}
	defer tx.Rollback()
	var kind, status string
	var targetID int64
	if err = tx.QueryRow(`SELECT target_type,target_id,status FROM reports WHERE id=$1 FOR UPDATE`, id).Scan(&kind, &targetID, &status); err != nil {
		return models.ContentReport{}, err
	}
	next := "dismissed"
	if action == "hide" {
		next = "hidden"
	}
	if status != "open" {
		if status != next {
			return models.ContentReport{}, ErrReportDecided
		}
		x, err := scanReport(tx.QueryRow(reportSelect+`WHERE r.id=$1`, id))
		return x, err
	}
	var hideReason *string
	if action == "hide" {
		hideReason = &reason
		switch kind {
		case "card":
			_, err = tx.Exec(`UPDATE activities SET status='rejected',rejection_reason=$2 WHERE id=$1`, targetID, reason)
		case "review":
			_, err = tx.Exec(`UPDATE reviews SET status='hidden_by_report',hidden_reason=$2,updated_at=now() WHERE id=$1`, targetID, reason)
		case "media":
			_, err = tx.Exec(`UPDATE media SET is_hidden=true WHERE id=$1`, targetID)
		}
		if err != nil {
			return models.ContentReport{}, err
		}
	}
	_, err = tx.Exec(`UPDATE reports SET status=$2,hide_reason=$3,resolved_by=$4,resolved_at=now(),updated_at=now() WHERE id=$1`, id, next, hideReason, moderatorID)
	if err != nil {
		return models.ContentReport{}, err
	}
	x, err := scanReport(tx.QueryRow(reportSelect+`WHERE r.id=$1`, id))
	if err != nil {
		return x, err
	}
	return x, tx.Commit()
}
