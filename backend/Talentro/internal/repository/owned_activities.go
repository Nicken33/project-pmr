package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"talentro/internal/models"

	"github.com/lib/pq"
)

func (r *Repository) CreateOwnedActivity(
	ownerID int64,
	input models.OwnedActivityInput,
) (int64, string, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, "", err
	}
	defer tx.Rollback()

	// Секцию владелец создаёт от имени своей организации.
	var organizationID int64
	err = tx.QueryRow(
		`SELECT id FROM organizations WHERE owner_id = $1 ORDER BY id LIMIT 1`,
		ownerID,
	).Scan(&organizationID)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, "", fmt.Errorf("сначала создай профиль организации")
		}
		return 0, "", fmt.Errorf("поиск организации владельца: %w", err)
	}

	// Проверяем, что выбранное направление подходит для секций.
	var directionExists bool
	err = tx.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM directions
			WHERE id = $1 AND record_type IN ('activity', 'both')
		)`,
		input.DirectionID,
	).Scan(&directionExists)
	if err != nil {
		return 0, "", fmt.Errorf("проверка направления: %w", err)
	}
	if !directionExists {
		return 0, "", fmt.Errorf("направление для секции не найдено")
	}

	// Вначале ставим временный уникальный slug, потом заменяем его на slug с ID.
	tempSlug := fmt.Sprintf("draft-%d-%d", ownerID, time.Now().UnixNano())

	var activityID int64
	err = tx.QueryRow(`
		INSERT INTO activities (
			slug, name, description, organization_id, record_type,
			direction_id, class_type, class_format, phone, owner_id, status
		)
		VALUES ($1, $2, $3, $4, 'activity', $5, $6, $7, $8, $9, 'draft')
		RETURNING id`,
		tempSlug,
		strings.TrimSpace(input.Name),
		input.Description,
		organizationID,
		input.DirectionID,
		input.ClassType,
		input.ClassFormat,
		input.Phone,
		ownerID,
	).Scan(&activityID)
	if err != nil {
		return 0, "", fmt.Errorf("создание секции: %w", err)
	}

	slug := makeActivitySlug(input.Name, activityID)
	_, err = tx.Exec(`UPDATE activities SET slug = $2 WHERE id = $1`, activityID, slug)
	if err != nil {
		return 0, "", fmt.Errorf("создание ссылки секции: %w", err)
	}

	// Сохраняем точки. Key связывает точку с группой в запросе.
	locationIDs := make(map[string]int64, len(input.Locations))
	for _, location := range input.Locations {
		var locationID int64

		if location.ID != nil {
			// Если точка уже есть, проверяем, что она принадлежит организации.
			err = tx.QueryRow(`
				SELECT id FROM locations
				WHERE id = $1 AND organization_id = $2`,
				*location.ID,
				organizationID,
			).Scan(&locationID)
			if err != nil {
				return 0, "", fmt.Errorf("точка не найдена у этой организации: %w", err)
			}
		} else {
			sourceType := location.SourceType
			if sourceType == "" {
				sourceType = "person"
			}

			err = tx.QueryRow(`
				INSERT INTO locations (
					organization_id, name, city_id, district_id, address,
					latitude, longitude, phone, source_type, source_url
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
				RETURNING id`,
				organizationID,
				location.Name,
				location.CityID,
				location.DistrictID,
				strings.TrimSpace(location.Address),
				location.Latitude,
				location.Longitude,
				location.Phone,
				sourceType,
				location.SourceURL,
			).Scan(&locationID)
			if err != nil {
				return 0, "", fmt.Errorf("создание точки: %w", err)
			}
		}

		locationIDs[location.Key] = locationID
	}

	// Сохраняем группы и расписание каждой группы.
	for _, group := range input.Groups {
		locationID, ok := locationIDs[group.LocationKey]
		if !ok {
			return 0, "", fmt.Errorf("для группы не найдена точка location_key=%q", group.LocationKey)
		}

		var groupID int64
		err = tx.QueryRow(`
			INSERT INTO age_groups (
				activity_id, name, age_from, age_to, price_from,
				price_to, price_period, location_id, seats
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id`,
			activityID,
			group.Name,
			group.AgeFrom,
			group.AgeTo,
			group.PriceFrom,
			group.PriceTo,
			group.PricePeriod,
			locationID,
			group.Seats,
		).Scan(&groupID)
		if err != nil {
			return 0, "", fmt.Errorf("создание группы: %w", err)
		}

		for _, schedule := range group.Schedules {
			_, err = tx.Exec(`
				INSERT INTO schedules (
					age_group_id, weekday, start_time, end_time, note, seats
				)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				groupID,
				schedule.Weekday,
				schedule.StartTime,
				schedule.EndTime,
				schedule.Note,
				schedule.Seats,
			)
			if err != nil {
				return 0, "", fmt.Errorf("создание расписания группы: %w", err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, "", fmt.Errorf("сохранение секции: %w", err)
	}

	return activityID, slug, nil
}

func makeActivitySlug(name string, id int64) string {
	replacer := strings.NewReplacer(
		"а", "a", "б", "b", "в", "v", "г", "g", "д", "d",
		"е", "e", "ё", "e", "ж", "zh", "з", "z", "и", "i",
		"й", "y", "к", "k", "л", "l", "м", "m", "н", "n",
		"о", "o", "п", "p", "р", "r", "с", "s", "т", "t",
		"у", "u", "ф", "f", "х", "h", "ц", "ts", "ч", "ch",
		"ш", "sh", "щ", "sch", "ъ", "", "ы", "y", "ь", "",
		"э", "e", "ю", "yu", "я", "ya",
	)

	var slug strings.Builder
	for _, char := range replacer.Replace(strings.ToLower(strings.TrimSpace(name))) {
		if char >= 'a' && char <= 'z' || char >= '0' && char <= '9' {
			slug.WriteRune(char)
		} else if slug.Len() > 0 && !strings.HasSuffix(slug.String(), "-") {
			slug.WriteByte('-')
		}
	}

	base := strings.Trim(slug.String(), "-")
	if base == "" {
		base = "sektsiya"
	}

	return fmt.Sprintf("%s-%d", base, id)
}

func (r *Repository) ListOwnedActivities(ownerID int64) ([]models.OwnedActivity, error) {
	result, err := r.SearchCards(models.ActivityFilter{
		OwnerID:   &ownerID,
		OwnerOnly: true,
		Page:      1,
		Limit:     100,
	})
	if err != nil {
		return nil, err
	}

	items := make([]models.OwnedActivity, 0, len(result.Items))
	if len(result.Items) == 0 {
		return items, nil
	}

	ids := make([]int64, 0, len(result.Items))
	for _, card := range result.Items {
		ids = append(ids, card.ID)
	}

	rows, err := r.db.Query(`
		SELECT id, rejection_reason, is_active
		FROM activities
		WHERE owner_id = $1 AND id = ANY($2)`,
		ownerID,
		pq.Array(ids),
	)
	if err != nil {
		return nil, fmt.Errorf("чтение статусов секций владельца: %w", err)
	}
	defer rows.Close()

	type ownerState struct {
		reason *string
		active bool
	}

	states := make(map[int64]ownerState, len(ids))
	for rows.Next() {
		var id int64
		var state ownerState
		if err := rows.Scan(&id, &state.reason, &state.active); err != nil {
			return nil, fmt.Errorf("чтение статуса секции: %w", err)
		}
		states[id] = state
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход статусов секций: %w", err)
	}

	for _, card := range result.Items {
		state := states[card.ID]
		items = append(items, models.OwnedActivity{
			Card:            card,
			RejectionReason: state.reason,
			IsActive:        state.active,
		})
	}

	return items, nil
}

func (r *Repository) GetOwnedActivity(ownerID, activityID int64) (models.OwnedActivity, error) {
	result, err := r.SearchCards(models.ActivityFilter{
		ID:        &activityID,
		OwnerID:   &ownerID,
		OwnerOnly: true,
		Page:      1,
		Limit:     1,
	})
	if err != nil {
		return models.OwnedActivity{}, err
	}
	if len(result.Items) == 0 {
		return models.OwnedActivity{}, sql.ErrNoRows
	}

	item := models.OwnedActivity{Card: result.Items[0]}
	err = r.db.QueryRow(`
		SELECT rejection_reason, is_active
		FROM activities
		WHERE id = $1 AND owner_id = $2`,
		activityID,
		ownerID,
	).Scan(&item.RejectionReason, &item.IsActive)
	if err != nil {
		return models.OwnedActivity{}, fmt.Errorf("чтение статуса секции владельца: %w", err)
	}

	return item, nil
}

var ErrActivityNotReady = errors.New("секция не готова к отправке")
var ErrActivityWrongStatus = errors.New("секцию нельзя отправить из текущего статуса")
var ErrActivityNotPublished = errors.New("секция не опубликована или уже снята с публикации")

func (r *Repository) SubmitOwnedActivity(
	ownerID int64,
	activityID int64,
) (models.OwnedActivity, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.OwnedActivity{}, err
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
		return models.OwnedActivity{}, err
	}

	if status != "draft" && status != "rejected" {
		return models.OwnedActivity{}, ErrActivityWrongStatus
	}

	var ready bool
	err = tx.QueryRow(`
		SELECT
			EXISTS (
				SELECT 1
				FROM age_groups
				WHERE activity_id = $1
			)
			AND NOT EXISTS (
				SELECT 1
				FROM age_groups ag
				JOIN locations loc ON loc.id = ag.location_id
				WHERE ag.activity_id = $1
				  AND (
					ag.age_from IS NULL
					OR ag.age_to IS NULL
					OR ag.seats IS NULL
					OR loc.address = ''
					OR loc.latitude IS NULL
					OR loc.longitude IS NULL
					OR NOT EXISTS (
						SELECT 1
						FROM schedules s
						WHERE s.age_group_id = ag.id
					)
				  )
			)`,
		activityID,
	).Scan(&ready)
	if err != nil {
		return models.OwnedActivity{}, fmt.Errorf("проверка готовности секции: %w", err)
	}
	if !ready {
		return models.OwnedActivity{}, ErrActivityNotReady
	}

	_, err = tx.Exec(`
		UPDATE activities
		SET status = 'pending',
		    rejection_reason = NULL,
		    is_active = true
		WHERE id = $1 AND owner_id = $2`,
		activityID,
		ownerID,
	)
	if err != nil {
		return models.OwnedActivity{}, fmt.Errorf("отправка секции на модерацию: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return models.OwnedActivity{}, fmt.Errorf("сохранение статуса секции: %w", err)
	}

	return r.GetOwnedActivity(ownerID, activityID)
}

func (r *Repository) UnpublishOwnedActivity(
	ownerID int64,
	activityID int64,
) (models.OwnedActivity, error) {
	result, err := r.db.Exec(`
		UPDATE activities
		SET is_active = false,
		    updated_at = now()
		WHERE id = $1
		  AND owner_id = $2
		  AND status = 'published'
		  AND is_active = true`,
		activityID,
		ownerID,
	)
	if err != nil {
		return models.OwnedActivity{}, fmt.Errorf("снятие секции с публикации: %w", err)
	}

	changed, err := result.RowsAffected()
	if err != nil {
		return models.OwnedActivity{}, err
	}
	if changed == 0 {
		var exists bool
		err = r.db.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM activities WHERE id = $1 AND owner_id = $2)`,
			activityID,
			ownerID,
		).Scan(&exists)
		if err != nil {
			return models.OwnedActivity{}, err
		}
		if !exists {
			return models.OwnedActivity{}, sql.ErrNoRows
		}
		return models.OwnedActivity{}, ErrActivityNotPublished
	}

	return r.GetOwnedActivity(ownerID, activityID)
}
