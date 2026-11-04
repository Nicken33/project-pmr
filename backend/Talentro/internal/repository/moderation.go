package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"talentro/internal/models"
)

// ErrConflict — заявка уже обработана (§3.9.3). Повторное решение не создаёт
// вторую строку журнала и не переносит карточку; обработчик превращает это в
// 409, кроме идемпотентного повтора того же самого решения (см. DecideApplication).
var ErrConflict = errors.New("заявка уже обработана")

// accountQuery — роль берётся только из users.account_type (§8, табл. 8).
// Подстрока в письме, имя или тело запроса правом на кабинет не считают: §12.1.
const accountQuery = `
	SELECT id, name, email, account_type
	FROM users
	WHERE id = $1`

// AccountByID — учётная запись по id из подписанной сессии. ErrNotFound, если
// пользователя больше нет: кука живёт дольше удачной записи.
func (r *Repository) AccountByID(ctx context.Context, id int64) (models.Account, error) {
	var a models.Account
	err := r.db.QueryRowContext(ctx, accountQuery, id).Scan(&a.ID, &a.Name, &a.Email, &a.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return a, ErrNotFound
	}
	if err != nil {
		return a, fmt.Errorf("чтение учётной записи: %w", err)
	}
	return a, nil
}

// applicationColumns — список полей одной анкеты; FROM/JOIN — в applicationFrom,
// чтобы один и тот же срез служил и списку, и одиночной заявке.
const applicationColumns = `
	SELECT a.id, a.card_id, a.status, a.submitted_at, a.decided_at, a.reject_reason,
		a.created_at, a.updated_at, a.decided_by,
		c.slug, c.name, c.kind, c.status, c.description, c.format, c.lesson_type, c.phone,
		o.id, o.slug, o.name, o.type, oc.name,
		cat.name, cat.slug, p.name, p.slug,
		(SELECT count(*) FROM groups g WHERE g.card_id = c.id),
		(SELECT count(DISTINCT gl.location_id) FROM groups gl WHERE gl.card_id = c.id),
		moder.name`

// applicationFrom — заявка + карточка + организация + направление. Публичный
// GET /api/v1/activities/{slug} для превью не годится: он отдаёт только
// published (§9.3), а очередь как раз показывает то, что ещё не опубликовано.
const applicationFrom = `
	FROM moderation_applications a
	JOIN cards c ON c.id = a.card_id
	JOIN organizations o ON o.id = c.org_id
	LEFT JOIN cities oc ON oc.id = o.city_id
	LEFT JOIN categories cat ON cat.id = c.category_id
	LEFT JOIN categories p ON p.id = cat.parent_id
	LEFT JOIN users moder ON moder.id = a.decided_by`

