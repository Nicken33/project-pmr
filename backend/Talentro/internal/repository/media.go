package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"talentro/internal/models"
)

// Медиа галереи владельца — каноническая таблица media (§8, табл. 7): одна
// таблица на карточки, точки и отзывы, признак «к чему» в entity, вид файла в
// kind. Таблиц activities/directions из параллельной ветки здесь нет: DDL под них
// не написан, а init.sql — единственный источник схемы.
//
// Порядок выделяется в том же запросе, что и вставка, и защищён UNIQUE
// (entity, entity_id, order_num): две одновременные загрузки иначе получили бы
// один номер, и вторая упала бы как 500 на глазах у владельца.

// ErrMediaConflict — номер порядка занят другой загрузкой, и пересчитать его
// не удалось за отведённые попытки. Наружу это 409 «повтори», а не 500: запрос
// корректный, просто гонка (§9).
var ErrMediaConflict = errors.New("порядок медиа занят другой загрузкой")

// ErrMediaGalleryFull — order_num это SMALLINT, и 32768-й файл вставить нельзя.
// Отдельная ошибка, потому что совет у неё другой: не «повтори», а «удали лишнее».
var ErrMediaGalleryFull = errors.New("в галерее карточки закончились номера порядка")

// errMediaOrderTaken — внутренний признак 23505 на время повторных попыток.
var errMediaOrderTaken = errors.New("номер порядка медиа уже занят")

// mediaOrderTries — сколько раз пересчитываем MAX(order_num) после гонки.
// Каждая попытка — отдельный оператор, поэтому в READ COMMITTED она видит уже
// закоммиченную строку соперника. Пяти хватает на любую реальную одновременность
// загрузок одной карточки; дальше честнее 409, чем бесконечный цикл.
const mediaOrderTries = 5

// mediaCardQuery — карточка в том срезе, который нужен правам на галерею.
// COALESCE(owner_id, 0): у карточки может не быть владельца, и нулевой id не
// совпадёт ни с одной сессией (users.id начинается с 1). Status — для отказа
// 409 на опубликованной карточке: её галерея уже на витрине.
const mediaCardQuery = `
	SELECT id, COALESCE(owner_id, 0), kind, status
	FROM cards
	WHERE id = $1`

// CardForMedia — существует ли карточка, чья она, какого вида и в каком
// статусе. ErrNotFound отделён от прочих ошибок: «нет такой карточки» — это
// 404, а «база не ответила» — 500, и путать их значит выдавать сбой за отсутствие.
func (r *Repository) CardForMedia(ctx context.Context, cardID int64) (models.MediaCard, error) {
	var c models.MediaCard
	err := r.db.QueryRowContext(ctx, mediaCardQuery, cardID).Scan(&c.ID, &c.OwnerID, &c.Kind, &c.Status)
	if errors.Is(err, sql.ErrNoRows) {
		return models.MediaCard{}, ErrNotFound
	}
	if err != nil {
		return models.MediaCard{}, fmt.Errorf("чтение карточки для медиа: %w", err)
	}
	return c, nil
}

// addCardMediaQuery — вставка с выделением порядка и проверкой владельца одним
// оператором.
//
// target не даёт вставить медиа в чужую или исчезнувшую карточку: если строк нет,
// INSERT…SELECT не вставляет ничего и RETURNING отвечает sql.ErrNoRows. Порядок
// считается как MAX+1 по этой же карточке: освобождённые середины не
// переиспользуются, зато номер никогда не сталкивается с уже стоящим рядом.
const addCardMediaQuery = `
	WITH target AS (
		SELECT id FROM cards WHERE id = $1 AND owner_id = $2
	), next_order AS (
		SELECT COALESCE(MAX(order_num) + 1, 0) AS n
		FROM media
		WHERE entity = 'card' AND entity_id = $1
	)
	INSERT INTO media (entity, entity_id, path, order_num, caption, source_url, author, kind)
	SELECT 'card', target.id, $3, next_order.n, $4, $5, $6, $7
	FROM target, next_order
	RETURNING id, entity_id, path, order_num, caption, source_url, author, kind`

// AddCardMedia сохраняет проверенный обработчиком файл. path обязан прийти с
// префиксом '/media/' — так лежат засеянные строки и так их читает витрина.
// kind берётся из маршрута, а не из формы, поэтому CHECK на kind не нарушить.
func (r *Repository) AddCardMedia(
	ctx context.Context, ownerID, cardID int64, in models.MediaUpload,
) (models.CardMedia, error) {
	for try := 0; try < mediaOrderTries; try++ {
		saved, err := r.insertCardMedia(ctx, ownerID, cardID, in)
		switch {
		case err == nil:
			return saved, nil
		case errors.Is(err, errMediaOrderTaken):
			// Гонка за номер: следующая попытка пересчитает MAX по свежему
			// снимку. Файл на диске остаётся — он уже записан и не зависит от
			// номера порядка.
			continue
		default:
			return models.CardMedia{}, err
		}
	}
	return models.CardMedia{}, ErrMediaConflict
}

func (r *Repository) insertCardMedia(
	ctx context.Context, ownerID, cardID int64, in models.MediaUpload,
) (models.CardMedia, error) {
	var (
		out     models.CardMedia
		caption sql.NullString
		source  sql.NullString
		author  sql.NullString
	)

	err := r.db.QueryRowContext(ctx, addCardMediaQuery,
		cardID, ownerID, in.Path, in.Caption, in.Source, in.Author, in.Kind,
	).Scan(&out.ID, &out.CardID, &out.Path, &out.Order, &caption, &source, &author, &out.Kind)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) {
			switch pqErr.Code {
			case "23505":
				// UNIQUE (entity, entity_id, order_num): номер успели занять.
				return models.CardMedia{}, errMediaOrderTaken
			case "22003":
				// order_num SMALLINT: MAX+1 вышел за 32767.
				return models.CardMedia{}, ErrMediaGalleryFull
			}
		}
		if errors.Is(err, sql.ErrNoRows) {
			// Карточка исчезла или сменила владельца между проверкой и вставкой.
			return models.CardMedia{}, ErrNotFound
		}
		return models.CardMedia{}, fmt.Errorf("сохранение медиа карточки: %w", err)
	}

	out.Caption, out.Source, out.Author = nullText(caption), nullText(source), nullText(author)
	return out, nil
}

// deleteCardMediaQuery — удаление со всеми проверками в одном операторе: строка
// обязана быть медиа именно этой карточки (entity='card'), а карточка —
// принадлежать вошедшему. Разнести это на SELECT и DELETE значило бы оставить
// окно, в котором строку успевают перенести или карточку — передать другому.
const deleteCardMediaQuery = `
	DELETE FROM media m
	USING cards c
	WHERE m.id = $1
	  AND m.entity = 'card'
	  AND m.entity_id = $2
	  AND c.id = m.entity_id
	  AND c.owner_id = $3
	RETURNING m.path`

// DeleteCardMedia удаляет строку и возвращает её path, чтобы обработчик снял
// файл с диска. ErrNotFound — строки нет, она не этой карточки или карточка не
// этого владельца: наружу всё это один 404, чужое существование не раскрывается.
func (r *Repository) DeleteCardMedia(ctx context.Context, ownerID, cardID, mediaID int64) (string, error) {
	var path string
	err := r.db.QueryRowContext(ctx, deleteCardMediaQuery, mediaID, cardID, ownerID).Scan(&path)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", fmt.Errorf("удаление медиа карточки: %w", err)
	}
	return path, nil
}
