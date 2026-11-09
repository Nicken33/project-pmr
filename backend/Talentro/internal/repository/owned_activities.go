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

// Кабинет владельца (§3.8) на канонической схеме §7: карточки живут в cards,
// организации в organizations, а подача анкеты — в moderation_applications.
// Никакой второй очереди и никаких таблиц «v2» здесь нет: заявка, созданная
// SubmitOwnedCard, читается тем же ModerationQueue (см. moderation.go), поэтому
// модератор видит её в /api/v1/moderation/queue без единой правки того среза.
//
// Право всюду проверяется в самом запросе (owner_id = id из сессии), а не в
// обработчике по телу: подделать владельца письмом нельзя (§12.1).

// Отказы кабинета. Разделены намеренно: «карточки нет» (404), «карточка чужая»
// (403), «роль не того вида» (403) и «организации нет» (404) — разные ответы
// клиенту, и слеплять их в один ErrNotFound значило бы врать владельцу.
var (
	ErrCardNotOwned        = errors.New("карточка принадлежит другому владельцу")
	ErrKindMismatch        = errors.New("вид карточки не соответствует роли владельца")
	ErrOrgNotOwned         = errors.New("организация принадлежит другому владельцу")
	ErrNoOwnerOrganization = errors.New("у владельца нет организации")
	ErrCategoryUnknown     = errors.New("направление не найдено")
	ErrCategoryKind        = errors.New("направление не подходит для этого вида карточки")
	ErrCityUnknown         = errors.New("город не найден")
)

// CardAction — действие владельца над карточкой. Нужно, чтобы отказ по статусу
// объяснял именно то, что человек нажал, а не «нельзя» вообще.
type CardAction string

const (
	CardActionSubmit    CardAction = "submit"
	CardActionUpdate    CardAction = "update"
	CardActionUnpublish CardAction = "unpublish"
)

// CardStatusError — переход запрещён текущим статусом карточки (§8, табл. 1).
// Обработчик превращает его в 409 с честным сообщением: повторная подача анкеты,
// которая уже на проверке, не «успех молча», а отказ с объяснением.
type CardStatusError struct {
	Status string
	Action CardAction
}

func (e *CardStatusError) Error() string {
	return fmt.Sprintf("действие %s недоступно для карточки в статусе %s", e.Action, e.Status)
}

// ownedCardColumns — порядок колонок ровно как у scanCard (catalog.go). Список
// дублирует каталог сознательно: тот объявлен внутри SearchCards и наружу не
// отдан, а править чужой срез ради кабинета значило бы задеть витрину. Отличие
// одно — COALESCE(ci.name, ”): у черновика может не быть ни группы, ни точки, и
// город тогда пустой строкой, а не NULL (Card.City — string).
const ownedCardColumns = `
	c.id AS card_id,
	c.slug AS card_slug,
	c.name AS card_name,
	c.kind AS card_kind,
	c.description AS card_description,
	c.status AS card_status,
	c.format AS card_format,
	c.lesson_type AS card_lesson_type,
	c.updated_at AS card_updated_at,
	COALESCE(c.contacts_verified_at >= current_date - 90, false) AS card_verified,
	c.contacts_verified_at AS card_verified_at,
	o.id AS org_id,
	o.slug AS org_slug,
	o.name AS org_name,
	o.type AS org_type,
	o.phone AS org_phone,
	o.site AS org_site,
	cat.id AS category_id,
	cat.name AS category_name,
	cat.slug AS category_slug,
	p.name AS super_name,
	p.slug AS super_slug,
	g.id AS group_id,
	g.name AS group_name,
	g.age_from AS age_from,
	g.age_to AS age_to,
	g.price_from AS price_from,
	g.price_to AS price_to,
	g.price_period AS price_period,
	g.seats AS group_seats,
	l.id AS location_id,
	l.name AS location_name,
	l.address AS location_address,
	l.lat AS location_lat,
	l.lng AS location_lng,
	COALESCE(ci.name, '') AS city_name,
	d.name AS district_name,
	(SELECT count(*) FROM groups gc WHERE gc.card_id = c.id) AS groups_count,
	(SELECT count(DISTINCT gl.location_id) FROM groups gl WHERE gl.card_id = c.id) AS locations_count,
	(SELECT m.path FROM media m
		WHERE m.entity = 'card' AND m.entity_id = c.id AND m.kind = 'photo'
		ORDER BY m.order_num, m.id LIMIT 1) AS photo_path`

