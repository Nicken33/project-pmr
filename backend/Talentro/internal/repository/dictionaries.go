package repository

import (
	"database/sql"
	"fmt"
	"strconv"

	"talentro/internal/models"
)

// categoryRow — одна строка справочника categories, прочитанная из БД (§9.5).
type categoryRow struct {
	ID       int64
	ParentID sql.NullInt64
	Slug     string
	Name     string
	Kind     string
	Icon     string
	Order    int
}

// Categories отдаёт дерево направлений с иконками и порядком (§9.5, §7.2).
// Запрос плоский, сборку дерева делает чистая buildCategoryTree.
func (r *Repository) Categories() ([]models.Category, error) {
	rows, err := r.db.Query(`
		SELECT id, parent_id, slug, name, kind, icon, order_num
		FROM categories
		ORDER BY COALESCE(parent_id, id), order_num, id`)
	if err != nil {
		return nil, fmt.Errorf("чтение направлений: %w", err)
	}
	defer rows.Close()

	collected := make([]categoryRow, 0, 64)
	for rows.Next() {
		var row categoryRow
		if err := rows.Scan(&row.ID, &row.ParentID, &row.Slug, &row.Name, &row.Kind, &row.Icon, &row.Order); err != nil {
			return nil, fmt.Errorf("чтение строки направления: %w", err)
		}
		collected = append(collected, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("чтение направлений: %w", err)
	}

	return buildCategoryTree(collected)
}

// buildCategoryTree собирает двухуровневое дерево направлений из плоских строк.
//
// Порядок строк задаёт порядок корней и детей, но не обязан быть «родитель
// раньше ребёнка»: в SQL ребёнок с меньшим order_num сортируется раньше своего
// родителя (order_num ребёнка и родителя независимы). Поэтому корни
// индексируются в первом проходе, а дети прикрепляются во втором — результат не
// зависит от чередования строк.
//
// Осиротевшая строка (parent_id ссылается на несуществующее направление или на
// ребёнка — глубина больше двух уровней) это ошибка данных: дерево с молча
// выпавшими детьми выглядит валидным и маскирует поломку, поэтому возвращаем
// ошибку, а не неполный список.
func buildCategoryTree(rows []categoryRow) ([]models.Category, error) {
	roots := make([]models.Category, 0, len(rows))
	byID := make(map[int64]int, len(rows))
	known := make(map[int64]struct{}, len(rows))

	for _, row := range rows {
		known[row.ID] = struct{}{}
	}

	for _, row := range rows {
		if row.ParentID.Valid {
			continue
		}
		byID[row.ID] = len(roots)
		roots = append(roots, models.Category{
			ID:    row.ID,
			Slug:  row.Slug,
			Name:  row.Name,
			Kind:  row.Kind,
			Icon:  row.Icon,
			Order: row.Order,
		})
	}

	for _, row := range rows {
		if !row.ParentID.Valid {
			continue
		}
		if _, ok := known[row.ParentID.Int64]; !ok {
			return nil, fmt.Errorf("направление %q (id=%d): родитель id=%d отсутствует в справочнике",
				row.Slug, row.ID, row.ParentID.Int64)
		}
		idx, ok := byID[row.ParentID.Int64]
		if !ok {
			return nil, fmt.Errorf("направление %q (id=%d): родитель id=%d не является корневым, поддерживается только два уровня",
				row.Slug, row.ID, row.ParentID.Int64)
		}
		roots[idx].Children = append(roots[idx].Children, models.Category{
			ID:    row.ID,
			Slug:  row.Slug,
			Name:  row.Name,
			Kind:  row.Kind,
			Icon:  row.Icon,
			Order: row.Order,
		})
	}

	return roots, nil
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