// ModerationQueue — очередь заявок (§3.9.1). Пустой f.Status = «все статусы», а
// не «ничего» (§5.8, тот же приём, что у каталога).
//
// Порядок: сначала живые заявки, дольше всех ждёт — выше (§3.9.1); обработанные
// идут следом в порядке подачи, чтобы пагинация не менялась от решения к
// решению сильнее, чем это необходимо.
func (r *Repository) ModerationQueue(
	ctx context.Context, f models.ModerationQueueFilter,
) ([]models.ModerationApplication, int, error) {
	where := ""
	args := []any{}
	if f.Status != "" {
		where = " WHERE a.status = $1"
		args = append(args, f.Status)
	}

	listQuery := applicationColumns + applicationFrom + where + `
	ORDER BY (a.status = 'pending') DESC, a.submitted_at ASC NULLS LAST, a.id ASC
	LIMIT $` + strconv.Itoa(len(args)+1) + ` OFFSET $` + strconv.Itoa(len(args)+2)
	args = append(args, f.Limit, (f.Page-1)*f.Limit)

	rows, err := r.db.QueryContext(ctx, listQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("запрос очереди модерации: %w", err)
	}
	defer rows.Close()

	items := make([]models.ModerationApplication, 0, f.Limit)
	for rows.Next() {
		app, err := scanApplication(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("чтение заявки: %w", err)
		}
		items = append(items, app)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("обход заявок: %w", err)
	}

	total, err := r.countModerationApplications(ctx, f.Status)
	if err != nil {
		return nil, 0, err
	}

	if err := r.attachApplicationDetails(ctx, items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ApplicationByID — одна заявка тем же срезом, что и очередь: ответ на решение
// обязан совпадать по форме со списком, иначе клиент перерисует строку вслепую.
func (r *Repository) ApplicationByID(ctx context.Context, id int64) (*models.ModerationApplication, error) {
	row := r.db.QueryRowContext(ctx, applicationColumns+applicationFrom+" WHERE a.id = $1", id)
	app, err := scanApplication(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("чтение заявки %d: %w", id, err)
	}
	items := []models.ModerationApplication{app}
	if err := r.attachApplicationDetails(ctx, items); err != nil {
		return nil, err
	}
	return &items[0], nil
}

// countModerationApplications — total по той же where-секции (§9.4). У заявки
// свои join'ы не размножают строки, поэтому count без DISTINCT.
func (r *Repository) countModerationApplications(ctx context.Context, status string) (int, error) {
	query := `SELECT count(*) FROM moderation_applications a`
	args := []any{}
	if status != "" {
		query += " WHERE a.status = $1"
		args = append(args, status)
	}
	var total int
	if err := r.db.QueryRowContext(ctx, query, args...).Scan(&total); err != nil {
		return 0, fmt.Errorf("подсчёт заявок: %w", err)
	}
	return total, nil
}

// scanApplication читает строку в порядке applicationColumns. Пустые списки
// групп, точек и фото — [], а не null (§9): их добирает attachApplicationDetails.
func scanApplication(row rowScanner) (models.ModerationApplication, error) {
	var (
		app       models.ModerationApplication
		submitted sql.NullTime
		decided   sql.NullTime
		decidedBy sql.NullInt64
		reject    sql.NullString
		phone     sql.NullString
		descr     sql.NullString
		lesson    sql.NullString
		orgCity   sql.NullString
		catName   sql.NullString
		catSlug   sql.NullString
		superName sql.NullString
		superSlug sql.NullString
		moderName sql.NullString
	)

	err := row.Scan(
		&app.ID, &app.CardID, &app.Status, &submitted, &decided, &reject,
		&app.CreatedAt, &app.UpdatedAt, &decidedBy,
		&app.Slug, &app.Title, &app.Kind, &app.CardStatus, &descr, &app.Format, &lesson, &phone,
		&app.OrganizationID, &app.OrganizationSlug, &app.OrganizationName, &app.OrganizationType, &orgCity,
		&catName, &catSlug, &superName, &superSlug,
		&app.GroupsCount, &app.LocationsCount, &moderName,
	)
	if err != nil {
		return app, err
	}

	app.SubmittedAt = nullTimePtr(submitted)
	app.DecidedAt = nullTimePtr(decided)
	app.RejectReason = nullText(reject)
	app.Description = nullText(descr)
	app.LessonType = nullText(lesson)
	app.Phone = nullText(phone)
	app.OrganizationCity = nullText(orgCity)
	app.Category = nullText(catName)
	app.CategorySlug = nullText(catSlug)
	app.SuperCategory = nullText(superName)
	app.SuperCategorySlug = nullText(superSlug)
	if decidedBy.Valid {
		v := decidedBy.Int64
		app.DecidedByID = &v
	}
	app.DecidedBy = nullText(moderName)

	app.Groups = make([]models.Group, 0)
	app.Locations = make([]models.Location, 0)
	app.Photos = make([]string, 0)
	return app, nil
}

// rowScanner — общий интерфейс для *sql.Rows и *sql.Row, чтобы scanApplication
// читал и список, и одну строку.
type rowScanner interface {
	Scan(dest ...any) error
}

// attachApplicationDetails добирает группы, точки и фото одним запросом на
// страницу, а не по карточке (§3.9.1 требует превью со всеми группами и всеми
// точками; N+1 запрос на очередь из 20 анкет — это 60 round-trip'ов до базы).
func (r *Repository) attachApplicationDetails(ctx context.Context, items []models.ModerationApplication) error {
	if len(items) == 0 {
		return nil
	}

	cardIDs := make([]int64, len(items))
	byCard := make(map[int64]int, len(items))
	for i, app := range items {
		cardIDs[i] = app.CardID
		byCard[app.CardID] = i
	}

	groups, err := r.groupsByCards(ctx, cardIDs)
	if err != nil {
		return err
	}
	locations, err := r.locationsByCards(ctx, cardIDs)
	if err != nil {
		return err
	}
	photos, err := r.photosByCards(ctx, cardIDs)
	if err != nil {
		return err
	}

	for i := range items {
		id := items[i].CardID
		if g, ok := groups[id]; ok {
			items[i].Groups = g
		}
		if l, ok := locations[id]; ok {
			items[i].Locations = l
		}
		if p, ok := photos[id]; ok {
			items[i].Photos = p
		}
	}
	return nil
}

func (r *Repository) groupsByCards(ctx context.Context, cardIDs []int64) (map[int64][]models.Group, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT g.card_id, g.id, g.name, g.age_from, g.age_to, g.price_from, g.price_to,
			g.price_period, g.location_id, g.seats,
			s.weekday, s.time_from, s.time_to, s.note, s.seats
		FROM groups g
		LEFT JOIN schedules s ON s.group_id = g.id
		WHERE g.card_id = ANY($1)
		ORDER BY g.card_id, g.id, s.weekday, s.time_from`, cardIDs)
	if err != nil {
		return nil, fmt.Errorf("чтение групп заявок: %w", err)
	}
	defer rows.Close()

	out := make(map[int64][]models.Group)
	seen := make(map[groupKey]int)
	for rows.Next() {
		var (
			cardID, groupID int64
			g               models.Group
			name            sql.NullString
			ageFrom         sql.NullInt64
			ageTo           sql.NullInt64
			priceFrom       sql.NullInt64
			priceTo         sql.NullInt64
			period          sql.NullString
			seats           sql.NullInt64
			weekday         sql.NullInt64
			timeFrom        sql.NullTime
			timeTo          sql.NullTime
			note            sql.NullString
			schedSeats      sql.NullInt64
		)
		if err := rows.Scan(&cardID, &groupID, &name, &ageFrom, &ageTo, &priceFrom, &priceTo,
			&period, &g.LocationID, &seats,
			&weekday, &timeFrom, &timeTo, &note, &schedSeats); err != nil {
			return nil, fmt.Errorf("чтение строки группы заявки: %w", err)
		}

		key := groupKey{cardID: cardID, groupID: groupID}
		idx, ok := seen[key]
		if !ok {
			g.ID = groupID
			g.Name = nullText(name)
			g.AgeFrom = nullSmallInt(ageFrom)
			g.AgeTo = nullSmallInt(ageTo)
			g.PriceFrom = nullInt(priceFrom)
			g.PriceTo = nullInt(priceTo)
			g.PricePeriod = nullText(period)
			g.Seats = nullInt(seats)
			g.Schedules = make([]models.Lesson, 0)
			seen[key] = len(out[cardID])
			out[cardID] = append(out[cardID], g)
			continue
		}
		if weekday.Valid {
			out[cardID][idx].Schedules = append(out[cardID][idx].Schedules, models.Lesson{
				Weekday:  int(weekday.Int64),
				TimeFrom: timeOrEmpty(timeFrom),
				TimeTo:   timeOrEmpty(timeTo),
				Note:     nullText(note),
				Seats:    nullInt(schedSeats),
			})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход групп заявок: %w", err)
	}
	return out, nil
}

// groupKey — пара «карточка + группа»: расписания склеиваются по этой паре,
// потому что map по одному group_id смешал бы строки двух карточек, если
// когда-нибудь одна группа окажется привязана к двум.
type groupKey struct {
	cardID  int64
	groupID int64
}

func (r *Repository) locationsByCards(ctx context.Context, cardIDs []int64) (map[int64][]models.Location, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT DISTINCT gc.card_id, l.id, l.name, ci.name, d.name, l.address, l.lat, l.lng,
			l.phone, l.contacts_verified_at,
			(SELECT count(*) FROM groups gl WHERE gl.location_id = l.id AND gl.card_id = gc.card_id)
		FROM (SELECT DISTINCT card_id, location_id FROM groups WHERE card_id = ANY($1)) gc
		JOIN locations l ON l.id = gc.location_id AND l.is_active
		JOIN cities ci ON ci.id = l.city_id
		LEFT JOIN districts d ON d.id = l.district_id
		ORDER BY gc.card_id, l.id`, cardIDs)
	if err != nil {
		return nil, fmt.Errorf("чтение точек заявок: %w", err)
	}
	defer rows.Close()

	out := make(map[int64][]models.Location)
	for rows.Next() {
		var (
			cardID   int64
			l        models.Location
			name     sql.NullString
			district sql.NullString
			lat      sql.NullFloat64
			lng      sql.NullFloat64
			phone    sql.NullString
			verified sql.NullTime
		)
		if err := rows.Scan(&cardID, &l.ID, &name, &l.City, &district, &l.Address, &lat, &lng,
			&phone, &verified, &l.GroupsCount); err != nil {
			return nil, fmt.Errorf("чтение строки точки заявки: %w", err)
		}
		l.Name = nullText(name)
		l.District = nullText(district)
		l.Phone = nullText(phone)
		l.ContactsVerified = nullDate(verified)
		l.Photos = make([]models.Media, 0)
		if lat.Valid {
			v := lat.Float64
			l.Lat = &v
		}
		if lng.Valid {
			v := lng.Float64
			l.Lng = &v
		}
		out[cardID] = append(out[cardID], l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход точек заявок: %w", err)
	}
	return out, nil
}

func (r *Repository) photosByCards(ctx context.Context, cardIDs []int64) (map[int64][]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT entity_id, path
		FROM media
		WHERE entity = 'card' AND kind = 'photo' AND entity_id = ANY($1)
		ORDER BY entity_id, order_num, id`, cardIDs)
	if err != nil {
		return nil, fmt.Errorf("чтение фото заявок: %w", err)
	}
	defer rows.Close()

	out := make(map[int64][]string)
	for rows.Next() {
		var cardID int64
		var path string
		if err := rows.Scan(&cardID, &path); err != nil {
			return nil, fmt.Errorf("чтение строки фото заявки: %w", err)
		}
		out[cardID] = append(out[cardID], path)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход фото заявок: %w", err)
	}
	return out, nil
}

// journalEntrySelect — строка журнала с подписью «кто, что и где решил»
// (§3.9.4): без slug и названия карточки журнал остаётся списком чисел.
const journalEntrySelect = `
	SELECT j.id, j.application_id, j.card_id, c.slug, c.name, o.slug,
		j.actor_id, u.name, j.action, j.reason, j.comment, j.created_at
	FROM moderation_journal j
	JOIN cards c ON c.id = j.card_id
	JOIN organizations o ON o.id = c.org_id
	JOIN users u ON u.id = j.actor_id`

// ModerationJournal — журнал решений, свежие сверху (§3.9.4). Только чтение:
// ни один обработчик по этой таблице не делает UPDATE и DELETE.
func (r *Repository) ModerationJournal(
	ctx context.Context, f models.JournalFilter,
) ([]models.ModerationJournalEntry, int, error) {
	rows, err := r.db.QueryContext(ctx, journalEntrySelect+`
		ORDER BY j.created_at DESC, j.id DESC
		LIMIT $1 OFFSET $2`, f.Limit, (f.Page-1)*f.Limit)
	if err != nil {
		return nil, 0, fmt.Errorf("чтение журнала: %w", err)
	}
	defer rows.Close()

	entries := make([]models.ModerationJournalEntry, 0, f.Limit)
	for rows.Next() {
		e, err := scanJournalEntry(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("чтение строки журнала: %w", err)
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("обход журнала: %w", err)
	}

	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM moderation_journal`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("подсчёт строк журнала: %w", err)
	}
	return entries, total, nil
}

// reportColumns + reportFrom — срез жалобы вместе с карточкой и подписями.
// Один и тот же набор нужен очереди и одной жалобе после решения: ответ на
// решение обязан читаться как строка очереди, иначе фронт перерисует её вслепую.
const reportColumns = `
	SELECT rep.id, rep.target_type, rep.target_id, rep.target_excerpt, rep.reason, rep.detail,
		rep.status, rep.hide_reason, rep.reporter_id, rep.created_at, rep.updated_at,
		c.id, c.slug, c.name, reporter.name, moder.name`

const reportFrom = `
	FROM content_reports rep
	LEFT JOIN cards c ON c.id = rep.card_id
	LEFT JOIN users reporter ON reporter.id = rep.reporter_id
	LEFT JOIN users moder ON moder.id = rep.decided_by`

// ContentReports — вторая очередь модерации (§3.9.7). Открытые жалобы первыми,
// внутри — дольше всех ждут выше, как в очереди анкет.
func (r *Repository) ContentReports(
	ctx context.Context, f models.ReportFilter,
) ([]models.ContentReport, int, error) {
	where := ""
	args := []any{}
	if f.Status != "" {
		where = " WHERE rep.status = $1"
		args = append(args, f.Status)
	}

	listQuery := reportColumns + reportFrom + where + `
		ORDER BY (rep.status = 'open') DESC, rep.created_at ASC NULLS LAST, rep.id ASC
		LIMIT $` + strconv.Itoa(len(args)+1) + ` OFFSET $` + strconv.Itoa(len(args)+2)
	listArgs := append(append([]any{}, args...), f.Limit, (f.Page-1)*f.Limit)

	rows, err := r.db.QueryContext(ctx, listQuery, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("чтение жалоб: %w", err)
	}
	defer rows.Close()

	reports := make([]models.ContentReport, 0, f.Limit)
	for rows.Next() {
		rep, err := scanReport(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("чтение строки жалобы: %w", err)
		}
		reports = append(reports, rep)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("обход жалоб: %w", err)
	}

	totalQuery := `SELECT count(*) FROM content_reports rep`
	totalArgs := []any{}
	if f.Status != "" {
		totalQuery += " WHERE rep.status = $1"
		totalArgs = append(totalArgs, f.Status)
	}
	var total int
	if err := r.db.QueryRowContext(ctx, totalQuery, totalArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("подсчёт жалоб: %w", err)
	}
	return reports, total, nil
}

// ReportByID — одна жалоба тем же срезом, что и очередь.
func (r *Repository) ReportByID(ctx context.Context, id int64) (*models.ContentReport, error) {
	row := r.db.QueryRowContext(ctx, reportColumns+reportFrom+" WHERE rep.id = $1", id)
	rep, err := scanReport(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("чтение жалобы %d: %w", id, err)
	}
	return &rep, nil
}

// scanReport читает строку в порядке reportColumns.
func scanReport(row rowScanner) (models.ContentReport, error) {
	var (
		rep           models.ContentReport
		excerpt       sql.NullString
		detail        sql.NullString
		hideReason    sql.NullString
		reporterID    sql.NullInt64
		cardID        sql.NullInt64
		cardSlug      sql.NullString
		cardTitle     sql.NullString
		reporterName  sql.NullString
		moderatorName sql.NullString
	)
	if err := row.Scan(&rep.ID, &rep.TargetType, &rep.TargetID, &excerpt, &rep.Reason, &detail,
		&rep.Status, &hideReason, &reporterID, &rep.CreatedAt, &rep.UpdatedAt,
		&cardID, &cardSlug, &cardTitle, &reporterName, &moderatorName); err != nil {
		return rep, err
	}

	rep.TargetExcerpt = nullText(excerpt)
	rep.Detail = nullText(detail)
	rep.HideReason = nullText(hideReason)
	rep.ReporterID = nullInt64Ptr(reporterID)
	rep.ReporterName = nullText(reporterName)
	rep.DecidedBy = nullText(moderatorName)
	if cardID.Valid {
		rep.CardID = &cardID.Int64
		rep.CardSlug = nullText(cardSlug)
		rep.CardTitle = nullText(cardTitle)
	}
	return rep, nil
}

// DecideApplication — решение модератора одной транзакцией (§3.9.3, §3.9.6):
// заявка, статус карточки и строка журнала меняются вместе, иначе в очереди
// остаётся заявка без решения (или наоборот) — и обе ветки vitrine'ы расходятся.
//
// Идемпотентность: повтор ровно того же решения тем же модератором (та же
// собранная причина) ничего не пишет и отдаёт принятое состояние с Replayed=true.
// Любое другое повторное решение — ErrConflict: §3.9.4 запрещает переписывать
// журнал, а «одобрить то, что уже отклонено» — это новая заявка владельца.
//
// FOR UPDATE держит строку заявки до коммита: два модератора, нажавшие кнопку
// одновременно, не создадут две строки журнала.
func (r *Repository) DecideApplication(
	ctx context.Context, applicationID int64, actor models.Account, in models.DecisionInput,
) (models.DecisionResult, error) {
	target := models.ApplicationPending
	cardStatus := ""
	switch in.Action {
	case models.ActionApprove:
		target = models.ApplicationApproved
		cardStatus = "published"
	case models.ActionReject:
		target = models.ApplicationRejected
		cardStatus = "rejected"
	default:
		return models.DecisionResult{}, fmt.Errorf("неизвестное действие %q", in.Action)
	}
	note := decisionNote(in)

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return models.DecisionResult{}, fmt.Errorf("начать решение: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var (
		status    string
		cardID    int64
		decidedBy sql.NullInt64
		reason    sql.NullString
	)
	err = tx.QueryRowContext(ctx, `
		SELECT status, card_id, decided_by, reject_reason
		FROM moderation_applications
		WHERE id = $1
		FOR UPDATE`, applicationID).Scan(&status, &cardID, &decidedBy, &reason)
	if errors.Is(err, sql.ErrNoRows) {
		return models.DecisionResult{}, ErrNotFound
	}
	if err != nil {
		return models.DecisionResult{}, fmt.Errorf("чтение заявки: %w", err)
	}

	if status != models.ApplicationPending {
		sameDecision := status == target && decidedBy.Int64 == actor.ID && reason.String == note
		if !sameDecision {
			return models.DecisionResult{}, ErrConflict
		}
		if err := tx.Commit(); err != nil {
			return models.DecisionResult{}, fmt.Errorf("закрыть повтор решения: %w", err)
		}
		return r.replayDecision(ctx, applicationID)
	}

	var res sql.Result
	if target == models.ApplicationApproved {
		res, err = tx.ExecContext(ctx, `
			UPDATE moderation_applications
			SET status = $2, decided_by = $3, decided_at = now(), reject_reason = NULL,
				updated_at = now()
			WHERE id = $1 AND status = 'pending'`, applicationID, target, actor.ID)
	} else {
		res, err = tx.ExecContext(ctx, `
			UPDATE moderation_applications
			SET status = $2, decided_by = $3, decided_at = now(), reject_reason = $4,
				updated_at = now()
			WHERE id = $1 AND status = 'pending'`, applicationID, target, actor.ID, nilIfBlank(note))
	}
	if err != nil {
		return models.DecisionResult{}, fmt.Errorf("решение по заявке: %w", err)
	}
	// Условие status = 'pending' внутри UPDATE — второй слой защиты: если между
	// чтением и записью заявку закрыл другой процесс, пострадает 0 строк.
	if affected, err := res.RowsAffected(); err != nil {
		return models.DecisionResult{}, fmt.Errorf("число обновлённых заявок: %w", err)
	} else if affected != 1 {
		return models.DecisionResult{}, ErrConflict
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE cards
		SET status = $2, reject_reason = $3, updated_at = now()
		WHERE id = $1`, cardID, cardStatus, nilIfBlank(note)); err != nil {
		return models.DecisionResult{}, fmt.Errorf("статус карточки: %w", err)
	}

	var entryID int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO moderation_journal
			(application_id, card_id, actor_id, action, reason, comment)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`,
		applicationID, cardID, actor.ID, in.Action, nilIfBlank(in.Reason), nilIfBlank(in.Comment),
	).Scan(&entryID)
	if err != nil {
		return models.DecisionResult{}, fmt.Errorf("запись в журнал: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return models.DecisionResult{}, fmt.Errorf("зафиксировать решение: %w", err)
	}

	app, err := r.ApplicationByID(ctx, applicationID)
	if err != nil {
		return models.DecisionResult{}, err
	}
	entry, err := r.journalEntryOf(ctx, entryID)
	if err != nil {
		return models.DecisionResult{}, err
	}
	return models.DecisionResult{
		Application: app,
		Entry:       entry,
		Replayed:    false,
	}, nil
}

// replayDecision — состояние уже принятого решения для идемпотентного повтора.
func (r *Repository) replayDecision(ctx context.Context, applicationID int64) (models.DecisionResult, error) {
	app, err := r.ApplicationByID(ctx, applicationID)
	if err != nil {
		return models.DecisionResult{}, err
	}

	e, err := r.journalEntryByApplication(ctx, applicationID)
	if errors.Is(err, sql.ErrNoRows) {
		// Решенная заявка без строки журнала возможна только если сид
		// недобит; отвечать 500 из-за этого нечем — отдаём заявку без записи.
		return models.DecisionResult{Application: app, Replayed: true}, nil
	}
	if err != nil {
		return models.DecisionResult{}, err
	}
	return models.DecisionResult{Application: app, Entry: e, Replayed: true}, nil
}

// journalEntryByApplication — последняя запись журнала по заявке.
func (r *Repository) journalEntryByApplication(
	ctx context.Context, applicationID int64,
) (*models.ModerationJournalEntry, error) {
	row := r.db.QueryRowContext(ctx, journalEntrySelect+`
		WHERE j.application_id = $1
		ORDER BY j.id DESC
		LIMIT 1`, applicationID)
	e, err := scanJournalEntry(row)
	if err != nil {
		return nil, fmt.Errorf("чтение строки журнала заявки: %w", err)
	}
	return &e, nil
}

// journalEntryOf достраивает строку журнала после коммита: решение обязано
// возвращаться в том же формате, что и GET .../journal, иначе кабинет вставит
// в список неполную строку.
func (r *Repository) journalEntryOf(ctx context.Context, id int64) (*models.ModerationJournalEntry, error) {
	row := r.db.QueryRowContext(ctx, journalEntrySelect+`
		WHERE j.id = $1`, id)
	e, err := scanJournalEntry(row)
	if err != nil {
		return nil, fmt.Errorf("чтение записи журнала %d: %w", id, err)
	}
	return &e, nil
}

// scanJournalEntry читает строку в порядке journalEntrySelect.
func scanJournalEntry(row rowScanner) (models.ModerationJournalEntry, error) {
	var (
		e       models.ModerationJournalEntry
		reason  sql.NullString
		comment sql.NullString
	)
	if err := row.Scan(&e.ID, &e.ApplicationID, &e.CardID, &e.CardSlug, &e.CardTitle,
		&e.OrganizationSlug, &e.ActorID, &e.ActorName, &e.Action, &reason, &comment, &e.CreatedAt); err != nil {
		return e, err
	}
	e.Reason = nullText(reason)
	e.Comment = nullText(comment)
	return e, nil
}

// DecideReport — решение по жалобе (§3.9.7): статус, причина скрытия и подпись
// модератора в одной транзакции.
//
// Строку в moderation_journal здесь не пишем сознательно: §3.9.4 закрепляет
// append-only за решениями каталога, а жалоба в §8 таблица 16 хранит только
// последнее решение (decided_by, decided_at). Отсюда и другое правило повторов:
// «скрыть», а затем «оставить» — это законная отмена решения, а не конфликт;
// повтор того же решения ничего не меняет, кроме отметки времени.
func (r *Repository) DecideReport(
	ctx context.Context, reportID int64, actor models.Account, in models.ReportDecisionInput,
) (*models.ContentReport, error) {
	target, reason := "", ""
	switch in.Action {
	case models.ActionHide:
		target, reason = models.ReportHidden, in.Reason
	case models.ActionDismiss:
		target = models.ReportDismissed
	default:
		return nil, fmt.Errorf("неизвестное действие %q", in.Action)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("начать решение по жалобе: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var status string
	err = tx.QueryRowContext(ctx, `
		SELECT status FROM content_reports WHERE id = $1 FOR UPDATE`, reportID).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("чтение жалобы: %w", err)
	}

	// CHECK content_reports_hidden_has_reason не примет «скрыть без причины», а
	// «оставить» обязан сбросить старую причину — иначе скрытый пункт §12.15
	// переживает собственное снятие.
	res, err := tx.ExecContext(ctx, `
		UPDATE content_reports
		SET status = $2, hide_reason = $3, decided_by = $4, decided_at = now(), updated_at = now()
		WHERE id = $1`, reportID, target, nilIfBlank(reason), actor.ID)
	if err != nil {
		return nil, fmt.Errorf("решение по жалобе: %w", err)
	}
	if affected, err := res.RowsAffected(); err != nil {
		return nil, fmt.Errorf("число обновлённых жалоб: %w", err)
	} else if affected != 1 {
		return nil, ErrNotFound
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("зафиксировать решение по жалобе: %w", err)
	}
	return r.ReportByID(ctx, reportID)
}

// decisionNote — то, что увидит владелец (§3.9.3): типовая причина плюс свободный
// текст одной строкой. Пустая строка означает «причины нет» и уходит в NULL.
func decisionNote(in models.DecisionInput) string {
	switch {
	case in.Reason != "" && in.Comment != "":
		return in.Reason + " " + in.Comment
	default:
		return strings.TrimSpace(in.Reason + in.Comment)
	}
}

func nilIfBlank(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func nullTimePtr(t sql.NullTime) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}

func nullInt64Ptr(v sql.NullInt64) *int64 {
	if !v.Valid {
		return nil
	}
	n := v.Int64
	return &n
}
