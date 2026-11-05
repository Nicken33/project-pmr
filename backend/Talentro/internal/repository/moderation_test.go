package repository_test

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"sync"
	"testing"

	_ "github.com/lib/pq"

	"talentro/internal/models"
	"talentro/internal/repository"
)

// Интеграционные тесты модерации против настоящего Postgres: транзакционный
// порядок «заявка → карточка → журнал», FOR UPDATE и частичный уникальный индекс
// проверить без базы нельзя. Ожидаемые строки соответствуют сидам
// database/init.sql — если меняешь сид, правь и их.
//
// Запуск на чистой базе:
//
//	psql < database/init.sql
//	DATABASE_URL=postgres://... go test ./internal/repository/ -run Moderation
//
// Тесты, которые решают заявку, создают её сами и удаляют в cleanup: сиды
// остаются валидными для повторного прогона и для тестов каталога.
func newModerationRepo(t *testing.T) (*repository.Repository, *sql.DB) {
	t.Helper()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL не задан — интеграционные тесты модерации пропущены")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("не удалось открыть базу: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if err := db.Ping(); err != nil {
		t.Fatalf("база недоступна: %v", err)
	}
	return repository.New(db), db
}

// testApplication — живая заявка, которую тест может решать сколько угодно раз:
// карточка выбирается такая, у которой в сиде нет pending.
func testApplication(t *testing.T, db *sql.DB, cardID int64) int64 {
	t.Helper()

	var id int64
	err := db.QueryRow(`
		INSERT INTO moderation_applications (card_id, submitted_by, submitted_at)
		VALUES ($1, 3, now() - interval '3 days')
		RETURNING id`, cardID).Scan(&id)
	if err != nil {
		t.Fatalf("не удалось создать тестовую заявку: %v", err)
	}

	t.Cleanup(func() {
		if _, err := db.Exec(`DELETE FROM moderation_applications WHERE id = $1`, id); err != nil {
			t.Errorf("cleanup заявки %d: %v", id, err)
		}
		// Решение модератора меняет карточку — возвращаем сид в исходный вид.
		if _, err := db.Exec(`
			UPDATE cards SET status = 'published', reject_reason = NULL WHERE id = $1`, cardID); err != nil {
			t.Errorf("cleanup карточки %d: %v", cardID, err)
		}
	})
	return id
}

func TestModerationQueuePendingFirst(t *testing.T) {
	repo, _ := newModerationRepo(t)
	ctx := context.Background()

	items, total, err := repo.ModerationQueue(ctx, models.ModerationQueueFilter{Page: 1, Limit: 20})
	if err != nil {
		t.Fatalf("ModerationQueue: %v", err)
	}
	if total != 5 {
		t.Errorf("total = %d, в сидах 5 заявок", total)
	}
	if len(items) != total {
		t.Errorf("на странице %d заявок при total %d", len(items), total)
	}

	// §3.9.1: сперва живые заявки, дольше всех ждёт — выше.
	if items[0].Status != models.ApplicationPending || items[1].Status != models.ApplicationPending {
		t.Errorf("первые две строки очереди не pending: %q, %q", items[0].Status, items[1].Status)
	}
	if items[0].ID != 1 || items[1].ID != 2 {
		t.Errorf("порядок в очереди %d, %d, ждали 1 (ждёт 6 дней), 2 (ждёт 1 день)",
			items[0].ID, items[1].ID)
	}
	if items[0].SubmittedAt == nil || !items[0].SubmittedAt.Before(*items[1].SubmittedAt) {
		t.Error("заявка, которая ждёт дольше, обязана идти выше")
	}

	// Статусы заявки и карточки различаются осознанно (§3.8.6).
	if items[1].CardStatus != "published" || items[1].Status != models.ApplicationPending {
		t.Errorf("заявка 2: ждём pending + published, получили %s + %s",
			items[1].Status, items[1].CardStatus)
	}
	if items[0].Slug != "kamenka-kulinariya-podrostki" || items[0].OrganizationName == "" {
		t.Errorf("заявка 1: срез карточки неполный — slug %q, организация %q",
			items[0].Slug, items[0].OrganizationName)
	}
	if items[0].DecidedBy != nil {
		t.Errorf("у живой заявки не может быть decided_by, получили %q", *items[0].DecidedBy)
	}
}

