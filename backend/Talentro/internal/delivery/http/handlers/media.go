package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"

	"talentro/internal/auth"
	"talentro/internal/httpx"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// mediaStore — ровно то, что нужно медиа: учётная запись, карточка-цель и две
// операции над таблицей media (§8, табл. 7). Обработчик держит интерфейс, а не
// *repository.Repository: 401/403/404/409/503 проверяются на фейковом хранилище
// без живого Postgres — тот же шов, что moderationStore.
type mediaStore interface {
	AccountByID(ctx context.Context, id int64) (models.Account, error)
	// CardForMedia — id, владелец, вид и статус карточки; ErrNotFound, если её нет.
	CardForMedia(ctx context.Context, cardID int64) (models.MediaCard, error)
	// AddCardMedia выделяет order_num и вставляет строку; владелец проверяется
	// в самом запросе, гонка за номер возвращается как ErrMediaConflict.
	AddCardMedia(ctx context.Context, ownerID, cardID int64, in models.MediaUpload) (models.CardMedia, error)
	// DeleteCardMedia удаляет строку этой карточки этого владельца и возвращает
	// её path; ErrNotFound, если строки нет или она чужая.
	DeleteCardMedia(ctx context.Context, ownerID, cardID, mediaID int64) (string, error)
}

// Потолки и размеры — из §9.13 и здравого смысла стенда: 10 МиБ на фотографию,
// 50 МиБ на видео. Читаем тело с запасом на multipart-обвязку (границы, заголовки
// частей, поля формы), но сам файл ограничиваем дважды: заявленным размером и
// счётчиком при записи, потому что Content-Length и Size в multipart — это
// обещание клиента, а не измерение сервера.
const (
	maxPhotoBytes     int64 = 10 << 20
	maxVideoBytes     int64 = 50 << 20
	multipartOverhead int64 = 1 << 20
	multipartMemory   int64 = 4 << 20

	// mediaSniffBytes — сколько читаем для опознания формата. 512 байт хватает
	// и на ftyp с списком совместимых брендов, и на заголовок WebP.
	mediaSniffBytes  = 512
	mediaNameBytes   = 16
	mediaNameTries   = 5
	mediaUploadLimit = 30
	mediaUploadEvery = time.Minute

	// mediaCachePublic — раздача публичная и куки не читает: no-store здесь
	// заставил бы браузер тянуть каждую картинку заново на каждой странице.
	mediaCachePublic = "public, max-age=3600"

	// Длины — ровно VARCHAR из init.sql: Postgres считает символы, поэтому
	// меряем руны, иначе 22001 прилетел бы как 500 на месте честного 400.
	maxCaptionRunes = 240
	maxSourceRunes  = 500
	maxAuthorRunes  = 160
)

// mediaOwnerKinds — роль владельца (users.account_type) и единственный вид
// карточки (cards.kind), который ей разрешён. Владелец занятий не правит услуги
// и наоборот: это разные кабинеты и разные организации (§3.8, §7).
var mediaOwnerKinds = map[string]string{
	"owner_activity": "activity",
	"owner_service":  "service",
}

// MediaHandler — раздача тома медиа и галерея владельца.
//
// Сессия здесь только читается: куку `talentro_session` выдаёт auth-срез, второй
// реализации сессии в проекте нет (как в кабинете модерации). Роль проверяется
// внутри каждого обработчика, а не middleware на группе: только так 401, 403,
// 404 и 503 остаются различимыми и только так роль перечитывается из users на
// каждый запрос — понижение account_type отзывает доступ сразу.
type MediaHandler struct {
	store       mediaStore
	sessions    *auth.Store
	root        string
	uploadLimit *auth.Limiter
}

// MediaOption — настройка обработчика. Отдельный тип, а не Option: имя Option
// уже занято кабинетом модерации в этом же пакете.
type MediaOption func(*MediaHandler)

