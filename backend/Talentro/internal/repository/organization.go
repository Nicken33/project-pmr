package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"talentro/internal/models"
)

// orgActivitiesLimit — потолок списка занятий на странице организации. Он равен
// максимальному limit каталога (§9.4): больше ста занятий у одной организации на
// стенде не бывает, а палитру «показать всё» решит пагинация каталога, если она
// до этой страницы доедет.
const orgActivitiesLimit = 100

// OrganizationBySlug отдаёт организацию и её опубликованные занятия. Ключ — slug,
// но числовое id тоже принимается, как и в карточке: клиенты исторически ссылались
// и так, и этак.
func (r *Repository) OrganizationBySlug(slugOrID string) (*models.OrganizationPage, error) {
	var (
		org            models.Organization
		descr          sql.NullString
		email          sql.NullString
		site           sql.NullString
		address        sql.NullString
		city           sql.NullString
		verified       sql.NullTime
		organizationID int64
	)

	err := r.db.QueryRow(`
		SELECT o.id, o.slug, o.name, o.type, o.description, o.phone, o.email, o.site,
			o.address, oc.name, o.contacts_verified_at
		FROM organizations o
		LEFT JOIN cities oc ON oc.id = o.city_id
		WHERE (o.slug = $1 OR o.id::text = $1) AND o.is_active`, slugOrID).
		Scan(&organizationID, &org.Slug, &org.Name, &org.Type, &descr, &org.Phone,
			&email, &site, &address, &city, &verified)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("чтение организации: %w", err)
	}

	org.ID = organizationID
	org.Description = nullText(descr)
	org.Email = nullText(email)
	org.Site = nullText(site)
	org.Address = nullText(address)
	org.City = nullText(city)
	org.ContactsVerified = nullDate(verified)

	// Занятия — тем же запросом каталога: статус, активность и «одна карточка —
	// одна строка» (§5.9) уже внутри, дублировать их здесь значило бы разойтись
	// с каталогом при первой же правке.
	cards, total, err := r.SearchCards(models.CardFilter{
		OrganizationID: &organizationID,
		Sort:           "name",
		Page:           1,
		Limit:          orgActivitiesLimit,
	})
	if err != nil {
		return nil, err
	}

	return &models.OrganizationPage{Organization: &org, Activities: cards, Total: total}, nil
}