// ownedCardFrom — LEFT JOIN на группы и точки: владелец обязан видеть карточку,
// у которой их ещё нет. organizations и categories — NOT NULL внешние ключи
// cards, поэтому по ним JOIN, как в каталоге.
const ownedCardFrom = `
	FROM cards c
	JOIN organizations o ON o.id = c.org_id
	JOIN categories cat ON cat.id = c.category_id
	LEFT JOIN categories p ON p.id = cat.parent_id
	LEFT JOIN groups g ON g.card_id = c.id
	LEFT JOIN locations l ON l.id = g.location_id
	LEFT JOIN cities ci ON ci.id = l.city_id
	LEFT JOIN districts d ON d.id = l.district_id`

// ownedLockQuery — дешёвая проверка прав и статуса перед любым действием.
// FOR UPDATE добавляется вызывающим внутри транзакции.
const ownedLockQuery = `
	SELECT owner_id, kind, status, org_id
	FROM cards
	WHERE id = $1`

// OwnedCards — список своих карточек (§9.4). Вид приходит от роли, статус —
// необязательный фильтр; is_active и status здесь НЕ фильтруются: снятую с
// публикации карточку владелец должен видеть, иначе он не сможет подать её снова.
func (r *Repository) OwnedCards(
	ctx context.Context, ownerID int64, f models.OwnedCardsFilter,
) ([]models.OwnedCard, int, error) {
	conds := []string{"c.owner_id = $1", "c.kind = $2"}
	args := []any{ownerID, f.Kind}
	if f.Status != "" {
		args = append(args, f.Status)
		conds = append(conds, "c.status = $"+strconv.Itoa(len(args)))
	}
	where := " WHERE " + strings.Join(conds, " AND ")

	// Условия ссылаются только на cards, поэтому подсчёт идёт без join'ов:
	// группы и точки не размножают строки и не меняют total.
	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT count(*) FROM cards c"+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("подсчёт карточек владельца: %w", err)
	}

	listArgs := append(append([]any{}, args...), f.Limit, (f.Page-1)*f.Limit)
	listQuery := fmt.Sprintf(`
		SELECT *
		FROM (
			SELECT DISTINCT ON (c.id)%s
			%s%s
			ORDER BY c.id, %s
		) t
		ORDER BY t.card_updated_at DESC, t.card_id DESC
		LIMIT $%d OFFSET $%d`,
		ownedCardColumns, ownedCardFrom, where, groupPreference(models.CardFilter{}),
		len(args)+1, len(args)+2)

	cards, err := r.ownedCardRows(ctx, listQuery, listArgs)
	if err != nil {
		return nil, 0, err
	}

	items := make([]models.OwnedCard, 0, len(cards))
	if len(cards) == 0 {
		return items, total, nil
	}
	ids := make([]int64, 0, len(cards))
	for _, c := range cards {
		id, err := strconv.ParseInt(c.ID, 10, 64)
		if err != nil {
			return nil, 0, fmt.Errorf("id карточки владельца: %w", err)
		}
		ids = append(ids, id)
	}
	extras, err := r.ownedExtras(ctx, ids)
	if err != nil {
		return nil, 0, err
	}
	for _, c := range cards {
		id, _ := strconv.ParseInt(c.ID, 10, 64)
		items = append(items, withOwnedExtras(c, extras[id]))
	}
	return items, total, nil
}

