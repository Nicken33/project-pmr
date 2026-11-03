package models

import (
	"encoding/json"
	"testing"
)

func TestCardJSONUsesStringIDAndAllowsMissingAgeBounds(t *testing.T) {
	card := Card{ID: 42, Name: "Робототехника", City: "Тирасполь"}

	data, err := json.Marshal(card)
	if err != nil {
		t.Fatalf("marshal card: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal card JSON: %v", err)
	}

	if got["id"] != "42" {
		t.Errorf("id = %v, want string \"42\"", got["id"])
	}

	age, ok := got["age"].(map[string]any)
	if !ok {
		t.Fatalf("age = %T, want object", got["age"])
	}
	if age["min_age"] != nil || age["max_age"] != nil {
		t.Errorf("age bounds = %v, want null bounds when unset", age)
	}
}
