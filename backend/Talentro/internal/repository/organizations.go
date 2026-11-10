package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"talentro/internal/models"
)

func (r *Repository) GetOwnedOrganization(ownerID int64) (models.OrganizationDetails, error) {
	var id int64
	err := r.db.QueryRow(`SELECT id FROM organizations WHERE owner_id = $1 ORDER BY id LIMIT 1`, ownerID).Scan(&id)
	if err != nil {
		if err == sql.ErrNoRows {
			return models.OrganizationDetails{}, sql.ErrNoRows
		}
		return models.OrganizationDetails{}, fmt.Errorf("поиск профиля организации: %w", err)
	}
	return r.GetOrganization(id)
}

func (r *Repository) SaveOwnedOrganization(ownerID int64, input models.OrganizationMutation) (models.OrganizationDetails, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return models.OrganizationDetails{}, fmt.Errorf("начало транзакции профиля: %w", err)
	}
	defer tx.Rollback()

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
				city_id = $8
			WHERE id = $1`,
			id,
			input.Name,
			input.Type,
			input.Description,
			input.Phone,
			input.Email,
			input.Website,
			input.CityID,
		)

	case errors.Is(err, sql.ErrNoRows):
		slug := fmt.Sprintf("organization-%d", ownerID)

		err = tx.QueryRow(`
			INSERT INTO organizations (
				slug, name, organization_type, description, phone,
				email, website, city_id, owner_id, publication_basis
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'provided_by_owner')
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

	return r.GetOrganization(id)
}
