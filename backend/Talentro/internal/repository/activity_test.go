package repository_test

import (
	"testing"
	"time"
)

// Деталь (§9.3) несёт дату сверки карточки так же, как список: страница занятия
// не имеет права говорить «проверено» без дня, когда список этот день показывает.
// Тест отдельный, потому что SELECT в детали свой и колонку в нём легко забыть.
//
// Сида подобраны так, что у карточки дата есть, а у её организации — нет: иначе
// тест не различал бы дату карточки и дату организации, пришедшую по JOIN.
func TestActivityCarriesCardVerificationDate(t *testing.T) {
	repo := newRepo(t)
	olderThan := time.Now().UTC().AddDate(0, 0, -90)

	a, err := repo.ActivityBySlug("rybnitsa-podgotovka-k-shkole")
	if err != nil {
		t.Fatalf("ActivityBySlug: %v", err)
	}
	if a.Verified {
		t.Errorf("давняя сверка вернула verified=true")
	}
	if d := dateOnly(t, a.ContactsVerifiedAt); !d.Before(olderThan) {
		t.Errorf("дата карточки %v не давняя — сдвинулся сид", d)
	}
	if a.Organization.ContactsVerified != nil {
		t.Errorf("у организации сверки нет в сиде, а ответ отдал %q — дата взята не из cards",
			*a.Organization.ContactsVerified)
	}

	fresh, err := repo.ActivityBySlug("tiraspol-veselye-noty")
	if err != nil {
		t.Fatalf("ActivityBySlug: %v", err)
	}
	if !fresh.Verified {
		t.Errorf("свежая сверка вернула verified=false")
	}
	if d := dateOnly(t, fresh.ContactsVerifiedAt); d.Before(olderThan) {
		t.Errorf("свежая дата %v оказалась старше 90 дней", d)
	}
}