// §3.9.1: превью строится со всеми группами и всеми точками, а не с одной.
func TestModerationQueueCarriesPreview(t *testing.T) {
	repo, _ := newModerationRepo(t)

	items, _, err := repo.ModerationQueue(context.Background(),
		models.ModerationQueueFilter{Status: models.ApplicationPending, Page: 1, Limit: 10})
	if err != nil {
		t.Fatalf("ModerationQueue: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("в ожидании 2 pending-заявки, получили %d", len(items))
	}

	for _, app := range items {
		if len(app.Groups) != app.GroupsCount {
			t.Errorf("%s: групп %d, а GroupsCount = %d", app.Slug, len(app.Groups), app.GroupsCount)
		}
		if len(app.Locations) != app.LocationsCount {
			t.Errorf("%s: точек %d, а LocationsCount = %d", app.Slug, len(app.Locations), app.LocationsCount)
		}
		if app.Groups == nil || app.Locations == nil || app.Photos == nil {
			t.Errorf("%s: пустой список обязан отдаваться как [], а не null (§9)", app.Slug)
		}
		for _, g := range app.Groups {
			if g.Schedules == nil {
				t.Errorf("%s: у группы %d расписание null", app.Slug, g.ID)
			}
		}
	}
}

func TestModerationQueueStatusFilter(t *testing.T) {
	repo, _ := newModerationRepo(t)
	ctx := context.Background()

	for _, c := range []struct {
		status string
		want   int
	}{
		{models.ApplicationPending, 2},
		{models.ApplicationApproved, 2},
		{models.ApplicationRejected, 1},
		{"", 5},
	} {
		items, total, err := repo.ModerationQueue(ctx,
			models.ModerationQueueFilter{Status: c.status, Page: 1, Limit: 20})
		if err != nil {
			t.Fatalf("фильтр %q: %v", c.status, err)
		}
		if total != c.want || len(items) != c.want {
			t.Errorf("фильтр %q: total = %d, строк %d, ждали %d", c.status, total, len(items), c.want)
		}
		for _, app := range items {
			if c.status != "" && app.Status != c.status {
				t.Errorf("фильтр %q пропустил заявку со статусом %q", c.status, app.Status)
			}
		}
	}

	// Пагинация: total не зависит от страницы (§9.4).
	first, firstTotal, err := repo.ModerationQueue(ctx, models.ModerationQueueFilter{Page: 1, Limit: 2})
	if err != nil {
		t.Fatalf("страница 1: %v", err)
	}
	second, secondTotal, err := repo.ModerationQueue(ctx, models.ModerationQueueFilter{Page: 2, Limit: 2})
	if err != nil {
		t.Fatalf("страница 2: %v", err)
	}
	if len(first) != 2 || len(second) != 2 {
		t.Errorf("limit=2: на страницах %d и %d строк", len(first), len(second))
	}
	if firstTotal != secondTotal {
		t.Errorf("total изменился между страницами: %d vs %d", firstTotal, secondTotal)
	}
	if first[0].ID == second[0].ID {
		t.Error("страницы совпали — OFFSET не применён")
	}

	beyond, _, err := repo.ModerationQueue(ctx, models.ModerationQueueFilter{Page: 99, Limit: 20})
	if err != nil {
		t.Fatalf("страница за концом: %v", err)
	}
	if len(beyond) != 0 {
		t.Errorf("за последней страницей очередь обязана быть пустой, получили %d", len(beyond))
	}
}

// Роль читается только из users.account_type (§12.1, §15 п. 8).
func TestAccountByIDRole(t *testing.T) {
	repo, _ := newModerationRepo(t)

	moderator, err := repo.AccountByID(context.Background(), 1)
	if err != nil {
		t.Fatalf("AccountByID(1): %v", err)
	}
	if !moderator.IsModerator() {
		t.Errorf("id 1: role = %q, ждали moderator", moderator.Role)
	}

	owner, err := repo.AccountByID(context.Background(), 3)
	if err != nil {
		t.Fatalf("AccountByID(3): %v", err)
	}
	if owner.IsModerator() {
		t.Errorf("владелец %q прошёл как модератор", owner.Email)
	}

	if _, err := repo.AccountByID(context.Background(), 999999); !errors.Is(err, repository.ErrNotFound) {
		t.Errorf("несуществующий пользователь: ошибка %v, ждали ErrNotFound", err)
	}
}

func TestDecideApplicationApproveWritesJournalAndCard(t *testing.T) {
	repo, db := newModerationRepo(t)
	ctx := context.Background()
	appID := testApplication(t, db, 6)

	result, err := repo.DecideApplication(ctx, appID, models.Account{ID: 1, Name: "Ирина", Role: "moderator"},
		models.DecisionInput{Action: models.ActionApprove})
	if err != nil {
		t.Fatalf("DecideApplication: %v", err)
	}
	if result.Replayed {
		t.Error("первое решение не может быть повтором")
	}
	if result.Application.Status != models.ApplicationApproved {
		t.Errorf("статус заявки = %q, ждали approved", result.Application.Status)
	}
	if result.Application.CardStatus != "published" {
		t.Errorf("статус карточки = %q, approve обязан публиковать", result.Application.CardStatus)
	}
	if result.Entry == nil || result.Entry.Action != models.ActionApprove || result.Entry.ActorID != 1 {
		t.Fatalf("строка журнала неполная: %+v", result.Entry)
	}

	var (
		journalRows int
		cardStatus  string
		decidedBy   sql.NullInt64
	)
	if err := db.QueryRow(`SELECT count(*) FROM moderation_journal WHERE application_id = $1`, appID).
		Scan(&journalRows); err != nil {
		t.Fatalf("подсчёт журнала: %v", err)
	}
	if journalRows != 1 {
		t.Errorf("строк журнала %d, ждали 1", journalRows)
	}
	if err := db.QueryRow(`SELECT status FROM cards WHERE id = 6`).Scan(&cardStatus); err != nil {
		t.Fatalf("чтение карточки: %v", err)
	}
	if cardStatus != "published" {
		t.Errorf("карточка осталась %q — решение не доехало до каталога", cardStatus)
	}
	if err := db.QueryRow(`SELECT decided_by FROM moderation_applications WHERE id = $1`, appID).
		Scan(&decidedBy); err != nil || decidedBy.Int64 != 1 {
		t.Errorf("decided_by = %v (ошибка %v), ждали 1", decidedBy, err)
	}
}

func TestDecideApplicationRejectStoresReason(t *testing.T) {
	repo, db := newModerationRepo(t)
	appID := testApplication(t, db, 9)

	result, err := repo.DecideApplication(context.Background(), appID,
		models.Account{ID: 1, Role: "moderator"},
		models.DecisionInput{
			Action:  models.ActionReject,
			Reason:  "Адрес не указан",
			Comment: "Поправьте точку проведения.",
		})
	if err != nil {
		t.Fatalf("DecideApplication: %v", err)
	}
	if result.Application.Status != models.ApplicationRejected ||
		result.Application.CardStatus != "rejected" {
		t.Errorf("заявка %s / карточка %s, ждали rejected + rejected",
			result.Application.Status, result.Application.CardStatus)
	}
	want := "Адрес не указан Поправьте точку проведения."
	if result.Application.RejectReason == nil || *result.Application.RejectReason != want {
		t.Errorf("причина %v, ждали %q", result.Application.RejectReason, want)
	}
	if result.Entry.Reason == nil || *result.Entry.Reason != "Адрес не указан" {
		t.Errorf("в журнале типовая причина %v", result.Entry.Reason)
	}
	if result.Entry.Comment == nil || *result.Entry.Comment != "Поправьте точку проведения." {
		t.Errorf("в журнале свободный текст %v", result.Entry.Comment)
	}

	var cardReason sql.NullString
	if err := db.QueryRow(`SELECT reject_reason FROM cards WHERE id = 9`).Scan(&cardReason); err != nil {
		t.Fatalf("чтение причины карточки: %v", err)
	}
	if cardReason.String != want {
		t.Errorf("карточка хранит %q, ждали %q — владелец увидит не то, что написал модератор",
			cardReason.String, want)
	}
}

// Идемпотентность (§15 п. 8, §3.9.4): повтор того же решения ничего не пишет,
// любое другое повторное решение — конфликт.
func TestDecideApplicationIsIdempotent(t *testing.T) {
	repo, db := newModerationRepo(t)
	ctx := context.Background()
	appID := testApplication(t, db, 6)
	moderator := models.Account{ID: 1, Role: "moderator"}
	in := models.DecisionInput{Action: models.ActionApprove}

	if _, err := repo.DecideApplication(ctx, appID, moderator, in); err != nil {
		t.Fatalf("первое решение: %v", err)
	}

	replay, err := repo.DecideApplication(ctx, appID, moderator, in)
	if err != nil {
		t.Fatalf("повтор того же решения: %v", err)
	}
	if !replay.Replayed {
		t.Error("повтор обязан быть помечен replayed")
	}

	var rows int
	if err := db.QueryRow(`SELECT count(*) FROM moderation_journal WHERE application_id = $1`, appID).
		Scan(&rows); err != nil {
		t.Fatalf("подсчёт журнала: %v", err)
	}
	if rows != 1 {
		t.Errorf("после повтора строк журнала %d, ждали 1 (§3.9.4 журнал не переписывается)", rows)
	}

	// Другое решение по закрытой заявке — конфликт, а не тихая замена.
	if _, err := repo.DecideApplication(ctx, appID, moderator,
		models.DecisionInput{Action: models.ActionReject, Reason: "Передумали"}); !errors.Is(err, repository.ErrConflict) {
		t.Errorf("смена решения: ошибка %v, ждали ErrConflict", err)
	}

	// Другой модератор с тем же решением — тоже конфликт: в журнале должен
	// остаться тот, кто решил по факту.
	if _, err := repo.DecideApplication(ctx, appID,
		models.Account{ID: 4, Role: "moderator"}, in); !errors.Is(err, repository.ErrConflict) {
		t.Errorf("повтор другим модератором: ошибка %v, ждали ErrConflict", err)
	}
	if err := db.QueryRow(`SELECT count(*) FROM moderation_journal WHERE application_id = $1`, appID).
		Scan(&rows); err == nil && rows != 1 {
		t.Errorf("неудачные попытки добавили строки журнала: %d", rows)
	}
}

// Два модератора нажали кнопку одновременно: FOR UPDATE оставляет одно решение
// и одну строку журнала. Модераторы разные — повтор чужого решения это конфликт,
// а не идемпотентный ответ (его проверяет TestDecideApplicationIsIdempotent).
func TestDecideApplicationConcurrent(t *testing.T) {
	repo, db := newModerationRepo(t)
	appID := testApplication(t, db, 6)

	var wg sync.WaitGroup
	results := make([]error, 4)
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := repo.DecideApplication(context.Background(), appID,
				models.Account{ID: int64(i + 1), Role: "moderator"},
				models.DecisionInput{Action: models.ActionApprove})
			results[i] = err
		}(i)
	}
	wg.Wait()

	ok := 0
	for _, err := range results {
		switch {
		case err == nil:
			ok++
		case errors.Is(err, repository.ErrConflict):
		default:
			t.Fatalf("неожиданная ошибка гонки: %v", err)
		}
	}
	if ok != 1 {
		t.Errorf("успешных решений %d, ждали 1", ok)
	}

	var rows int
	if err := db.QueryRow(`SELECT count(*) FROM moderation_journal WHERE application_id = $1`, appID).
		Scan(&rows); err != nil {
		t.Fatalf("подсчёт журнала: %v", err)
	}
	if rows != 1 {
		t.Errorf("строк журнала %d, ждали 1", rows)
	}
}