// WithMediaSessions включает чтение куки. Без него приватные маршруты отвечают
// 503, а не «все проходят»: стенд без SESSION_SECRET не становится открытой
// галереей. Публичная раздача /media/* работает и без сессий — фото каталога
// публичны по §9.3.
func WithMediaSessions(store *auth.Store) MediaOption {
	return func(h *MediaHandler) { h.sessions = store }
}

// WithMediaUploadLimiter подменяет счётчик загрузок. Нужен тестам (окно в минуту
// не прокрутить без сна) и стенду, которому хватит другого потолка. Сам лимитер —
// тот же internal/auth.Limiter, что у входа (§12.2), второго в проекте нет.
func WithMediaUploadLimiter(l *auth.Limiter) MediaOption {
	return func(h *MediaHandler) {
		if l != nil {
			h.uploadLimit = l
		}
	}
}

// NewMediaHandler: store — шов к базе, mediaDir — том (MEDIA_DIR, по умолчанию
// './media'). Путь приводится к абсолютному сразу: дальше от него считаются и
// раздача, и проверка «не убегает ли путь из тома», а относительный корень зависел
// бы от рабочей директории процесса.
func NewMediaHandler(store mediaStore, mediaDir string, opts ...MediaOption) *MediaHandler {
	dir := strings.TrimSpace(mediaDir)
	if dir == "" {
		dir = "./media"
	}
	root, err := filepath.Abs(dir)
	if err != nil {
		// Abs падает только если не определить рабочую директорию; тогда
		// остаётся путь как есть — раздача всё равно проверит его на месте.
		root = filepath.Clean(dir)
	}

	h := &MediaHandler{
		store:       store,
		root:        root,
		uploadLimit: auth.NewLimiter(mediaUploadLimit, mediaUploadEvery),
	}
	for _, opt := range opts {
		opt(h)
	}
	return h
}

// Serve — GET /media/*: публичная раздача обычных файлов тома.
//
// Отличия от http.FileServer, который стоял у codex: каталог не отдаётся ни
// списком, ни индексом (404), тип не подглядывается из содержимого, активный
// контент (HTML/SVG/JS) уходит вложением, а путь проверяется на выход за том и
// на симлинки. Фото каталога публичны (§9.3), приватность здесь не нужна.
func (h *MediaHandler) Serve(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")

	// Раздача только читает. Проверка здесь, а не в маршруте: обработчик годен
	// и под r.Handle("/media/*"), где POST иначе получил бы файл в ответ.
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		httpx.WriteError(w, httpx.NewError(http.StatusMethodNotAllowed,
			"раздача медиа только читает: GET или HEAD", nil))
		return
	}

	rel, ok := mediaRelativePath(r.URL.Path)
	if !ok {
		httpx.WriteError(w, errMediaFileNotFound)
		return
	}
	full := filepath.Join(h.root, rel)
	if !h.contained(full) {
		httpx.WriteError(w, errMediaFileNotFound)
		return
	}

	// Lstat, а не Stat: симлинк — не обычный файл, и отдавать его нельзя даже
	// если он смотрит внутрь тома. Каталоги и устройства отсекаются тем же.
	info, err := os.Lstat(full)
	if err != nil || !info.Mode().IsRegular() {
		httpx.WriteError(w, errMediaFileNotFound)
		return
	}
	file, err := os.Open(full)
	if err != nil {
		httpx.WriteError(w, errMediaFileNotFound)
		return
	}
	defer file.Close()

	ctype, attachment := mediaContentType(info.Name())
	w.Header().Set("Content-Type", ctype)
	if attachment {
		w.Header().Set("Content-Disposition", `attachment; filename="`+mediaSafeName(info.Name())+`"`)
	}
	w.Header().Set("Cache-Control", mediaCachePublic)
	// ServeContent сам разбирает Range и If-Modified-Since (видео без Range не
	// перематывается), но не делает ни листинга, ни редиректа на index.html.
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

