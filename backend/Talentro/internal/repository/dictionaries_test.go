package repository

import (
	"database/sql"
	"fmt"
	"sort"
	"testing"
)

// seedCategoryRows повторяет форму сида database/init.sql: 9 корней (id 1..9)
// и по 6 детей у каждого (id = root*10+i), order_num у корня и у ребёнка
// независимы — именно из-за этого ребёнок может идти в выборке раньше родителя.
func seedCategoryRows() []categoryRow {
	rows := make([]categoryRow, 0, 63)
	for root := 1; root <= 9; root++ {
		rows = append(rows, categoryRow{
			ID:    int64(root),
			Slug:  fmt.Sprintf("root-%d", root),
			Name:  fmt.Sprintf("Корень %d", root),
			Kind:  "direction",
			Icon:  fmt.Sprintf("icon-%d", root),
			Order: root,
		})
		for i := 1; i <= 6; i++ {
			rows = append(rows, categoryRow{
				ID:       int64(root*10 + i),
				ParentID: sql.NullInt64{Int64: int64(root), Valid: true},
				Slug:     fmt.Sprintf("root-%d-child-%d", root, i),
				Name:     fmt.Sprintf("Ребёнок %d.%d", root, i),
				Kind:     "section",
				Icon:     fmt.Sprintf("icon-%d-%d", root, i),
				Order:    i,
			})
		}
	}
	return rows
}

// sqlOrder воспроизводит ORDER BY COALESCE(parent_id, id), order_num, id из
// Categories(): внутри группы родителя — по order_num, а группа ребёнка может
// оказаться раньше самого родителя.
func sqlOrder(rows []categoryRow) []categoryRow {
	sorted := make([]categoryRow, len(rows))
	copy(sorted, rows)
	sort.SliceStable(sorted, func(i, j int) bool {
		gi := sorted[i].ID
		if sorted[i].ParentID.Valid {
			gi = sorted[i].ParentID.Int64
		}
		gj := sorted[j].ID
		if sorted[j].ParentID.Valid {
			gj = sorted[j].ParentID.Int64
		}
		if gi != gj {
			return gi < gj
		}
		if sorted[i].Order != sorted[j].Order {
			return sorted[i].Order < sorted[j].Order
		}
		return sorted[i].ID < sorted[j].ID
	})
	return sorted
}

func TestBuildCategoryTreeBadRowOrder(t *testing.T) {
	rows := sqlOrder(seedCategoryRows())

	// Предусловие теста: порядок действительно «плохой» — ребёнок корня 2
	// (order_num=1) стоит раньше самого корня (order_num=2).
	var childBeforeRoot, rootPos, childPos = false, -1, -1
	for i, row := range rows {
		switch {
		case row.ID == 2:
			rootPos = i
		case row.ID == 21:
			childPos = i
		}
	}
	if rootPos >= 0 && childPos >= 0 && childPos < rootPos {
		childBeforeRoot = true
	}
	if !childBeforeRoot {
		t.Fatalf("некорректный вход теста: ребёнок не идёт раньше родителя (root=%d child=%d)", rootPos, childPos)
	}

	tree, err := buildCategoryTree(rows)
	if err != nil {
		t.Fatalf("неожиданная ошибка: %v", err)
	}

	const wantRoots, wantChildren = 9, 54
	if len(tree) != wantRoots {
		t.Fatalf("корней %d, ожидалось %d", len(tree), wantRoots)
	}
	total := 0
	for _, root := range tree {
		total += len(root.Children)
	}
	if total != wantChildren {
		t.Fatalf("детей %d, ожидалось %d (всего категорий %d)", total, wantChildren, len(tree)+total)
	}
	if len(tree)+total != 63 {
		t.Fatalf("категорий %d, ожидалось 63", len(tree)+total)
	}

	// Порядок корней — из SQL (order_num, id): 1..9.
	for i, root := range tree {
		if root.Order != i+1 {
			t.Fatalf("корень %d: order_num=%d, ожидался %d", i, root.Order, i+1)
		}
		if len(root.Children) != 6 {
			t.Fatalf("корень %q: детей %d, ожидалось 6", root.Slug, len(root.Children))
		}
		// Порядок детей внутри родителя сохранён (order_num, id).
		for j, child := range root.Children {
			if child.Order != j+1 {
				t.Fatalf("корень %q, ребёнок %d: order_num=%d, ожидался %d", root.Slug, j, child.Order, j+1)
			}
			wantID := root.ID*10 + int64(j+1)
			if child.ID != wantID {
				t.Fatalf("корень %q, ребёнок %d: id=%d, ожидался %d", root.Slug, j, child.ID, wantID)
			}
		}
	}
}

func TestBuildCategoryTreeOrphan(t *testing.T) {
	rows := []categoryRow{
		{ID: 1, Slug: "root", Name: "Корень", Kind: "direction", Order: 1},
		{ID: 2, ParentID: sql.NullInt64{Int64: 99, Valid: true}, Slug: "lost", Name: "Сирота", Kind: "section", Order: 1},
	}
	if _, err := buildCategoryTree(rows); err == nil {
		t.Fatal("ожидалась ошибка про отсутствующего родителя, получен nil")
	}
}

func TestBuildCategoryTreeTooDeep(t *testing.T) {
	rows := []categoryRow{
		{ID: 1, Slug: "root", Name: "Корень", Kind: "direction", Order: 1},
		{ID: 2, ParentID: sql.NullInt64{Int64: 1, Valid: true}, Slug: "child", Name: "Ребёнок", Kind: "section", Order: 1},
		{ID: 3, ParentID: sql.NullInt64{Int64: 2, Valid: true}, Slug: "grandchild", Name: "Внук", Kind: "section", Order: 1},
	}
	if _, err := buildCategoryTree(rows); err == nil {
		t.Fatal("ожидалась ошибка про вложенность глубже двух уровней, получен nil")
	}
}

func TestBuildCategoryTreeEmpty(t *testing.T) {
	tree, err := buildCategoryTree(nil)
	if err != nil {
		t.Fatalf("неожиданная ошибка: %v", err)
	}
	if len(tree) != 0 {
		t.Fatalf("ожидалось пустое дерево, получено %d корней", len(tree))
	}
}