func TestDecideApplicationNotFoundAndBadAction(t *testing.T) {
	repo, _ := newModerationRepo(t)
	ctx := context.Background()
	moderator := models.Account{ID: 1, Role: "moderator"}

	if _, err := repo.DecideApplication(ctx, 999999, moderator,
		models.DecisionInput{Action: models.ActionApprove}); !errors.Is(err, repository.ErrNotFound) {
		t.Errorf("заявка 999999: ошибка %v, ждали ErrNotFound", err)
	}
	if _, err := repo.DecideApplication(ctx, 1, moderator,
		models.DecisionInput{Action: "hide"}); err == nil {
		t.Error("неизвестное действие обязано возвращать ошибку")
	}
}

func TestModerationJournalNewestFirst(t *testing.T) {
	repo, _ := newModerationRepo(t)

	entries, total, err := repo.ModerationJournal(context.Background(),
		models.JournalFilter{Page: 1, Limit: 20})
	if err != nil {
		t.Fatalf("ModerationJournal: %v", err)
	}
	if total != 3 || len(entries) != 3 {
		t.Fatalf("журнал: total %d, строк %d, ждали 3 (§3.9.4 — все решения)", total, len(entries))
	}
	for i := 1; i < len(entries); i++ {
		if entries[i-1].CreatedAt.Before(entries[i].CreatedAt) {
			t.Errorf("строка %d старше строки %d — журнал не по порядку свежих сверху", i-1, i)
		}
	}
	if entries[0].ActorName == "" || entries[0].CardTitle == "" || entries[0].OrganizationSlug == "" {
		t.Errorf("журнал без подписи «кто, что, где»: %+v", entries[0])
	}
	// Сид: самая свежая запись — отказ по заявке 4 (id журнала 2).
	if entries[0].ID != 2 || entries[0].Action != models.ActionReject {
		t.Errorf("свежая строка журнала: id %d, действие %q, ждали id 2 reject",
			entries[0].ID, entries[0].Action)
	}
	if entries[0].Reason == nil {
		t.Error("у отказа обязана быть типовая причина")
	}
}