// UploadPhoto — POST /api/v1/me/activities/{id}/photos, multipart, поле file.
func (h *MediaHandler) UploadPhoto(w http.ResponseWriter, r *http.Request) {
	h.upload(w, r, models.MediaKindPhoto)
}

// UploadVideo — POST /api/v1/me/activities/{id}/videos, multipart, поле file.
func (h *MediaHandler) UploadVideo(w http.ResponseWriter, r *http.Request) {
	h.upload(w, r, models.MediaKindVideo)
}

// DeleteMedia — DELETE /api/v1/me/activities/{id}/media/{mediaID}: сначала
// строка (с проверкой владельца в запросе), потом файл. Наоборот нельзя: удалённый
// файл при живой строке оставил бы галерею с битой картинкой и без способа её
// починить, кроме как руками в базе.
func (h *MediaHandler) DeleteMedia(w http.ResponseWriter, r *http.Request) {
	mediaHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}
	card, ok := h.targetCard(w, r, acc)
	if !ok {
		return
	}
	mediaID, ok := mediaPathID(w, "mediaID", chi.URLParam(r, "mediaID"))
	if !ok {
		return
	}

	path, err := h.store.DeleteCardMedia(r.Context(), acc.ID, card.ID, mediaID)
	switch {
	case errors.Is(err, repository.ErrNotFound):
		httpx.WriteError(w, errMediaNotFound)
		return
	case err != nil:
		httpx.WriteError(w, err)
		return
	}

	// Путь пришёл из базы, а не от клиента, но доверять ему нельзя: строка могла
	// остаться от прошлой схемы или быть подделанной. Не прошёл проверку — файл
	// не трогаем, строка уже удалена, и это успех, а не 500.
	if rel, safe := mediaRelativePath(path); safe {
		full := filepath.Join(h.root, rel)
		switch {
		case !h.contained(full):
			log.Printf("media: путь из базы убегает из тома, файл не удалён: card=%d media=%d", card.ID, mediaID)
		case isMediaDir(full):
			// Подделанный path мог указывать на каталог: os.Remove снял бы
			// пустую папку соседней карточки. Удаляем только файлы и симлинки.
			log.Printf("media: путь из базы указывает на каталог, не удалён: card=%d media=%d", card.ID, mediaID)
		default:
			if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
				// Строки уже нет; ошибку файла оставляем в логе (§6.7), а не в ответе.
				log.Printf("media: не удалось удалить файл %q: %v", full, err)
			}
		}
	} else {
		log.Printf("media: небезопасный путь из базы, файл не удалён: card=%d media=%d", card.ID, mediaID)
	}

	httpx.WriteJSON(w, http.StatusOK, models.MediaDeleted{Deleted: true, ID: mediaID, CardID: card.ID})
}

