package handlers

import (
	"testing"

	"talentro/internal/models"
)

func TestMakeCategoryTree(t *testing.T) {
	parentID := int64(1)
	tree := makeCategoryTree([]models.Reference{
		{ID: 1, Name: "Искусство", RecordType: "activity", SortOrder: 1},
		{ID: 2, Name: "Музыка", ParentID: &parentID, RecordType: "activity", SortOrder: 1},
	})
	if len(tree) != 1 || tree[0].Name != "Искусство" {
		t.Fatalf("unexpected root categories: %#v", tree)
	}
	if len(tree[0].Children) != 1 || tree[0].Children[0].Name != "Музыка" {
		t.Fatalf("unexpected child categories: %#v", tree[0].Children)
	}
}