func TestContentReportsOpenFirst(t *testing.T) {
	repo, _ := newModerationRepo(t)
	ctx := context.Background()

	all, total, err := repo.ContentReports(ctx, models.ReportFilter{Page: 1, Limit: 20})
	if err != nil {
		t.Fatalf("ContentReports: %v", err)
	}
	if total != 3 || len(all) != 3 {
		t.Fatalf("жалоб: total %d, строк %d, ждали 3", total, len(all))
	}
	if all[0].Status != models.ReportOpen {
		t.Errorf("первая жалоба со статусом %q, открытые должны быть выше", all[0].Status)
	}
	if all[0].CardTitle == nil || all[0].TargetExcerpt == nil {
		t.Errorf("открытая жалоба без подписи «на что»: %+v", all[0])
	}

	hidden, hiddenTotal, err := repo.ContentReports(ctx,
		models.ReportFilter{Status: models.ReportHidden, Page: 1, Limit: 20})
	if err != nil {
		t.Fatalf("ContentReports(hidden): %v", err)
	}
	if hiddenTotal != 1 || len(hidden) != 1 || hidden[0].HideReason == nil {
		t.Errorf("скрытых жалоб %d (total %d), причина скрытия %v",
			len(hidden), hiddenTotal, firstHideReason(hidden))
	}
}

func firstHideReason(reports []models.ContentReport) any {
	if len(reports) == 0 {
		return "нет строк"
	}
	return reports[0].HideReason
}