// upload — общий путь фото и видео: права → карточка → лимит → форма → формат →
// диск → строка. Порядок именно такой: отказ по правам не должен ни читать тело,
// ни тратить окно владельца, а файл не ложится на диск, пока не ясно, что он
// допустимого формата и размера.
func (h *MediaHandler) upload(w http.ResponseWriter, r *http.Request, kind string) {
	mediaHeaders(w)
	acc, ok := h.authorize(w, r)
	if !ok {
		return
	}
	card, ok := h.targetCard(w, r, acc)
	if !ok {
		return
	}

	rules := mediaRulesFor(kind)
	key := strconv.FormatInt(acc.ID, 10)
	if !h.uploadLimit.Allow(key) {
		tooMany(w, h.uploadLimit, key, mediaUploadBlocked)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, rules.limit+multipartOverhead)
	if err := r.ParseMultipartForm(multipartMemory); err != nil {
		httpx.WriteError(w, mediaFormError(err, rules))
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httpx.WriteError(w, errMediaMissingFile)
		return
	}
	defer file.Close()

	switch {
	case header.Size <= 0:
		httpx.WriteError(w, errMediaEmptyFile)
		return
	case header.Size > rules.limit:
		httpx.WriteError(w, rules.tooLarge)
		return
	}

	sniff := make([]byte, mediaSniffBytes)
	n, err := io.ReadFull(file, sniff)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		httpx.WriteError(w, errMediaUnreadable)
		return
	}
	if n == 0 {
		httpx.WriteError(w, errMediaEmptyFile)
		return
	}
	ext, ok := rules.extension(sniff[:n])
	if !ok {
		httpx.WriteError(w, rules.unsupported)
		return
	}

	in, err := mediaMetadata(r)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	in.Kind = kind

	rel, full, err := h.storeFile(card.ID, ext, io.MultiReader(bytes.NewReader(sniff[:n]), file), rules)
	if err != nil {
		httpx.WriteError(w, err)
		return
	}
	// Путь хранится с префиксом раздачи: засеянные строки уже такие, а
	// web/next.config.ts переписывает '/media/:path*' на api. Без префикса
	// каждая картинка каталога — 404.
	in.Path = models.MediaURLPrefix + rel

	saved, err := h.store.AddCardMedia(r.Context(), acc.ID, card.ID, in)
	if err != nil {
		// Строка не создана — файл сирота, его быть не должно.
		if rmErr := os.Remove(full); rmErr != nil && !os.IsNotExist(rmErr) {
			log.Printf("media: не удалось убрать файл после отказа базы %q: %v", full, rmErr)
		}
		switch {
		case errors.Is(err, repository.ErrNotFound):
			httpx.WriteError(w, errMediaCardNotFound)
		case errors.Is(err, repository.ErrMediaConflict):
			httpx.WriteError(w, errMediaOrderConflict)
		case errors.Is(err, repository.ErrMediaGalleryFull):
			httpx.WriteError(w, errMediaGalleryFull)
		default:
			httpx.WriteError(w, err)
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, saved)
}

// authorize — единственная дверь галереи (§12.1). Куку читает auth.Store main,
// роль берётся из users на каждый запрос, а не из подписанных claims: claims
// служат быстрым отказом, база — окончательным решением.
func (h *MediaHandler) authorize(w http.ResponseWriter, r *http.Request) (models.Account, bool) {
	if h.sessions == nil {
		httpx.WriteError(w, errMediaSessionsDisabled)
		return models.Account{}, false
	}

	claims, err := h.sessions.ClaimsFromRequest(r)
	switch {
	case errors.Is(err, auth.ErrInvalid):
		httpx.WriteError(w, errMediaUnauthorized)
		return models.Account{}, false
	case err != nil:
		httpx.WriteError(w, err)
		return models.Account{}, false
	}
	if _, ok := mediaOwnerKinds[claims.Role]; !ok {
		httpx.WriteError(w, errMediaForbidden)
		return models.Account{}, false
	}

	acc, err := h.store.AccountByID(r.Context(), claims.UserID)
	if errors.Is(err, repository.ErrNotFound) {
		// Кука живёт дольше удалённой учётной записи: это просроченная сессия.
		httpx.WriteError(w, errMediaUnauthorized)
		return models.Account{}, false
	}
	if err != nil {
		httpx.WriteError(w, err)
		return models.Account{}, false
	}
	if _, ok := mediaOwnerKinds[acc.Role]; !ok {
		httpx.WriteError(w, errMediaForbidden)
		return models.Account{}, false
	}
	return acc, true
}

