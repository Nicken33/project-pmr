package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"talentro/internal/models"
)

// cards — страница только с id: listETag учитывает именно их, а не поля карточки.
func cards(ids ...string) []models.Card {
	out := make([]models.Card, 0, len(ids))
	for _, id := range ids {
		out = append(out, models.Card{ID: id})
	}
	return out
}

// notModified читает ETag из уже записанных заголовков — именно так его ставят
// Catalog, Cards и writeActivity: метка считается до проверки.
func TestNotModified(t *testing.T) {
	cases := []struct {
		name        string
		etag        string
		ifNoneMatch string
		want        bool
	}{
		{"нет ETag", "", `W/"abc"`, false},
		{"нет If-None-Match", `W/"abc"`, "", false},
		{"совпал", `W/"abc"`, `W/"abc"`, true},
		{"с пробелами", `W/"abc"`, ` W/"abc" `, true},
		{"в списке совпал", `W/"abc"`, `W/"xyz", W/"abc"`, true},
		{"звёздка", `W/"abc"`, "*", true},
		{"не совпал", `W/"abc"`, `W/"xyz"`, false},
		{"сильная метка против слабой", `W/"abc"`, `"abc"`, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			if c.etag != "" {
				rec.Header().Set("ETag", c.etag)
			}
			r := httptest.NewRequest(http.MethodGet, "/api/v1/activities", nil)
			if c.ifNoneMatch != "" {
				r.Header.Set("If-None-Match", c.ifNoneMatch)
			}

			if got := notModified(rec, r); got != c.want {
				t.Fatalf("notModified = %v, ждали %v (ETag %q, If-None-Match %q)",
					got, c.want, c.etag, c.ifNoneMatch)
			}
			if !c.want {
				return
			}
			// 304 без тела — иначе клиент прочитает кэш как валидный ответ.
			if rec.Code != http.StatusNotModified {
				t.Errorf("код = %d, ждали 304", rec.Code)
			}
			if rec.Body.Len() != 0 {
				t.Errorf("тело 304 должно быть пустым, получили %q", rec.Body.String())
			}
		})
	}
}

func TestListETagChangesWithPage(t *testing.T) {
	a := listETag(cards("1", "2"), 8)
	if b := listETag(cards("1", "2"), 8); a != b {
		t.Fatalf("одна и та же страница должна давать одну метку: %s против %s", a, b)
	}
	if b := listETag(cards("2", "1"), 8); a == b {
		t.Errorf("порядок карточек — часть метки, но %s совпал с перевёрнутой страницей", a)
	}
	if b := listETag(cards("1", "2"), 9); a == b {
		t.Errorf("total — часть метки: при новом фильтре клиент не должен получать 304")
	}
	if len(a) < 5 || a[:2] != "W/" {
		t.Errorf("метка должна быть слабой по RFC 7232, получили %q", a)
	}
}
