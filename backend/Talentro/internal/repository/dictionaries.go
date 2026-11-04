package repository

import (
	"database/sql"
	"fmt"
	"strconv"

	"talentro/internal/models"
)

// Categories отдаёт дерево направлений с иконками и порядком (§9.5, §7.2).
// Один запрос с сортировкой по родителю и порядку: уровней ровно два, поэтому
// обход прямой и без рекурсии.
func (r *Repository) Categories() ([]models.Category, error) {
	rows, err := r.db.Query(`
		SELECT id, parent_id, slug, name, kind, icon, order_num
		FROM categories
		ORDER BY COALESCE(parent_id, id), order_num, id`)
	if err != nil {
		return nil, fmt.Errorf("чтение направлений: %w", err)
	}
	defer rows.Close()

	roots := make([]models.Category, 0)
	byID := make(map[int64]int)

	for rows.Next() {
		var (
			c        models.Category
			parentID sql.NullInt64
		)
		if err := rows.Scan(&c.ID, &parentID, &c.Slug, &c.Name, &c.Kind, &c.Icon, &c.Order); err != nil {
			return nil, fmt.Errorf("чтение строки направления: %w", err)
		}

		if !parentID.Valid {
			byID[c.ID] = len(roots)
			roots = append(roots, c)
			continue
		}
		idx, ok := byID[parentID.Int64]
		if !ok {
			// Порядок ORDER BY гарантирует, что родитель идёт раньше потомка,
			// поэтому сюда попадает только битая ссылка — её не показываем.
			continue
		}
		roots[idx].Children = append(roots[idx].Children, c)
	}

	return roots, rows.Err()
}

// Cities — справочник городов по порядку (§9.6).
func (r *Repository) Cities() ([]models.Place, error) {
	return r.scanPlaces(`
		SELECT id, slug, name, NULL::bigint
		FROM cities
		ORDER BY order_num, name`)
}

// Districts — районы одного города (§9.6, `districts?city=`). Город обязателен:
// одноимённый район бывает в нескольких городах (§5.4).
func (r *Repository) Districts(city string) ([]models.Place, error) {
	if id, err := strconv.ParseInt(city, 10, 64); err == nil {
		return r.scanPlaces(`
			SELECT id, slug, name, city_id
			FROM districts
			WHERE city_id = $1
			ORDER BY order_num, name`, id)
	}
	if city == "" {
		return nil, ErrNotFound
	}
	return r.scanPlaces(`
		SELECT d.id, d.slug, d.name, d.city_id
		FROM districts d
		JOIN cities c ON c.id = d.city_id
		WHERE c.slug = $1
		ORDER BY d.order_num, d.name`, city)
}

func (r *Repository) scanPlaces(query string, args ...any) ([]models.Place, error) {
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("чтение справочника: %w", err)
	}
	defer rows.Close()

	out := make([]models.Place, 0)
	for rows.Next() {
		var (
			p      models.Place
			cityID sql.NullInt64
		)
		if err := rows.Scan(&p.ID, &p.Slug, &p.Name, &cityID); err != nil {
			return nil, fmt.Errorf("чтение строки справочника: %w", err)
		}
		if cityID.Valid {
			v := cityID.Int64
			p.City = &v
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