// targetCard — карточка из пути: существует (404), принадлежит вошедшему (403),
// того вида, который его ролью правится (403), и не опубликована (409). Проверка
// до чтения тела: чужую карточку нельзя использовать как место для своих 50 МиБ.
// Статус проверяется последним: чужая опубликованная карточка остаётся 403, а не
// 409 — постороннему не раскрывается ни существование, ни статус.
func (h *MediaHandler) targetCard(w http.ResponseWriter, r *http.Request, acc models.Account) (models.MediaCard, bool) {
	id, ok := mediaPathID(w, "id", chi.URLParam(r, "id"))
	if !ok {
		return models.MediaCard{}, false
	}

	card, err := h.store.CardForMedia(r.Context(), id)
	switch {
	case errors.Is(err, repository.ErrNotFound):
		httpx.WriteError(w, errMediaCardNotFound)
		return models.MediaCard{}, false
	case err != nil:
		httpx.WriteError(w, err)
		return models.MediaCard{}, false
	}
	if !card.OwnedBy(acc.ID) {
		httpx.WriteError(w, errMediaNotYourCard)
		return models.MediaCard{}, false
	}
	if want := mediaOwnerKinds[acc.Role]; card.Kind != want {
		httpx.WriteError(w, errMediaKindMismatch)
		return models.MediaCard{}, false
	}
	// Published — это витрина: новый файл или удаление легли бы в каталог без
	// проверки модератора. On_moderation — та же дыра с отсрочкой: модератор
	// смотрит фото A, владелец подменяет его на B, заявка одобряется, и
	// DecideApplication ставит published, не перечитывая медиа. Поэтому закрыты
	// оба статуса, как и текст анкеты (repository/owned_activities.go). Статус не
	// меняем и заявку не создаём — снятие с публикации остаётся отдельным
	// действием кабинета (§3.8.6). Отказ до лимитера и до чтения тела: окно
	// владельца не тратится.
	switch card.Status {
	case models.CardStatusPublished:
		httpx.WriteError(w, errMediaCardPublished)
		return models.MediaCard{}, false
	case models.CardStatusOnModeration:
		httpx.WriteError(w, errMediaCardOnModeration)
		return models.MediaCard{}, false
	}
	return card, true
}

// storeFile кладёт проверенный поток в том: MediaDir/cards/{id}/{случайное имя}.
// Имя — crypto/rand, создание — O_EXCL, поэтому существующий файл не
// перезаписывается ни при совпадении имён, ни при подмене имени клиентом.
// Возвращает путь в слешах (для базы) и путь на диске (для уборки при отказе).
func (h *MediaHandler) storeFile(cardID int64, ext string, src io.Reader, rules mediaRules) (string, string, error) {
	dir := filepath.Join(h.root, "cards", strconv.FormatInt(cardID, 10))
	if err := os.MkdirAll(dir, 0o750); err != nil {
		log.Printf("media: не удалось создать каталог %q: %v", dir, err)
		return "", "", errMediaStorage
	}

	var (
		file *os.File
		rel  string
		full string
	)
	for try := 0; try < mediaNameTries && file == nil; try++ {
		name := make([]byte, mediaNameBytes)
		if _, err := rand.Read(name); err != nil {
			log.Printf("media: crypto/rand не дал имя файла: %v", err)
			return "", "", errMediaStorage
		}
		rel = "cards/" + strconv.FormatInt(cardID, 10) + "/" + hex.EncodeToString(name) + ext
		full = filepath.Join(h.root, filepath.FromSlash(rel))

		opened, err := os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o640)
		switch {
		case err == nil:
			file = opened
		case os.IsExist(err):
			// Имя занято — берём другое. Пять попыток на 128 бит случайности:
			// коллизия здесь означает не случайность, а сломанный генератор.
		default:
			log.Printf("media: не удалось создать файл %q: %v", full, err)
			return "", "", errMediaStorage
		}
	}
	if file == nil {
		log.Printf("media: не удалось подобрать свободное имя в %q", dir)
		return "", "", errMediaStorage
	}

	written, copyErr := io.Copy(file, io.LimitReader(src, rules.limit+1))
	closeErr := file.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(full)
		log.Printf("media: не удалось записать файл %q: запись=%v закрытие=%v", full, copyErr, closeErr)
		return "", "", errMediaStorage
	}
	// Заявленный размер мог оказаться меньше настоящего: считаем сами.
	if written > rules.limit {
		_ = os.Remove(full)
		return "", "", rules.tooLarge
	}
	return rel, full, nil
}

