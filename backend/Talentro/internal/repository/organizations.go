package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"talentro/internal/models"
)

var ErrInvalidOrganizationDistrict = errors.New("район не относится к выбранному городу")

func (r *Repository) organizationLocations(organizationID int64) ([]models.OrganizationLocation, error) {
	rows, err := r.db.Query(`
		SELECT l.id, l.name, l.city_id, c.name, l.district_id, d.name,
		       l.address, l.latitude, l.longitude, l.phone,
		       (SELECT COUNT(*) FROM age_groups ag WHERE ag.location_id = l.id)
		FROM locations l
		JOIN cities c ON c.id = l.city_id
		LEFT JOIN districts d ON d.id = l.district_id
		WHERE l.organization_id = $1 AND l.is_active = true
		ORDER BY c.sort_order, c.name, d.sort_order, d.name, l.address, l.id`, organizationID)
	if err != nil {
		return nil, fmt.Errorf("чтение точек организации: %w", err)
	}
	defer rows.Close()
	items := make([]models.OrganizationLocation, 0)
	for rows.Next() {
		var item models.OrganizationLocation
		if err := rows.Scan(&item.ID, &item.Name, &item.CityID, &item.City, &item.DistrictID, &item.District, &item.Address, &item.Latitude, &item.Longitude, &item.Phone, &item.GroupsCount); err != nil {
			return nil, fmt.Errorf("чтение точки организации: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) GetOwnedOrganization(ownerID int64) (models.OrganizationDetails, error) {
	var id int64
	err := r.db.QueryRow(`SELECT id FROM organizations WHERE owner_id = $1 ORDER BY id LIMIT 1`, ownerID).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			return models.OrganizationDetails{}, sql.ErrNoRows
		}
		return models.OrganizationDetails{}, fmt.Errorf("поиск профиля организации: %w", err)
	}
	return r.GetOrganizationByID(id)
}

func (r *Repository) SaveOwnedOrganization(ownerID int64, input models.OrganizationMutation) (models.OrganizationDetails, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.OrganizationDetails{}, fmt.Errorf("начало транзакции профиля: %w", err)
	}
	defer tx.Rollback()

	if input.DistrictID < 0 {
		return models.OrganizationDetails{}, ErrInvalidOrganizationDistrict
	}
	if input.DistrictID > 0 {
		var valid bool
		if err := tx.QueryRow(`SELECT EXISTS (SELECT 1 FROM districts WHERE id = $1 AND city_id = $2)`, input.DistrictID, input.CityID).Scan(&valid); err != nil {
			return models.OrganizationDetails{}, fmt.Errorf("проверка района: %w", err)
		}
		if !valid {
			return models.OrganizationDetails{}, ErrInvalidOrganizationDistrict
		}
	}
	var id int64
	err = tx.QueryRow(`
		SELECT id
		FROM organizations
		WHERE owner_id = $1
		ORDER BY id
		LIMIT 1
		FOR UPDATE`,
		ownerID,
	).Scan(&id)

	switch {
	case err == nil:
		_, err = tx.Exec(`
			UPDATE organizations
			SET name = $2,
				organization_type = $3,
				description = $4,
				phone = $5,
				email = $6,
				website = $7,
				city_id = $8, district_id = NULLIF($9, 0)
			WHERE id = $1`,
			id,
			input.Name,
			input.Type,
			input.Description,
			input.Phone,
			input.Email,
			input.Website,
			input.CityID,
			input.DistrictID,
		)

	case errors.Is(err, sql.ErrNoRows):
		slug := fmt.Sprintf("organization-%d", ownerID)

		err = tx.QueryRow(`
			INSERT INTO organizations (
				slug, name, organization_type, description, phone,
				email, website, city_id, owner_id, district_id, publication_basis
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, 0), 'provided_by_owner')
			RETURNING id`,
			slug,
			input.Name,
			input.Type,
			input.Description,
			input.Phone,
			input.Email,
			input.Website,
			input.CityID,
			ownerID,
			input.DistrictID,
		).Scan(&id)

	default:
		return models.OrganizationDetails{}, fmt.Errorf("поиск профиля владельца: %w", err)
	}

	if err != nil {
		return models.OrganizationDetails{}, fmt.Errorf("сохранение профиля организации: %w", err)
	}

	if _, err := tx.Exec(`
		DELETE FROM messengers
		WHERE organization_id = $1`,
		id,
	); err != nil {
		return models.OrganizationDetails{}, fmt.Errorf("обновление мессенджеров: %w", err)
	}

	for _, messenger := range input.Messengers {
		if _, err := tx.Exec(`
			INSERT INTO messengers (organization_id, channel, contact)
			VALUES ($1, $2, $3)`,
			id,
			messenger.Channel,
			messenger.Contact,
		); err != nil {
			return models.OrganizationDetails{}, fmt.Errorf("сохранение мессенджера: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return models.OrganizationDetails{}, fmt.Errorf("завершение транзакции профиля: %w", err)
	}

	return r.GetOrganizationByID(id)
}