// OwnedCardByID — своя карточка целиком в форме §9.3. Публичный ActivityBySlug
// для этого не годится: он требует status='published' AND is_active, а кабинет
// показывает и черновик, и отказ, и анкету на проверке.
func (r *Repository) OwnedCardByID(
	ctx context.Context, ownerID, cardID int64, kind string,
) (*models.OwnedActivity, error) {
	card, err := r.ownedCard(ctx, ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}

	out := &models.OwnedActivity{OwnedCard: card}
	if out.Organization, err = r.organizationByID(ctx, card.OrganizationID); err != nil {
		return nil, err
	}
	// Вложенные срезы — та же форма, что у публичной детали: имена полей и
	// расписание не должны расходиться между кабинетом и витриной. Медиа —
	// отдельный запрос кабинета: он добавляет m.id, нужный для удаления, а
	// публичный activityMedia (activity.go) ради этого не меняется.
	if out.Locations, err = r.activityLocations(cardID); err != nil {
		return nil, err
	}
	if out.Groups, err = r.activityGroups(cardID); err != nil {
		return nil, err
	}
	if out.Photos, out.Videos, err = r.ownedActivityMedia(ctx, cardID); err != nil {
		return nil, err
	}

	// Первая точка и первая группа — как в ActivityBySlug: старые клиенты
	// /api/cards ждут город, координаты, возраст и цену на верхнем уровне.
	if len(out.Locations) > 0 {
		loc := out.Locations[0]
		out.City = loc.City
		out.District = loc.District
		out.Address = &loc.Address
		out.Lat = loc.Lat
		out.Lng = loc.Lng
		out.LocationID = &loc.ID
		out.LocationName = loc.Name
	}
	if len(out.Groups) > 0 {
		g := out.Groups[0]
		out.GroupID = &g.ID
		out.GroupName = g.Name
		out.Age.MinAge = g.AgeFrom
		out.Age.MaxAge = g.AgeTo
		out.Price = g.PriceFrom
		out.PriceTo = g.PriceTo
		out.PricePeriod = g.PricePeriod
		out.Seats = g.Seats
	}
	return out, nil
}