// contained — не выводят ли симлинки каталога файла за пределы тома. Сам файл
// проверяется отдельно (Lstat в Serve, os.Remove в Delete не следует по ссылке).
// Несуществующий каталог безопасен: удалять и отдавать там нечего, а убежать
// через отсутствующий компонент нельзя.
func (h *MediaHandler) contained(full string) bool {
	realRoot, err := filepath.EvalSymlinks(h.root)
	if err != nil {
		return os.IsNotExist(err)
	}
	realDir, err := filepath.EvalSymlinks(filepath.Dir(full))
	if err != nil {
		return os.IsNotExist(err)
	}
	rel, err := filepath.Rel(realRoot, realDir)
	return err == nil && (rel == "." || filepath.IsLocal(rel))
}

// isMediaDir — путь указывает на каталог. Lstat, а не Stat: симлинк на каталог
// это файл-ссылка, его удалить можно и безопасно (цель не трогается).
func isMediaDir(full string) bool {
	info, err := os.Lstat(full)
	return err == nil && info.IsDir()
}

// mediaRelativePath — путь из URL или из media.path в проверяемый относительный
// путь внутри тома. Префикс '/media/' снимается (в базе он есть, в URL тоже),
// затем чистка и IsLocal. Обратный слеш, двоеточие и NUL запрещаются явно: на
// Windows это разделитель, том и поток, а на Unix — законные символы имени, и
// полагаться на «файла с таким именем нет» значит оставлять защиту на волю случая.
func mediaRelativePath(raw string) (string, bool) {
	rel := strings.TrimSpace(raw)
	rel = strings.TrimPrefix(rel, models.MediaURLPrefix)
	if rel == "" || strings.ContainsAny(rel, "\\\x00:") {
		return "", false
	}
	cleaned := filepath.Clean(filepath.FromSlash(rel))
	if !filepath.IsLocal(cleaned) {
		return "", false
	}
	return cleaned, true
}

// mediaContentType — тип по расширению и признак «отдать вложением».
//
// Список намеренно белый: всё остальное уходит как application/octet-stream с
// Content-Disposition: attachment. Причина не в строгости, а в том, что
// web/next.config.ts отдаёт /media/* как собственный путь витрины: HTML или SVG,
// оказавшийся в томе, исполнился бы на origin сайта (stored XSS). Загрузка таких
// файлов и так запрещена, это второй рубеж — на случай файла, положенного в том
// руками или оставшегося от прошлой версии.
func mediaContentType(name string) (ctype string, attachment bool) {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg":
		return "image/jpeg", false
	case ".png":
		return "image/png", false
	case ".webp":
		return "image/webp", false
	case ".gif":
		return "image/gif", false
	case ".avif":
		return "image/avif", false
	case ".mp4", ".m4v":
		return "video/mp4", false
	case ".webm":
		return "video/webm", false
	default:
		return "application/octet-stream", true
	}
}

// mediaSafeName — имя для Content-Disposition без кавычек, слешей и управляющих
// символов: имя пришло с диска, а не от клиента, но заголовок ответа ломать нельзя.
func mediaSafeName(name string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			return r
		case r == '.', r == '-', r == '_':
			return r
		default:
			return '_'
		}
	}, name)
}

// mediaRules — потолок и отказы одного вида медиа. Тексты разные: «не больше
// 10 МиБ» на видео звучало бы как насмешка над клиентом, который читает подсказку.
type mediaRules struct {
	limit       int64
	tooLarge    error
	unsupported error
	extension   func([]byte) (string, bool)
}

func mediaRulesFor(kind string) mediaRules {
	if kind == models.MediaKindVideo {
		return mediaVideoRules
	}
	return mediaPhotoRules
}

