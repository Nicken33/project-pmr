package models

// media — одна таблица на карточки, точки и отзывы (§8, табл. 7). Признак
// «к чему» живёт в entity, а не в имени таблицы, поэтому словарь значений ниже
// совпадает с CHECK в database/init.sql буквально: второго словаря у схемы нет.
const (
	MediaEntityCard = "card"

	MediaKindPhoto = "photo"
	MediaKindVideo = "video"
)

// MediaURLPrefix — префикс, с которым путь хранится в media.path.
//
// Он обязателен: засеянные строки уже лежат в виде '/media/cards/1/…jpg', а
// web/next.config.ts переписывает '/media/:path*' на api. Путь без префикса
// (относительный 'cards/1/…') рендерится браузером как '/cards/1/…' и не
// попадает ни в один маршрут — картинка молча превращается в 404.
const MediaURLPrefix = "/media/"

// MediaCard — карточка в том срезе, который нужен проверке прав на медиа:
// владелец, вид и статус. Наружу не отдаётся, это вход для авторизации (§12.1).
// Status нужен отказу 409: галерею опубликованной карточки менять нельзя —
// новые файлы попали бы на витрину без проверки модератора.
//
// OwnerID = 0 означает cards.owner_id IS NULL: у карточки нет владельца, и
// ни одна сессия (id начинаются с 1) не может оказаться её владельцем.
type MediaCard struct {
	ID      int64
	OwnerID int64
	Kind    string
	Status  string
}

// OwnedBy — право менять галерею этой карточки. Нулевой владелец не равен
// никому: иначе карточка без владельца стала бы общей.
func (c MediaCard) OwnedBy(userID int64) bool {
	return c.OwnerID != 0 && c.OwnerID == userID
}

// MediaUpload — файл, который сервер уже проверил и положил на диск. Path
// приходит с префиксом MediaURLPrefix, Kind — из обработчика, а не из формы:
// значение kind выбирает маршрут, иначе фото можно было бы выдать за видео.
// Order заполняет база: номер порядка выделяется в том же запросе, что и вставка.
type MediaUpload struct {
	Kind    string
	Path    string
	Caption *string
	Source  *string
	Author  *string
}

// CardMedia — ответ на успешную загрузку (201).
//
// Media встроен, а не переименован: path/caption/source_url/author/order_num
// выходят ровно теми же полями, что и в публичном GET /api/v1/activities/{slug}
// (photos[] и videos[]), поэтому клиент кладёт ответ в галерею без перевода.
// Сверху добавляются id (им удаляют), card_id и kind.
type CardMedia struct {
	ID     int64  `json:"id"`
	CardID int64  `json:"card_id"`
	Kind   string `json:"kind"`
	Media
}

// MediaDeleted — ответ на удаление (200). Строки в базе больше нет, файл снят
// с диска; deleted:true отличает успех от 404, а id/card_id дают клиенту понять,
// какую карточку перечитать.
type MediaDeleted struct {
	Deleted bool  `json:"deleted"`
	ID      int64 `json:"id"`
	CardID  int64 `json:"card_id"`
}