// CreateOwnedCard — новая карточка владельца. Статус всегда draft, is_active
// всегда TRUE, owner_id всегда из аргумента (его передаёт обработчик из сессии):
// ни одно из этих полей не приходит из тела запроса.
//
// Slug строит сервер. Адрес обязан быть UNIQUE и NOT NULL уже при вставке, а
// окончательный вид зависит от id, который выдаёт та же вставка. Поэтому вставка
// идёт с временным адресом из md5(random()::text), а окончательный ставится в
// той же транзакции: снаружи временное значение не видно ни на миллисекунду, и
// состояние последовательности cards при этом не предполагается.
func (r *Repository) CreateOwnedCard(
	ctx context.Context, ownerID int64, in models.OwnedCardInput,
) (*models.OwnedCard, error) {
	orgID, err := r.resolveOwnedOrg(ctx, ownerID, in.OrgID)
	if err != nil {
		return nil, err
	}
	if err := r.checkCategory(ctx, *in.CategoryID, in.Kind); err != nil {
		return nil, err
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("начать создание карточки: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var id int64
	err = tx.QueryRowContext(ctx, `
		INSERT INTO cards
			(slug, name, description, org_id, kind, category_id,
			 lesson_type, format, phone, status, owner_id, is_active)
		VALUES ('draft-' || md5(random()::text || clock_timestamp()::text),
			$1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, TRUE)
		RETURNING id`,
		in.Name, ownedText(in.Description), orgID, in.Kind, *in.CategoryID,
		ownedText(in.LessonType), in.Format, ownedText(in.Phone), ownerID,
	).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("создание карточки: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `UPDATE cards SET slug = $2 WHERE id = $1`,
		id, ownedCardSlug(in.Name, id)); err != nil {
		return nil, fmt.Errorf("адрес карточки: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("зафиксировать карточку: %w", err)
	}

	out, err := r.ownedCard(ctx, ownerID, id, in.Kind)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// UpdateOwnedCard — правка своей карточки. Разрешена только в draft и rejected:
// анкету, которую прямо сейчас смотрит модератор, подменить нельзя, а
// опубликованную сначала снимают с публикации (§3.8.6). Slug и org_id не
// меняются: публичный адрес и принадлежность организации — не самообслуживание.
func (r *Repository) UpdateOwnedCard(
	ctx context.Context, ownerID, cardID int64, kind string, in models.OwnedCardInput,
) (*models.OwnedCard, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("начать правку карточки: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	status, orgID, err := lockOwnedCardTx(ctx, tx, ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	if status != models.CardStatusDraft && status != models.CardStatusRejected {
		return nil, &CardStatusError{Status: status, Action: CardActionUpdate}
	}
	if in.OrgID != nil && *in.OrgID != orgID {
		return nil, ErrOrgNotOwned
	}
	if err := r.checkCategory(ctx, *in.CategoryID, kind); err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE cards
		SET name = $2, description = $3, category_id = $4, format = $5,
			lesson_type = $6, phone = $7, updated_at = now()
		WHERE id = $1`,
		cardID, in.Name, ownedText(in.Description), *in.CategoryID, in.Format,
		ownedText(in.LessonType), ownedText(in.Phone)); err != nil {
		return nil, fmt.Errorf("правка карточки: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("зафиксировать правку: %w", err)
	}

	out, err := r.ownedCard(ctx, ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// SubmitOwnedCard — подача анкеты на проверку (§3.8 → §3.9.1).
//
// Одна транзакция: блокировка строки карточки, заявка в moderation_applications
// и переход cards.status. Заявка создаётся со status='pending', submitted_by =
// владелец и submitted_at = now() — ровно то, что требует CHECK
// moderation_applications_has_submission_date и что читает ModerationQueue
// (moderation.go:92). Отдельной «очереди владельца» нет и не нужно.
//
// is_active возвращается в TRUE: карточку могли снять с публикации, и без этого
// одобренная модератором анкета осталась бы невидимой в каталоге (catalog.go
// требует и status='published', и c.is_active).
func (r *Repository) SubmitOwnedCard(
	ctx context.Context, ownerID, cardID int64, kind string,
) (*models.OwnedSubmitResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("начать подачу анкеты: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	status, _, err := lockOwnedCardTx(ctx, tx, ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	if status != models.CardStatusDraft && status != models.CardStatusRejected {
		return nil, &CardStatusError{Status: status, Action: CardActionSubmit}
	}

	// Второй слой того же правила: частичный уникальный индекс
	// moderation_applications_pending_once не даст двум живым заявкам сосуществовать,
	// но владелец должен получить 409 с объяснением, а не 500 из индекса.
	var pending int
	if err := tx.QueryRowContext(ctx, `
		SELECT count(*) FROM moderation_applications
		WHERE card_id = $1 AND status = 'pending'`, cardID).Scan(&pending); err != nil {
		return nil, fmt.Errorf("проверка живой заявки: %w", err)
	}
	if pending > 0 {
		return nil, &CardStatusError{Status: models.CardStatusOnModeration, Action: CardActionSubmit}
	}

	var (
		applicationID int64
		submittedAt   time.Time
	)
	err = tx.QueryRowContext(ctx, `
		INSERT INTO moderation_applications (card_id, status, submitted_by, submitted_at)
		VALUES ($1, 'pending', $2, now())
		RETURNING id, submitted_at`, cardID, ownerID).Scan(&applicationID, &submittedAt)
	if err != nil {
		return nil, fmt.Errorf("создание заявки на проверку: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE cards
		SET status = 'on_moderation', reject_reason = NULL, is_active = TRUE, updated_at = now()
		WHERE id = $1`, cardID); err != nil {
		return nil, fmt.Errorf("статус карточки при подаче: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("зафиксировать подачу: %w", err)
	}

	card, err := r.ownedCard(ctx, ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	return &models.OwnedSubmitResult{
		Card: card, ApplicationID: applicationID, SubmittedAt: submittedAt,
	}, nil
}

// UnpublishOwnedCard — снятие с публикации (§7.18): published → draft и
// is_active = FALSE. Оба условия сразу, потому что каталог требует оба
// (catalog.go, cardWhere: c.status='published' AND c.is_active AND o.is_active
// AND l.is_active) — карточка исчезает из выдачи и из /api/v1/activities/{slug}.
func (r *Repository) UnpublishOwnedCard(
	ctx context.Context, ownerID, cardID int64, kind string,
) (*models.OwnedCard, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("начать снятие с публикации: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	status, _, err := lockOwnedCardTx(ctx, tx, ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	if status != models.CardStatusPublished {
		return nil, &CardStatusError{Status: status, Action: CardActionUnpublish}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE cards
		SET status = 'draft', is_active = FALSE, updated_at = now()
		WHERE id = $1`, cardID); err != nil {
		return nil, fmt.Errorf("снятие с публикации: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("зафиксировать снятие с публикации: %w", err)
	}

	out, err := r.ownedCard(ctx, ownerID, cardID, kind)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// ownedOrganizationColumns — организация целиком, включая то, что публичная
// страница не показывает: основание публикации, владельца и активность.
const ownedOrganizationColumns = `
	SELECT o.id, o.slug, o.name, o.type, o.description, o.phone, o.email, o.site,
		o.address, oc.name, o.contacts_verified_at,
		o.city_id, o.lat, o.lng, o.owner_id, o.publish_basis, o.is_active,
		o.created_at, o.updated_at
	FROM organizations o
	LEFT JOIN cities oc ON oc.id = o.city_id`

// OwnedOrganization — организация, у которой owner_id = вызывающий. ErrNotFound,
// если такой нет: кабинет не создаёт организацию сам, основание публикации
// (§11.8) заводится модератором.
func (r *Repository) OwnedOrganization(ctx context.Context, ownerID int64) (*models.OwnedOrganization, error) {
	// LIMIT 1 и порядок по id: схема допускает несколько организаций у одного
	// владельца, и кабинет обязан показывать одну и ту же, а не какую попало.
	row := r.db.QueryRowContext(ctx, ownedOrganizationColumns+`
		WHERE o.owner_id = $1
		ORDER BY o.id
		LIMIT 1`, ownerID)
	org, err := scanOwnedOrganization(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("чтение организации владельца: %w", err)
	}
	return org, nil
}

// UpdateOwnedOrganization — правка редактируемых полей своей организации.
// slug, owner_id, publish_basis, contacts_verified_at и is_active в SET не
// попадают вовсе: даже подделанный запрос не может их переписать.
func (r *Repository) UpdateOwnedOrganization(
	ctx context.Context, ownerID int64, in models.OwnedOrganizationInput,
) (*models.OwnedOrganization, error) {
	org, err := r.OwnedOrganization(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	if in.CityID != nil {
		if err := r.checkCity(ctx, *in.CityID); err != nil {
			return nil, err
		}
	}

	// WHERE по id И по owner_id: между чтением и записью организацию могли
	// передать другому, и тогда правка не должна пройти.
	res, err := r.db.ExecContext(ctx, `
		UPDATE organizations
		SET name = $3, type = $4, description = $5, phone = $6, email = $7,
			site = $8, address = $9, city_id = $10, lat = $11, lng = $12,
			updated_at = now()
		WHERE id = $1 AND owner_id = $2`,
		org.ID, ownerID, in.Name, in.Type, ownedText(in.Description), in.Phone,
		ownedText(in.Email), ownedText(in.Site), ownedText(in.Address),
		ownedInt64(in.CityID), ownedFloat(in.Lat), ownedFloat(in.Lng))
	if err != nil {
		return nil, fmt.Errorf("правка организации: %w", err)
	}
	if affected, err := res.RowsAffected(); err != nil {
		return nil, fmt.Errorf("число обновлённых организаций: %w", err)
	} else if affected != 1 {
		return nil, ErrOrgNotOwned
	}

	return r.OwnedOrganization(ctx, ownerID)
}

// organizationByID — организация для детали карточки. Без фильтра is_active:
// владелец видит свою организацию и тогда, когда модератор её скрыл, иначе он
// не поймёт, почему карточки пропали из каталога.
func (r *Repository) organizationByID(ctx context.Context, orgID int64) (*models.Organization, error) {
	var (
		org      models.Organization
		descr    sql.NullString
		email    sql.NullString
		site     sql.NullString
		address  sql.NullString
		city     sql.NullString
		verified sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT o.id, o.slug, o.name, o.type, o.description, o.phone, o.email, o.site,
			o.address, oc.name, o.contacts_verified_at
		FROM organizations o
		LEFT JOIN cities oc ON oc.id = o.city_id
		WHERE o.id = $1`, orgID).
		Scan(&org.ID, &org.Slug, &org.Name, &org.Type, &descr, &org.Phone,
			&email, &site, &address, &city, &verified)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("чтение организации карточки: %w", err)
	}
	org.Description = nullText(descr)
	org.Email = nullText(email)
	org.Site = nullText(site)
	org.Address = nullText(address)
	org.City = nullText(city)
	org.ContactsVerified = nullDate(verified)
	return &org, nil
}

// ownedActivityMedia — медиа детали кабинета. Тот же срез и порядок, что у
// публичного activityMedia (activity.go), плюс m.id: кабинет удаляет строку по
// id (DELETE …/media/{mediaID}), а публичная форма id не показывает. Отдельный
// запрос, а не правка общего: контракт витрины photos[]/videos[] не меняется.
func (r *Repository) ownedActivityMedia(ctx context.Context, cardID int64) (photos, videos []models.OwnedMedia, err error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, kind, path, caption, source_url, author, order_num
		FROM media
		WHERE entity = 'card' AND entity_id = $1
		ORDER BY kind, order_num, id`, cardID)
	if err != nil {
		return nil, nil, fmt.Errorf("чтение медиа кабинета: %w", err)
	}
	defer rows.Close()

	photos = make([]models.OwnedMedia, 0)
	videos = make([]models.OwnedMedia, 0)
	for rows.Next() {
		var (
			kind    string
			m       models.OwnedMedia
			caption sql.NullString
			source  sql.NullString
			author  sql.NullString
		)
		if err := rows.Scan(&m.ID, &kind, &m.Path, &caption, &source, &author, &m.Order); err != nil {
			return nil, nil, fmt.Errorf("чтение строки медиа кабинета: %w", err)
		}
		m.Caption, m.Source, m.Author = nullText(caption), nullText(source), nullText(author)
		if kind == models.MediaKindVideo {
			videos = append(videos, m)
		} else {
			photos = append(photos, m)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("обход медиа кабинета: %w", err)
	}
	return photos, videos, nil
}

// ownedCard — одна своя карточка. Сначала дешёвая проверка прав (иначе 404 и 403
// неразличимы: запрос с owner_id в WHERE не вернул бы строку в обоих случаях),
// затем полный срез каталога плюс поля владельца.
func (r *Repository) ownedCard(
	ctx context.Context, ownerID, cardID int64, kind string,
) (models.OwnedCard, error) {
	if _, _, err := r.lockOwnedCard(ctx, ownerID, cardID, kind); err != nil {
		return models.OwnedCard{}, err
	}

	query := fmt.Sprintf(`
		SELECT *
		FROM (
			SELECT DISTINCT ON (c.id)%s
			%s
			WHERE c.owner_id = $1 AND c.kind = $2 AND c.id = $3
			ORDER BY c.id, %s
		) t`, ownedCardColumns, ownedCardFrom, groupPreference(models.CardFilter{}))

	cards, err := r.ownedCardRows(ctx, query, []any{ownerID, kind, cardID})
	if err != nil {
		return models.OwnedCard{}, err
	}
	if len(cards) == 0 {
		return models.OwnedCard{}, ErrNotFound
	}
	extras, err := r.ownedExtras(ctx, []int64{cardID})
	if err != nil {
		return models.OwnedCard{}, err
	}
	return withOwnedExtras(cards[0], extras[cardID]), nil
}

func (r *Repository) ownedCardRows(ctx context.Context, query string, args []any) ([]models.Card, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("запрос карточек владельца: %w", err)
	}
	defer rows.Close()

	cards := make([]models.Card, 0)
	for rows.Next() {
		card, err := scanCard(rows)
		if err != nil {
			return nil, fmt.Errorf("чтение карточки владельца: %w", err)
		}
		cards = append(cards, card)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход карточек владельца: %w", err)
	}
	return cards, nil
}

// ownedCardExtras — поля карточки, которых нет в срезе каталога: владелец,
// активность, причина отказа и дата создания. Отдельным запросом, а не join'ом:
// join размножил бы строки DISTINCT ON, а причина отказа — текст произвольной
// длины, и тащить её в каждую строку списка незачем.
type ownedCardExtras struct {
	OwnerID      *int64
	IsActive     bool
	RejectReason *string
	CreatedAt    time.Time
}

func (r *Repository) ownedExtras(ctx context.Context, ids []int64) (map[int64]ownedCardExtras, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, owner_id, is_active, reject_reason, created_at
		FROM cards
		WHERE id = ANY($1)`, ids)
	if err != nil {
		return nil, fmt.Errorf("чтение полей владельца: %w", err)
	}
	defer rows.Close()

	out := make(map[int64]ownedCardExtras, len(ids))
	for rows.Next() {
		var (
			id     int64
			owner  sql.NullInt64
			reason sql.NullString
			e      ownedCardExtras
		)
		if err := rows.Scan(&id, &owner, &e.IsActive, &reason, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("чтение строки полей владельца: %w", err)
		}
		if owner.Valid {
			v := owner.Int64
			e.OwnerID = &v
		}
		e.RejectReason = nullText(reason)
		out[id] = e
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("обход полей владельца: %w", err)
	}
	return out, nil
}

func withOwnedExtras(card models.Card, e ownedCardExtras) models.OwnedCard {
	return models.OwnedCard{
		Card:         card,
		OwnerID:      e.OwnerID,
		IsActive:     e.IsActive,
		RejectReason: e.RejectReason,
		CreatedAt:    e.CreatedAt,
	}
}

// lockOwnedCard — права и статус до любого действия. Порядок отказов важен:
// сначала «не найден» (404), затем «чужая» (403), затем «не тот вид» (403).
func (r *Repository) lockOwnedCard(
	ctx context.Context, ownerID, cardID int64, kind string,
) (status string, orgID int64, err error) {
	return scanOwnedLock(r.db.QueryRowContext(ctx, ownedLockQuery, cardID), ownerID, kind)
}

// lockOwnedCardTx — то же самое, но с FOR UPDATE: два одновременных нажатия
// «подать» не создадут две заявки и не разойдутся в статусе.
func lockOwnedCardTx(
	ctx context.Context, tx *sql.Tx, ownerID, cardID int64, kind string,
) (status string, orgID int64, err error) {
	return scanOwnedLock(tx.QueryRowContext(ctx, ownedLockQuery+" FOR UPDATE", cardID), ownerID, kind)
}

func scanOwnedLock(row *sql.Row, ownerID int64, kind string) (string, int64, error) {
	var (
		owner  sql.NullInt64
		got    string
		status string
		orgID  int64
	)
	err := row.Scan(&owner, &got, &status, &orgID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", 0, ErrNotFound
	}
	if err != nil {
		return "", 0, fmt.Errorf("чтение карточки владельца: %w", err)
	}
	if !owner.Valid || owner.Int64 != ownerID {
		return "", 0, ErrCardNotOwned
	}
	if got != kind {
		return "", 0, ErrKindMismatch
	}
	return status, orgID, nil
}

// resolveOwnedOrg — организация для новой карточки. Без org_id берётся своя
// (первая по id); с org_id организация обязана принадлежать вызывающему, иначе
// 403. Чужую организацию нельзя «подставить» телом запроса (§12.1).
func (r *Repository) resolveOwnedOrg(ctx context.Context, ownerID int64, requested *int64) (int64, error) {
	if requested != nil {
		var owner sql.NullInt64
		err := r.db.QueryRowContext(ctx, `SELECT owner_id FROM organizations WHERE id = $1`, *requested).Scan(&owner)
		if errors.Is(err, sql.ErrNoRows) {
			return 0, ErrNotFound
		}
		if err != nil {
			return 0, fmt.Errorf("чтение организации: %w", err)
		}
		if !owner.Valid || owner.Int64 != ownerID {
			return 0, ErrOrgNotOwned
		}
		return *requested, nil
	}

	var id int64
	err := r.db.QueryRowContext(ctx, `
		SELECT id FROM organizations WHERE owner_id = $1 ORDER BY id LIMIT 1`, ownerID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNoOwnerOrganization
	}
	if err != nil {
		return 0, fmt.Errorf("поиск организации владельца: %w", err)
	}
	return id, nil
}

// checkCategory — направление существует и подходит виду карточки. У categories
// свой CHECK kind IN ('activity','service','both') (§8, табл. 3), и услуга в
// направлении «только занятия» была бы отказом базы уже после вставки.
func (r *Repository) checkCategory(ctx context.Context, categoryID int64, kind string) error {
	var categoryKind string
	err := r.db.QueryRowContext(ctx, `SELECT kind FROM categories WHERE id = $1`, categoryID).Scan(&categoryKind)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrCategoryUnknown
	}
	if err != nil {
		return fmt.Errorf("чтение направления: %w", err)
	}
	if categoryKind != "both" && categoryKind != kind {
		return ErrCategoryKind
	}
	return nil
}

// checkCity — город из справочника. Внешний ключ иначе ответил бы 23503, а это
// 500 на месте честного 400 с именем поля (§9).
func (r *Repository) checkCity(ctx context.Context, cityID int64) error {
	var exists bool
	if err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM cities WHERE id = $1)`, cityID).Scan(&exists); err != nil {
		return fmt.Errorf("проверка города: %w", err)
	}
	if !exists {
		return ErrCityUnknown
	}
	return nil
}

func scanOwnedOrganization(row *sql.Row) (*models.OwnedOrganization, error) {
	var (
		org      models.OwnedOrganization
		descr    sql.NullString
		email    sql.NullString
		site     sql.NullString
		address  sql.NullString
		city     sql.NullString
		verified sql.NullTime
		cityID   sql.NullInt64
		lat      sql.NullFloat64
		lng      sql.NullFloat64
		owner    sql.NullInt64
	)
	err := row.Scan(&org.ID, &org.Slug, &org.Name, &org.Type, &descr, &org.Phone,
		&email, &site, &address, &city, &verified,
		&cityID, &lat, &lng, &owner, &org.PublishBasis, &org.IsActive,
		&org.CreatedAt, &org.UpdatedAt)
	if err != nil {
		return nil, err
	}
	org.Description = nullText(descr)
	org.Email = nullText(email)
	org.Site = nullText(site)
	org.Address = nullText(address)
	org.City = nullText(city)
	org.ContactsVerified = nullDate(verified)
	if cityID.Valid {
		v := cityID.Int64
		org.CityID = &v
	}
	if owner.Valid {
		v := owner.Int64
		org.OwnerID = &v
	}
	if lat.Valid {
		org.Lat = &lat.Float64
	}
	if lng.Valid {
		org.Lng = &lng.Float64
	}
	return &org, nil
}

// ownedText / ownedInt64 / ownedFloat — NULL вместо нулевого значения: §7.4
// требует публиковать незаполненное поле как null, а не как пустую строку.
func ownedText(p *string) any {
	if p == nil {
		return nil
	}
	return *p
}

func ownedInt64(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}

func ownedFloat(p *float64) any {
	if p == nil {
		return nil
	}
	return *p
}

// ownedSlugLetters — транслитерация кириллицы в адрес карточки. Порт приёма
// codex (makeActivitySlug), но на каноническом cards.slug: латинский адрес
// читается и в URL, и в скрипте, а кириллица в пути требует percent-encoding.
var ownedSlugLetters = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "e",
	'ж': "zh", 'з': "z", 'и': "i", 'й': "y", 'к': "k", 'л': "l", 'м': "m",
	'н': "n", 'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u",
	'ф': "f", 'х': "h", 'ц': "ts", 'ч': "ch", 'ш': "sh", 'щ': "sch",
	'ъ': "", 'ы': "y", 'ь': "", 'э': "e", 'ю': "yu", 'я': "ya",
	'і': "i", 'ї': "yi", 'є': "ye", 'ґ': "g",
}

// ownedCardSlug — адрес вида «shahmaty-dlya-detey-512». Id в конце обязателен:
// два занятия с одним названием не могут делить один UNIQUE slug. Длина
// ограничена 120 символами основы плюс id — заведомо меньше VARCHAR(160).
func ownedCardSlug(name string, id int64) string {
	var b strings.Builder
	dash := true
	for _, r := range strings.ToLower(name) {
		if repl, ok := ownedSlugLetters[r]; ok {
			b.WriteString(repl)
			dash = repl == ""
			continue
		}
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			dash = false
			continue
		}
		if !dash {
			b.WriteByte('-')
			dash = true
		}
	}

	slug := strings.Trim(b.String(), "-")
	const maxBase = 120
	if runes := []rune(slug); len(runes) > maxBase {
		slug = strings.Trim(string(runes[:maxBase]), "-")
	}
	if slug == "" {
		slug = "card"
	}
	return slug + "-" + strconv.FormatInt(id, 10)
}