var (
	mediaPhotoRules = mediaRules{
		limit:       maxPhotoBytes,
		tooLarge:    httpx.NewError(http.StatusRequestEntityTooLarge, "фотография должна быть не больше 10 МиБ", nil),
		unsupported: httpx.NewError(http.StatusUnsupportedMediaType, "поддерживаются фотографии JPEG, PNG и WebP; SVG не принимается", nil),
		extension:   photoExtension,
	}
	mediaVideoRules = mediaRules{
		limit:       maxVideoBytes,
		tooLarge:    httpx.NewError(http.StatusRequestEntityTooLarge, "видео должно быть не больше 50 МиБ", nil),
		unsupported: httpx.NewError(http.StatusUnsupportedMediaType, "поддерживаются видео MP4 (коробка ftyp в начале файла)", nil),
		extension:   videoExtension,
	}
)

// photoExtension — опознание по первым байтам, а не по имени и не по
// Content-Type части: и то и другое клиент выбирает сам. SVG здесь нет намеренно —
// это документ со скриптом, а не картинка; GIF и прочее тоже не принимаются.
func photoExtension(data []byte) (string, bool) {
	switch {
	case len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff:
		return ".jpg", true
	case len(data) >= 8 && bytes.Equal(data[:8], []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}):
		return ".png", true
	case len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return ".webp", true
	default:
		return "", false
	}
}

// videoExtension — MP4 начинается с коробки ftyp: 4 байта размера, четыре байта
// имени, дальше major brand и minor version. Размер обязан быть правдоподобным
// (не меньше 16 байт заголовка с брендами и не больше 4 КиБ: ftyp — это список
// брендов, а не контейнер), иначе «ftyp» в середине мусора сошло бы за видео.
func videoExtension(data []byte) (string, bool) {
	if len(data) < 12 || string(data[4:8]) != "ftyp" {
		return "", false
	}
	size := binary.BigEndian.Uint32(data[:4])
	if size < 16 || size > 4096 {
		return "", false
	}
	return ".mp4", true
}

// mediaFormError отличает «тело больше потолка» от «форма не разобрана».
// MaxBytesReader и multipart.ErrMessageTooLarge — это 413: клиент прислал больше,
// чем мы готовы читать. Остальное (не multipart, битые границы) — 400.
func mediaFormError(err error, rules mediaRules) error {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) || errors.Is(err, multipart.ErrMessageTooLarge) {
		return rules.tooLarge
	}
	return httpx.NewBadRequest(map[string]string{
		"file": "ожидался multipart/form-data с полем file; тело не разобрано: " + err.Error(),
	})
}

// mediaMetadata — необязательные поля формы. Длины и вид проверяются здесь, а не
// в базе: 22001 на VARCHAR(240) стал бы 500 на месте честного 400. Читаем PostForm
// (тело), а не Form: параметры URL метаданными не считаются.
func mediaMetadata(r *http.Request) (models.MediaUpload, error) {
	in := models.MediaUpload{}
	fields := map[string]string{}

	caption := strings.TrimSpace(r.PostFormValue("caption"))
	source := strings.TrimSpace(r.PostFormValue("source_url"))
	author := strings.TrimSpace(r.PostFormValue("author"))

	for name, value := range map[string]string{"caption": caption, "source_url": source, "author": author} {
		if !utf8.ValidString(value) {
			fields[name] = name + " должен быть корректной строкой в UTF-8"
		}
	}
	if utf8.RuneCountInString(caption) > maxCaptionRunes {
		fields["caption"] = "caption — не больше " + strconv.Itoa(maxCaptionRunes) + " символов"
	}
	if utf8.RuneCountInString(author) > maxAuthorRunes {
		fields["author"] = "author — не больше " + strconv.Itoa(maxAuthorRunes) + " символов"
	}
	if utf8.RuneCountInString(source) > maxSourceRunes {
		fields["source_url"] = "source_url — не больше " + strconv.Itoa(maxSourceRunes) + " символов"
	} else if source != "" {
		// Источник — ссылка на чужую публикацию, её покажут посетителю.
		// javascript: и data: в href — это XSS, а не источник.
		u, err := url.Parse(source)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			fields["source_url"] = "source_url — ссылка http или https с адресом сайта"
		}
	}
	if len(fields) > 0 {
		return in, httpx.NewBadRequest(fields)
	}

	in.Caption, in.Source, in.Author = mediaText(caption), mediaText(source), mediaText(author)
	return in, nil
}

// mediaText — пустое поле это NULL, а не пустая строка (§7.4): иначе клиент
// рисует пустую подпись вместо того, чтобы её не рисовать вовсе.
func mediaText(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

// mediaPathID — параметр пути-число. Нечисловой id — ошибка клиента (400), а не
// отсутствующая карточка (404): «/me/activities/abc/photos» нечего искать в базе.
func mediaPathID(w http.ResponseWriter, param, raw string) (int64, bool) {
	id, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || id <= 0 {
		httpx.WriteError(w, httpx.NewBadRequest(map[string]string{
			param: param + " — целое число больше нуля",
		}))
		return 0, false
	}
	return id, true
}

// mediaHeaders — приватность до ответа: 401 и 403 кэшируются так же плохо, как
// галерея, а Vary говорит общему кэшу, что ответ зависит от куки.
func mediaHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", cachePrivate)
	w.Header().Add("Vary", varyCookie)
}

const mediaUploadBlocked = "слишком много загрузок, подожди минуту"

var (
	errMediaUnauthorized = httpx.NewError(http.StatusUnauthorized,
		"нужна сессия владельца: войдите в кабинет", nil)
	errMediaForbidden = httpx.NewError(http.StatusForbidden,
		"галерея доступна только владельцам занятий и услуг", nil)
	errMediaSessionsDisabled = httpx.NewError(http.StatusServiceUnavailable,
		"кабинет владельца выключен: не задан SESSION_SECRET, подписывать куку нечем", nil)
	errMediaNotYourCard = httpx.NewError(http.StatusForbidden,
		"это не ваша карточка: менять её галерею нельзя", nil)
	errMediaKindMismatch = httpx.NewError(http.StatusForbidden,
		"роль не совпадает с видом карточки: владелец занятий правит занятия, владелец услуг — услуги", nil)
	errMediaCardNotFound  = httpx.NewNotFound("карточка не найдена")
	errMediaNotFound      = httpx.NewNotFound("медиафайл не найден у этой карточки")
	errMediaFileNotFound  = httpx.NewNotFound("файл не найден")
	errMediaCardPublished = httpx.NewError(http.StatusConflict,
		"Анкета опубликована: сначала снимите её с публикации, затем меняйте фото и видео — иначе новые файлы окажутся на витрине без проверки", nil)
	errMediaCardOnModeration = httpx.NewError(http.StatusConflict,
		"Анкета на проверке: модератор смотрит именно эти фото и видео — дождитесь решения, затем меняйте файлы и подавайте анкету заново", nil)
	errMediaMissingFile = httpx.NewBadRequest(map[string]string{
		"file": "прикрепи файл в поле file (multipart/form-data)",
	})
	errMediaEmptyFile = httpx.NewBadRequest(map[string]string{
		"file": "файл пустой",
	})
	errMediaUnreadable = httpx.NewBadRequest(map[string]string{
		"file": "не удалось прочитать загруженный файл",
	})
	errMediaStorage = httpx.NewError(http.StatusInternalServerError,
		"не удалось сохранить файл в хранилище медиа", nil)
	errMediaOrderConflict = httpx.NewError(http.StatusConflict,
		"место в галерее занято другой загрузкой: повтори запрос", nil)
	errMediaGalleryFull = httpx.NewError(http.StatusConflict,
		"в галерее карточки закончились номера порядка: удали лишние файлы", nil)
)
