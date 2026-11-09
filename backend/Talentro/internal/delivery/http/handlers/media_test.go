package handlers

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"talentro/internal/auth"
	"talentro/internal/httpx"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// Медиа — перенос возможностей codex/9cc2c24 на каноническую схему §7 и куку
// main. Здесь проверяется ровно то, что ломалось у источника: путь без префикса
// '/media/', каталог вместо файла, обход '..', SVG под видом картинки, 500 на
// гонке за order_num и удаление чужого файла.
//
// Postgres не поднимается: mediaStore — тот же шов, что moderationStore, а фейк
// ниже повторяет семантику internal/repository/media.go (UNIQUE на порядок,
// проверка владельца в самом запросе), а не выдумывает её.
const mediaTestSecret = "тестовый-секрет-медиа-кабинета-владельца"

// var_ — проверка, что фейк действительно закрывает шов.
var _ mediaStore = (*fakeMediaStore)(nil)

// Минимальные «магические» заголовки. Валидация смотрит именно их, поэтому
// decodable-картинка не нужна: важно, что JPEG/PNG/WebP/MP4 отличимы от SVG,
// GIF и текста, который притворяется файлом.
var (
	jpegBytes = []byte{0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, 0x01, 0xff, 0xd9}
	pngBytes  = []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 'I', 'H', 'D', 'R'}
	webpBytes = []byte("RIFF\x24\x00\x00\x00WEBPVP8 \x18\x00\x00\x00")
	svgBytes  = []byte(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	gifBytes  = []byte("GIF89a\x01\x00\x01\x00\x00\x00\x00;")
	textBytes = []byte("это не картинка, а текст с расширением .jpg")
)

// mp4Bytes — коробка ftyp: размер 24, major brand isom, minor version 0.
func mp4Bytes() []byte {
	b := make([]byte, 24)
	binary.BigEndian.PutUint32(b[0:4], 24)
	copy(b[4:8], "ftyp")
	copy(b[8:12], "isom")
	copy(b[16:24], "isommp41")
	return b
}

type mediaOrderKey struct {
	cardID int64
	order  int
}

// fakeMediaStore — память вместо базы. Владелец проверяется в «запросе» (как в
// SQL репозитория), порядок уникален в рамках карточки (как UNIQUE в init.sql).
type fakeMediaStore struct {
	mu       sync.Mutex
	accounts map[int64]models.Account
	cards    map[int64]models.MediaCard
	rows     map[int64]models.CardMedia
	orders   map[mediaOrderKey]int64
	nextID   int64

	accountErr error
	cardErr    error
	addErr     error
	deleteErr  error

	// conflictOnce — один lost race: настоящая база ответила бы 23505, репозиторий
	// пересчитал бы порядок и упёрся в потолок попыток. Наружу это ErrMediaConflict.
	conflictOnce bool
	lastUpload   models.MediaUpload
	addCalls     int
}

func newFakeMediaStore() *fakeMediaStore {
	return &fakeMediaStore{
		accounts: map[int64]models.Account{
			10: {ID: 10, Name: "Владелец занятия", Email: "activity@example.com", Role: "owner_activity"},
			20: {ID: 20, Name: "Владелец услуги", Email: "service@example.com", Role: "owner_service"},
			30: {ID: 30, Name: "Обычный пользователь", Email: "user@example.com", Role: "user"},
			40: {ID: 40, Name: "Модератор", Email: "moderator@example.com", Role: "moderator"},
			50: {ID: 50, Name: "Бывший владелец", Email: "demoted@example.com", Role: "user"},
		},
		cards: map[int64]models.MediaCard{
			7: {ID: 7, OwnerID: 10, Kind: "activity", Status: models.CardStatusDraft},
			8: {ID: 8, OwnerID: 20, Kind: "service", Status: models.CardStatusDraft},
			9: {ID: 9, OwnerID: 0, Kind: "activity", Status: models.CardStatusDraft}, // cards.owner_id IS NULL
		},
		rows:   map[int64]models.CardMedia{},
		orders: map[mediaOrderKey]int64{},
		nextID: 1,
	}
}

func (f *fakeMediaStore) AccountByID(_ context.Context, id int64) (models.Account, error) {
	if f.accountErr != nil {
		return models.Account{}, f.accountErr
	}
	a, ok := f.accounts[id]
	if !ok {
		return models.Account{}, repository.ErrNotFound
	}
	return a, nil
}

func (f *fakeMediaStore) CardForMedia(_ context.Context, cardID int64) (models.MediaCard, error) {
	if f.cardErr != nil {
		return models.MediaCard{}, f.cardErr
	}
	c, ok := f.cards[cardID]
	if !ok {
		return models.MediaCard{}, repository.ErrNotFound
	}
	return c, nil
}

func (f *fakeMediaStore) AddCardMedia(_ context.Context, ownerID, cardID int64, in models.MediaUpload) (models.CardMedia, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	f.addCalls++
	f.lastUpload = in
	if f.addErr != nil {
		return models.CardMedia{}, f.addErr
	}
	if f.conflictOnce {
		f.conflictOnce = false
		return models.CardMedia{}, repository.ErrMediaConflict
	}
	c, ok := f.cards[cardID]
	if !ok || !c.OwnedBy(ownerID) {
		return models.CardMedia{}, repository.ErrNotFound
	}

	order := 0
	for _, row := range f.rows {
		if row.CardID == cardID && row.Order >= order {
			order = row.Order + 1
		}
	}
	key := mediaOrderKey{cardID: cardID, order: order}
	if _, taken := f.orders[key]; taken {
		return models.CardMedia{}, repository.ErrMediaConflict
	}

	row := models.CardMedia{
		ID:     f.nextID,
		CardID: cardID,
		Kind:   in.Kind,
		Media: models.Media{
			Path:    in.Path,
			Caption: in.Caption,
			Source:  in.Source,
			Author:  in.Author,
			Order:   order,
		},
	}
	f.nextID++
	f.rows[row.ID] = row
	f.orders[key] = row.ID
	return row, nil
}

func (f *fakeMediaStore) DeleteCardMedia(_ context.Context, ownerID, cardID, mediaID int64) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.deleteErr != nil {
		return "", f.deleteErr
	}
	c, ok := f.cards[cardID]
	if !ok || !c.OwnedBy(ownerID) {
		return "", repository.ErrNotFound
	}
	row, ok := f.rows[mediaID]
	if !ok || row.CardID != cardID {
		return "", repository.ErrNotFound
	}
	delete(f.rows, mediaID)
	delete(f.orders, mediaOrderKey{cardID: cardID, order: row.Order})
	return row.Path, nil
}

// seedMedia кладёт строку и файл так, как их оставила бы успешная загрузка.
func (f *fakeMediaStore) seedMedia(t *testing.T, dir string, cardID int64, order int, kind, name string) models.CardMedia {
	t.Helper()

	f.mu.Lock()
	row := models.CardMedia{
		ID:     f.nextID,
		CardID: cardID,
		Kind:   kind,
		Media:  models.Media{Path: models.MediaURLPrefix + "cards/" + strconv.FormatInt(cardID, 10) + "/" + name, Order: order},
	}
	f.nextID++
	f.rows[row.ID] = row
	f.orders[mediaOrderKey{cardID: cardID, order: order}] = row.ID
	f.mu.Unlock()

	full := filepath.Join(dir, "cards", strconv.FormatInt(cardID, 10), name)
	if err := os.MkdirAll(filepath.Dir(full), 0o750); err != nil {
		t.Fatalf("каталог медиа: %v", err)
	}
	if err := os.WriteFile(full, jpegBytes, 0o640); err != nil {
		t.Fatalf("файл медиа: %v", err)
	}
	return row
}

type mediaHarness struct {
	handler  *MediaHandler
	store    *fakeMediaStore
	sessions *auth.Store
	dir      string
	router   chi.Router
}

// newMediaHarness собирает обработчик и маршруты ровно так, как их обяжут
// выглядеть route.go и cmd/app/main.go: том — t.TempDir(), сессии — подписанные
// тем же auth.Store, что и в кабинете модерации.
func newMediaHarness(t *testing.T, opts ...MediaOption) *mediaHarness {
	t.Helper()

	dir := t.TempDir()
	store := newFakeMediaStore()
	sessions, err := auth.NewStore(mediaTestSecret)
	if err != nil {
		t.Fatalf("хранилище сессий: %v", err)
	}

	all := append([]MediaOption{WithMediaSessions(sessions)}, opts...)
	h := NewMediaHandler(store, dir, all...)

	r := chi.NewRouter()
	r.Get("/media/*", h.Serve)
	r.Post("/api/v1/me/activities/{id}/photos", h.UploadPhoto)
	r.Post("/api/v1/me/activities/{id}/videos", h.UploadVideo)
	r.Delete("/api/v1/me/activities/{id}/media/{mediaID}", h.DeleteMedia)

	return &mediaHarness{handler: h, store: store, sessions: sessions, dir: dir, router: r}
}

func (hr *mediaHarness) cookie(t *testing.T, userID int64, role string) *http.Cookie {
	t.Helper()

	rec := httptest.NewRecorder()
	if err := hr.sessions.Set(rec, auth.Claims{UserID: userID, Role: role, Provider: "local"}, false); err != nil {
		t.Fatalf("подпись куки: %v", err)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("ожидалась одна кука сессии, получили %d", len(cookies))
	}
	return cookies[0]
}

func (hr *mediaHarness) do(t *testing.T, method, target string, body io.Reader, contentType string, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(method, target, body)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	hr.router.ServeHTTP(rec, req)
	return rec
}

// upload шлёт multipart в поле file; field == "" означает «файла в форме нет».
func (hr *mediaHarness) upload(t *testing.T, kind string, cardID int64, field, filename string, content []byte, values map[string]string, cookie *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()

	body, contentType := mediaForm(t, field, filename, content, values)
	return hr.do(t, http.MethodPost, "/api/v1/me/activities/"+strconv.FormatInt(cardID, 10)+"/"+kind, body, contentType, cookie)
}

func mediaForm(t *testing.T, field, filename string, content []byte, values map[string]string) (*bytes.Buffer, string) {
	t.Helper()

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	if field != "" {
		part, err := w.CreateFormFile(field, filename)
		if err != nil {
			t.Fatalf("часть формы: %v", err)
		}
		if _, err := part.Write(content); err != nil {
			t.Fatalf("тело файла: %v", err)
		}
	}
	for k, v := range values {
		if err := w.WriteField(k, v); err != nil {
			t.Fatalf("поле формы %s: %v", k, err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("закрытие формы: %v", err)
	}
	return &body, w.FormDataContentType()
}

// bigMediaForm — файл заявленного размера: заголовок настоящего формата и нули.
// Нули пишутся кусками, чтобы прогон не держал в памяти два таких же буфера.
func bigMediaForm(t *testing.T, field string, head []byte, size int) (*bytes.Buffer, string) {
	t.Helper()

	body := bytes.NewBuffer(make([]byte, 0, size+1024))
	w := multipart.NewWriter(body)
	part, err := w.CreateFormFile(field, "big.bin")
	if err != nil {
		t.Fatalf("часть формы: %v", err)
	}
	if _, err := part.Write(head); err != nil {
		t.Fatalf("заголовок файла: %v", err)
	}
	chunk := make([]byte, 64<<10)
	for left := size - len(head); left > 0; left -= len(chunk) {
		n := len(chunk)
		if left < n {
			n = left
		}
		if _, err := part.Write(chunk[:n]); err != nil {
			t.Fatalf("наполнитель файла: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("закрытие формы: %v", err)
	}
	return body, w.FormDataContentType()
}

func assertMediaError(t *testing.T, rec *httptest.ResponseRecorder, status int) {
	t.Helper()

	if rec.Code != status {
		t.Fatalf("статус %d, ждали %d; тело: %s", rec.Code, status, rec.Body.String())
	}
	var body struct {
		Error httpx.Envelope `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("ответ не конверт §9: %v; тело: %s", err, rec.Body.String())
	}
	if body.Error.Code != status {
		t.Errorf("error.code = %d, ждали %d", body.Error.Code, status)
	}
	if strings.TrimSpace(body.Error.Message) == "" {
		t.Error("error.message пустой: клиент не поймёт, что исправить")
	}
}

func assertMediaPrivate(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()

	if got := rec.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Errorf("Cache-Control = %q, ждали private, no-store", got)
	}
	if !strings.Contains(strings.Join(rec.Header().Values("Vary"), ","), "Cookie") {
		t.Errorf("Vary = %q, ждали Cookie", strings.Join(rec.Header().Values("Vary"), ","))
	}
}

// ---------------------------------------------------------------------------
// GET /media/* — публичная раздача
// ---------------------------------------------------------------------------

func TestMediaServePublicFile(t *testing.T) {
	hr := newMediaHarness(t)
	rel := filepath.Join("cards", "1", "palitra-oblozhka.jpg")
	if err := os.MkdirAll(filepath.Join(hr.dir, "cards", "1"), 0o750); err != nil {
		t.Fatalf("каталог: %v", err)
	}
	if err := os.WriteFile(filepath.Join(hr.dir, rel), jpegBytes, 0o640); err != nil {
		t.Fatalf("файл: %v", err)
	}

	rec := hr.do(t, http.MethodGet, "/media/cards/1/palitra-oblozhka.jpg", nil, "", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d, ждали 200; тело: %s", rec.Code, rec.Body.String())
	}
	if !bytes.Equal(rec.Body.Bytes(), jpegBytes) {
		t.Errorf("тело не совпадает с файлом на диске")
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options = %q, ждали nosniff", got)
	}
	if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "image/jpeg") {
		t.Errorf("Content-Type = %q, ждали image/jpeg", got)
	}
	// Раздача публичная: приватный no-store здесь заставил бы браузер тянуть
	// каждую картинку заново, а куки на этом маршруте не читаются вовсе.
	if strings.Contains(rec.Header().Get("Cache-Control"), "no-store") {
		t.Errorf("публичный файл отдан с no-store: %q", rec.Header().Get("Cache-Control"))
	}
}

func TestMediaServeNoDirectoryListing(t *testing.T) {
	hr := newMediaHarness(t)
	dir := filepath.Join(hr.dir, "cards", "1")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatalf("каталог: %v", err)
	}
	for _, name := range []string{"palitra-oblozhka.jpg", "index.html"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("<html>секрет</html>"), 0o640); err != nil {
			t.Fatalf("файл %s: %v", name, err)
		}
	}

	for _, target := range []string{"/media/", "/media/cards", "/media/cards/", "/media/cards/1", "/media/cards/1/"} {
		t.Run(target, func(t *testing.T) {
			rec := hr.do(t, http.MethodGet, target, nil, "", nil)
			assertMediaError(t, rec, http.StatusNotFound)
			if strings.Contains(rec.Body.String(), "palitra-oblozhka") {
				t.Errorf("каталог выдан списком файлов: %s", rec.Body.String())
			}
			if rec.Code == http.StatusMovedPermanently || rec.Code == http.StatusFound {
				t.Errorf("редирект на индекс: %d", rec.Code)
			}
		})
	}
}

func TestMediaServeRejectsTraversal(t *testing.T) {
	hr := newMediaHarness(t)

	// Файл лежит рядом с томом, а не внутри: ни один запрос не должен его прочесть.
	outside := filepath.Join(filepath.Dir(hr.dir), "secret-media.txt")
	if err := os.WriteFile(outside, []byte("секрет вне тома"), 0o640); err != nil {
		t.Fatalf("внешний файл: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(outside) })
	if err := os.MkdirAll(filepath.Join(hr.dir, "cards", "1"), 0o750); err != nil {
		t.Fatalf("каталог: %v", err)
	}

	targets := []string{
		"/media/../secret-media.txt",
		"/media/cards/../../secret-media.txt",
		"/media/cards/1/../../../secret-media.txt",
		"/media/%2e%2e/secret-media.txt",
		"/media/%2e%2e%2fsecret-media.txt",
		"/media/cards%5C..%5C..%5Csecret-media.txt",
		"/media/cards/1/%00.jpg",
		"/media//etc/passwd",
		"/media/C:/windows/win.ini",
	}
	for _, target := range targets {
		t.Run(target, func(t *testing.T) {
			rec := hr.do(t, http.MethodGet, target, nil, "", nil)
			if rec.Code != http.StatusNotFound && rec.Code != http.StatusBadRequest {
				t.Fatalf("статус %d: обход пути не отклонён; тело: %s", rec.Code, rec.Body.String())
			}
			if strings.Contains(rec.Body.String(), "секрет вне тома") {
				t.Fatal("отдан файл из-за пределов тома")
			}
		})
	}
}

func TestMediaServeRejectsSymlinkEscape(t *testing.T) {
	hr := newMediaHarness(t)

	outside := filepath.Join(filepath.Dir(hr.dir), "secret-link.txt")
	if err := os.WriteFile(outside, []byte("секрет по симлинку"), 0o640); err != nil {
		t.Fatalf("внешний файл: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(outside) })

	link := filepath.Join(hr.dir, "escape.txt")
	if err := os.Symlink(outside, link); err != nil {
		t.Skipf("симлинк не создать (нужны права): %v", err)
	}

	rec := hr.do(t, http.MethodGet, "/media/escape.txt", nil, "", nil)
	assertMediaError(t, rec, http.StatusNotFound)
	if strings.Contains(rec.Body.String(), "секрет по симлинку") {
		t.Fatal("симлинк вывел за пределы тома")
	}
}

func TestMediaServeMissingFile(t *testing.T) {
	hr := newMediaHarness(t)
	rec := hr.do(t, http.MethodGet, "/media/cards/9/net-takogo.jpg", nil, "", nil)
	assertMediaError(t, rec, http.StatusNotFound)
}

// Активный контент (HTML, SVG, JS) не должен исполняться на origin витрины:
// web/next.config.ts отдаёт /media/* как свой собственный путь.
func TestMediaServeActiveContentIsAttachment(t *testing.T) {
	hr := newMediaHarness(t)
	for _, tc := range []struct{ name, contentType string }{
		{"stranica.html", "text/html"},
		{"kartinka.svg", "image/svg+xml"},
		{"skript.js", "text/javascript"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := os.WriteFile(filepath.Join(hr.dir, tc.name), []byte("<script>alert(1)</script>"), 0o640); err != nil {
				t.Fatalf("файл: %v", err)
			}
			rec := hr.do(t, http.MethodGet, "/media/"+tc.name, nil, "", nil)
			if rec.Code != http.StatusOK {
				t.Fatalf("статус %d, ждали 200", rec.Code)
			}
			if got := rec.Header().Get("Content-Type"); strings.Contains(got, tc.contentType) {
				t.Errorf("Content-Type = %q: активный тип отдан как есть", got)
			}
			if got := rec.Header().Get("Content-Disposition"); !strings.Contains(got, "attachment") {
				t.Errorf("Content-Disposition = %q, ждали attachment", got)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// POST …/photos и …/videos — права
// ---------------------------------------------------------------------------

func TestMediaUploadAuthMatrix(t *testing.T) {
	for _, endpoint := range []string{"photos", "videos"} {
		t.Run(endpoint, func(t *testing.T) {
			content := jpegBytes
			if endpoint == "videos" {
				content = mp4Bytes()
			}

			t.Run("без куки — 401", func(t *testing.T) {
				hr := newMediaHarness(t)
				rec := hr.upload(t, endpoint, 7, "file", "x.jpg", content, nil, nil)
				assertMediaError(t, rec, http.StatusUnauthorized)
				assertMediaPrivate(t, rec)
				if hr.store.addCalls != 0 {
					t.Error("аноним дошёл до записи в базу")
				}
			})

			t.Run("подделанная кука — 401", func(t *testing.T) {
				hr := newMediaHarness(t)
				cookie := hr.cookie(t, 10, "owner_activity")
				cookie.Value += "x"
				rec := hr.upload(t, endpoint, 7, "file", "x.jpg", content, nil, cookie)
				assertMediaError(t, rec, http.StatusUnauthorized)
				assertMediaPrivate(t, rec)
			})

			t.Run("сессии не настроены — 503", func(t *testing.T) {
				hr := newMediaHarness(t)
				cookie := hr.cookie(t, 10, "owner_activity")
				hr.handler.sessions = nil
				rec := hr.upload(t, endpoint, 7, "file", "x.jpg", content, nil, cookie)
				assertMediaError(t, rec, http.StatusServiceUnavailable)
				assertMediaPrivate(t, rec)
			})

			t.Run("удалённая учётная запись — 401", func(t *testing.T) {
				hr := newMediaHarness(t)
				cookie := hr.cookie(t, 999, "owner_activity")
				rec := hr.upload(t, endpoint, 7, "file", "x.jpg", content, nil, cookie)
				assertMediaError(t, rec, http.StatusUnauthorized)
			})

			for _, tc := range []struct {
				name   string
				userID int64
				role   string
			}{
				{"обычный пользователь", 30, "user"},
				{"модератор", 40, "moderator"},
				{"тестировщик", 10, "tester"},
				{"роль понижена в базе", 50, "owner_activity"},
			} {
				t.Run(tc.name+" — 403", func(t *testing.T) {
					hr := newMediaHarness(t)
					cookie := hr.cookie(t, tc.userID, tc.role)
					rec := hr.upload(t, endpoint, 7, "file", "x.jpg", content, nil, cookie)
					assertMediaError(t, rec, http.StatusForbidden)
					assertMediaPrivate(t, rec)
					if hr.store.addCalls != 0 {
						t.Error("отказ по роли дошёл до записи в базу")
					}
				})
			}
		})
	}
}

func TestMediaUploadCardRights(t *testing.T) {
	tcs := []struct {
		name   string
		userID int64
		role   string
		cardID int64
		status int
	}{
		{"карточки нет — 404", 10, "owner_activity", 12345, http.StatusNotFound},
		{"чужая карточка — 403", 10, "owner_activity", 8, http.StatusForbidden},
		{"карточка без владельца — 403", 10, "owner_activity", 9, http.StatusForbidden},
		{"владелец занятия и карточка услуги — 403", 10, "owner_activity", 8, http.StatusForbidden},
		{"владелец услуги и карточка занятия — 403", 20, "owner_service", 7, http.StatusForbidden},
		{"своя карточка услуги — 201", 20, "owner_service", 8, http.StatusCreated},
		{"некорректный id — 400", 10, "owner_activity", 0, http.StatusBadRequest},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			hr := newMediaHarness(t)
			cookie := hr.cookie(t, tc.userID, tc.role)
			target := "/api/v1/me/activities/abc/photos"
			if tc.cardID > 0 {
				target = "/api/v1/me/activities/" + strconv.FormatInt(tc.cardID, 10) + "/photos"
			}
			body, contentType := mediaForm(t, "file", "x.jpg", jpegBytes, nil)
			rec := hr.do(t, http.MethodPost, target, body, contentType, cookie)
			if tc.status == http.StatusCreated {
				if rec.Code != tc.status {
					t.Fatalf("статус %d, ждали %d; тело: %s", rec.Code, tc.status, rec.Body.String())
				}
				return
			}
			assertMediaError(t, rec, tc.status)
			assertMediaPrivate(t, rec)
			if hr.store.addCalls != 0 {
				t.Error("отказ по правам дошёл до записи в базу")
			}
			if files := storedFiles(t, hr.dir); len(files) != 0 {
				t.Errorf("отказ оставил файлы на диске: %v", files)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Валидация файла
// ---------------------------------------------------------------------------

func TestMediaUploadPhotoValidation(t *testing.T) {
	tcs := []struct {
		name     string
		field    string
		filename string
		content  []byte
		status   int
	}{
		{"текст под видом jpg — 415", "file", "x.jpg", textBytes, http.StatusUnsupportedMediaType},
		{"SVG — 415", "file", "x.svg", svgBytes, http.StatusUnsupportedMediaType},
		{"GIF — 415", "file", "x.gif", gifBytes, http.StatusUnsupportedMediaType},
		{"пустой файл — 400", "file", "x.jpg", []byte{}, http.StatusBadRequest},
		{"поля file нет — 400", "", "", nil, http.StatusBadRequest},
		{"поле названо photo — 400", "photo", "x.jpg", jpegBytes, http.StatusBadRequest},
		{"JPEG — 201", "file", "x.jpg", jpegBytes, http.StatusCreated},
		{"PNG — 201", "file", "x.png", pngBytes, http.StatusCreated},
		{"WebP — 201", "file", "x.webp", webpBytes, http.StatusCreated},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			hr := newMediaHarness(t)
			cookie := hr.cookie(t, 10, "owner_activity")
			rec := hr.upload(t, "photos", 7, tc.field, tc.filename, tc.content, nil, cookie)
			if tc.status == http.StatusCreated {
				if rec.Code != tc.status {
					t.Fatalf("статус %d, ждали 201; тело: %s", rec.Code, rec.Body.String())
				}
				return
			}
			assertMediaError(t, rec, tc.status)
			assertMediaPrivate(t, rec)
			if files := storedFiles(t, hr.dir); len(files) != 0 {
				t.Errorf("отказ оставил файлы на диске: %v", files)
			}
		})
	}
}

func TestMediaUploadVideoValidation(t *testing.T) {
	broken := mp4Bytes()
	copy(broken[4:8], "free") // не ftyp

	tcs := []struct {
		name    string
		content []byte
		status  int
	}{
		{"MP4 — 201", mp4Bytes(), http.StatusCreated},
		{"не ftyp — 415", broken, http.StatusUnsupportedMediaType},
		{"картинка вместо видео — 415", jpegBytes, http.StatusUnsupportedMediaType},
		{"пустой файл — 400", []byte{}, http.StatusBadRequest},
		{"обрезанный заголовок — 415", []byte{0, 0, 0, 24, 'f', 't'}, http.StatusUnsupportedMediaType},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			hr := newMediaHarness(t)
			cookie := hr.cookie(t, 10, "owner_activity")
			rec := hr.upload(t, "videos", 7, "file", "x.mp4", tc.content, nil, cookie)
			if tc.status == http.StatusCreated {
				if rec.Code != tc.status {
					t.Fatalf("статус %d, ждали 201; тело: %s", rec.Code, rec.Body.String())
				}
				return
			}
			assertMediaError(t, rec, tc.status)
		})
	}
}

func TestMediaUploadTooLarge(t *testing.T) {
	tcs := []struct {
		name     string
		endpoint string
		head     []byte
		size     int
	}{
		{"фото на байт больше потолка", "photos", jpegBytes, (10 << 20) + 1},
		{"тело больше потолка с запасом multipart", "photos", jpegBytes, (10 << 20) + (2 << 20)},
		{"видео на байт больше потолка", "videos", mp4Bytes(), (50 << 20) + 1},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			hr := newMediaHarness(t)
			cookie := hr.cookie(t, 10, "owner_activity")
			body, contentType := bigMediaForm(t, "file", tc.head, tc.size)
			rec := hr.do(t, http.MethodPost, "/api/v1/me/activities/7/"+tc.endpoint, body, contentType, cookie)
			assertMediaError(t, rec, http.StatusRequestEntityTooLarge)
			assertMediaPrivate(t, rec)
			if hr.store.addCalls != 0 {
				t.Error("слишком большой файл дошёл до записи в базу")
			}
			if files := storedFiles(t, hr.dir); len(files) != 0 {
				t.Errorf("отказ оставил файлы на диске: %v", files)
			}
		})
	}
}

func TestMediaUploadNotMultipart(t *testing.T) {
	hr := newMediaHarness(t)
	cookie := hr.cookie(t, 10, "owner_activity")
	rec := hr.do(t, http.MethodPost, "/api/v1/me/activities/7/photos",
		strings.NewReader(`{"file":"base64"}`), "application/json", cookie)
	assertMediaError(t, rec, http.StatusBadRequest)
}

func TestMediaUploadMetadataValidation(t *testing.T) {
	tcs := []struct {
		name   string
		values map[string]string
		field  string
	}{
		{"caption длиннее VARCHAR(240)", map[string]string{"caption": strings.Repeat("я", 241)}, "caption"},
		{"author длиннее VARCHAR(160)", map[string]string{"author": strings.Repeat("я", 161)}, "author"},
		{"source_url длиннее VARCHAR(500)", map[string]string{"source_url": "https://example.com/" + strings.Repeat("a", 500)}, "source_url"},
		{"source_url с javascript:", map[string]string{"source_url": "javascript:alert(1)"}, "source_url"},
		{"caption не UTF-8", map[string]string{"caption": string([]byte{0xff, 0xfe})}, "caption"},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			hr := newMediaHarness(t)
			cookie := hr.cookie(t, 10, "owner_activity")
			rec := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, tc.values, cookie)
			assertMediaError(t, rec, http.StatusBadRequest)
			var body struct {
				Error httpx.Envelope `json:"error"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("разбор ответа: %v", err)
			}
			if _, ok := body.Error.Fields[tc.field]; !ok {
				t.Errorf("в fields нет имени %q: %v", tc.field, body.Error.Fields)
			}
			if hr.store.addCalls != 0 {
				t.Error("неверные метаданные дошли до записи в базу")
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Успешная загрузка
// ---------------------------------------------------------------------------

func TestMediaUploadPhotoSuccess(t *testing.T) {
	for _, tc := range []struct {
		name    string
		content []byte
		ext     string
	}{
		{"JPEG", jpegBytes, ".jpg"},
		{"PNG", pngBytes, ".png"},
		{"WebP", webpBytes, ".webp"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			hr := newMediaHarness(t)
			cookie := hr.cookie(t, 10, "owner_activity")
			rec := hr.upload(t, "photos", 7, "file", "moya-fotografiya.jpg", tc.content,
				map[string]string{"caption": "Занятие акварелью", "source_url": "https://example.com/foto", "author": "Студия Палитра"}, cookie)
			if rec.Code != http.StatusCreated {
				t.Fatalf("статус %d, ждали 201; тело: %s", rec.Code, rec.Body.String())
			}
			assertMediaPrivate(t, rec)

			var got models.CardMedia
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatalf("разбор ответа: %v; тело: %s", err, rec.Body.String())
			}
			if got.ID <= 0 || got.CardID != 7 {
				t.Errorf("id/card_id = %d/%d, ждали >0/7", got.ID, got.CardID)
			}
			if got.Kind != models.MediaKindPhoto {
				t.Errorf("kind = %q, ждали photo", got.Kind)
			}
			if got.Order != 0 {
				t.Errorf("order_num = %d, ждали 0 у первого файла", got.Order)
			}
			// Главное отличие от codex: путь хранится с префиксом раздачи.
			prefix := models.MediaURLPrefix + "cards/7/"
			if !strings.HasPrefix(got.Path, prefix) || !strings.HasSuffix(got.Path, tc.ext) {
				t.Fatalf("path = %q, ждали %s…%s", got.Path, prefix, tc.ext)
			}
			if strings.Contains(got.Path, "moya-fotografiya") {
				t.Errorf("имя файла взято из запроса: %q", got.Path)
			}
			if got.Caption == nil || *got.Caption != "Занятие акварелью" {
				t.Errorf("caption = %v", got.Caption)
			}
			if got.Source == nil || *got.Source != "https://example.com/foto" {
				t.Errorf("source_url = %v", got.Source)
			}
			if got.Author == nil || *got.Author != "Студия Палитра" {
				t.Errorf("author = %v", got.Author)
			}

			// Файл лёг туда, куда указывает путь, и отдаётся тем же маршрутом.
			full := filepath.Join(hr.dir, filepath.FromSlash(strings.TrimPrefix(got.Path, models.MediaURLPrefix)))
			onDisk, err := os.ReadFile(full)
			if err != nil {
				t.Fatalf("файл по пути из ответа не найден: %v", err)
			}
			if !bytes.Equal(onDisk, tc.content) {
				t.Error("содержимое файла не совпадает с загруженным")
			}
			served := hr.do(t, http.MethodGet, got.Path, nil, "", nil)
			if served.Code != http.StatusOK || !bytes.Equal(served.Body.Bytes(), tc.content) {
				t.Errorf("загруженный файл не отдаётся: статус %d", served.Code)
			}
		})
	}
}

func TestMediaUploadVideoSuccess(t *testing.T) {
	hr := newMediaHarness(t)
	cookie := hr.cookie(t, 10, "owner_activity")
	content := mp4Bytes()
	rec := hr.upload(t, "videos", 7, "file", "urok.mp4", content, nil, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("статус %d, ждали 201; тело: %s", rec.Code, rec.Body.String())
	}

	var got models.CardMedia
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("разбор ответа: %v", err)
	}
	if got.Kind != models.MediaKindVideo {
		t.Errorf("kind = %q, ждали video", got.Kind)
	}
	if !strings.HasPrefix(got.Path, models.MediaURLPrefix+"cards/7/") || !strings.HasSuffix(got.Path, ".mp4") {
		t.Errorf("path = %q, ждали /media/cards/7/….mp4", got.Path)
	}
	if got.Caption != nil || got.Source != nil || got.Author != nil {
		t.Errorf("незаполненные метаданные должны быть null: %+v", got.Media)
	}

	full := filepath.Join(hr.dir, filepath.FromSlash(strings.TrimPrefix(got.Path, models.MediaURLPrefix)))
	onDisk, err := os.ReadFile(full)
	if err != nil || !bytes.Equal(onDisk, content) {
		t.Fatalf("видео не легло на диск: %v", err)
	}
	served := hr.do(t, http.MethodGet, got.Path, nil, "", nil)
	if served.Code != http.StatusOK {
		t.Fatalf("видео не отдаётся: статус %d", served.Code)
	}
	if ct := served.Header().Get("Content-Type"); !strings.HasPrefix(ct, "video/mp4") {
		t.Errorf("Content-Type = %q, ждали video/mp4", ct)
	}
}

// Имя файла выбирает crypto/rand, а не клиент: два одинаковых имени не
// перезаписывают друг друга (O_EXCL), и расширение не берётся из запроса.
func TestMediaUploadNamesAreRandomAndExclusive(t *testing.T) {
	hr := newMediaHarness(t)
	cookie := hr.cookie(t, 10, "owner_activity")

	seen := map[string]bool{}
	for i := 0; i < 3; i++ {
		rec := hr.upload(t, "photos", 7, "file", "../../evil.jpg", jpegBytes, nil, cookie)
		if rec.Code != http.StatusCreated {
			t.Fatalf("загрузка %d: статус %d; тело: %s", i, rec.Code, rec.Body.String())
		}
		var got models.CardMedia
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("разбор ответа: %v", err)
		}
		if seen[got.Path] {
			t.Fatalf("имя повторилось: %q", got.Path)
		}
		seen[got.Path] = true
		base := filepath.Base(got.Path)
		if len(base) != len("0123456789abcdef0123456789abcdef.jpg") {
			t.Errorf("имя %q не похоже на 16 случайных байт в hex", base)
		}
		if got.Order != i {
			t.Errorf("order_num = %d, ждали %d", got.Order, i)
		}
	}
	if files := storedFiles(t, hr.dir); len(files) != 3 {
		t.Errorf("на диске %d файлов, ждали 3: %v", len(files), files)
	}
}

// UNIQUE (entity, entity_id, order_num): после удаления середина не переиспользуется,
// следующий номер — MAX+1, и две загрузки не получают один номер.
func TestMediaUploadOrderNumAllocation(t *testing.T) {
	hr := newMediaHarness(t)
	cookie := hr.cookie(t, 10, "owner_activity")

	orders := []int{}
	ids := []int64{}
	for i := 0; i < 3; i++ {
		rec := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
		if rec.Code != http.StatusCreated {
			t.Fatalf("загрузка %d: статус %d", i, rec.Code)
		}
		var got models.CardMedia
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatalf("разбор: %v", err)
		}
		orders = append(orders, got.Order)
		ids = append(ids, got.ID)
	}
	if orders[0] != 0 || orders[1] != 1 || orders[2] != 2 {
		t.Fatalf("порядки = %v, ждали [0 1 2]", orders)
	}

	rec := hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(ids[0], 10), nil, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("удаление: статус %d; тело: %s", rec.Code, rec.Body.String())
	}

	rec = hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("загрузка после удаления: статус %d", rec.Code)
	}
	var got models.CardMedia
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("разбор: %v", err)
	}
	if got.Order != 3 {
		t.Errorf("order_num = %d, ждали 3 (MAX+1, а не освободившийся 0)", got.Order)
	}

	hr.store.mu.Lock()
	defer hr.store.mu.Unlock()
	unique := map[int]bool{}
	for _, row := range hr.store.rows {
		if unique[row.Order] {
			t.Errorf("номер порядка %d занят дважды", row.Order)
		}
		unique[row.Order] = true
	}
}

// Гонка за порядок не должна выглядеть как 500: клиент получает 409 и может
// повторить, а файл-сирота на диске не остаётся.
func TestMediaUploadOrderConflictIsNot500(t *testing.T) {
	hr := newMediaHarness(t)
	hr.store.conflictOnce = true
	cookie := hr.cookie(t, 10, "owner_activity")

	rec := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
	assertMediaError(t, rec, http.StatusConflict)
	if files := storedFiles(t, hr.dir); len(files) != 0 {
		t.Errorf("после отказа на диске остались файлы: %v", files)
	}
}

func TestMediaUploadStoreFailureRemovesFile(t *testing.T) {
	hr := newMediaHarness(t)
	hr.store.addErr = errors.New("база недоступна")
	cookie := hr.cookie(t, 10, "owner_activity")

	rec := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
	assertMediaError(t, rec, http.StatusInternalServerError)
	if files := storedFiles(t, hr.dir); len(files) != 0 {
		t.Errorf("файл-сирота после отказа базы: %v", files)
	}
}

func TestMediaUploadStorageFailure(t *testing.T) {
	hr := newMediaHarness(t)
	// Том занят обычным файлом: создать каталог карточки нельзя.
	blocked := filepath.Join(filepath.Dir(hr.dir), "media-as-file")
	if err := os.WriteFile(blocked, []byte("не каталог"), 0o640); err != nil {
		t.Fatalf("файл вместо тома: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(blocked) })
	hr.handler.root = blocked

	cookie := hr.cookie(t, 10, "owner_activity")
	rec := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
	assertMediaError(t, rec, http.StatusInternalServerError)
	if hr.store.addCalls != 0 {
		t.Error("файл не сохранён, а строка в базе создана")
	}
}

// Лимитер — тот же internal/auth.Limiter, что у входа (§12.2), ключ — владелец.
func TestMediaUploadRateLimit(t *testing.T) {
	hr := newMediaHarness(t, WithMediaUploadLimiter(auth.NewLimiter(1, time.Minute)))
	cookie := hr.cookie(t, 10, "owner_activity")

	first := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
	if first.Code != http.StatusCreated {
		t.Fatalf("первая загрузка: статус %d; тело: %s", first.Code, first.Body.String())
	}
	second := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
	assertMediaError(t, second, http.StatusTooManyRequests)
	if second.Header().Get("Retry-After") == "" {
		t.Error("429 без Retry-After: клиент не знает, сколько ждать")
	}

	// Другой владелец делит окно с первым только если ключ — IP; у нас ключ — id.
	other := hr.cookie(t, 20, "owner_service")
	body, contentType := mediaForm(t, "file", "x.jpg", jpegBytes, nil)
	rec := hr.do(t, http.MethodPost, "/api/v1/me/activities/8/photos", body, contentType, other)
	if rec.Code != http.StatusCreated {
		t.Errorf("второй владелец заблокирован чужим окном: статус %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// DELETE …/media/{mediaID}
// ---------------------------------------------------------------------------

func TestMediaDeleteRemovesRowAndFile(t *testing.T) {
	hr := newMediaHarness(t)
	row := hr.store.seedMedia(t, hr.dir, 7, 0, models.MediaKindPhoto, "ab12cd.jpg")
	cookie := hr.cookie(t, 10, "owner_activity")

	rec := hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(row.ID, 10), nil, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d, ждали 200; тело: %s", rec.Code, rec.Body.String())
	}
	assertMediaPrivate(t, rec)

	var got models.MediaDeleted
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("разбор ответа: %v; тело: %s", err, rec.Body.String())
	}
	if !got.Deleted || got.ID != row.ID || got.CardID != 7 {
		t.Errorf("ответ = %+v, ждали deleted:true id:%d card_id:7", got, row.ID)
	}
	if _, ok := hr.store.rows[row.ID]; ok {
		t.Error("строка осталась в базе")
	}
	full := filepath.Join(hr.dir, "cards", "7", "ab12cd.jpg")
	if _, err := os.Stat(full); !os.IsNotExist(err) {
		t.Errorf("файл остался на диске: %v", err)
	}
}

func TestMediaDeleteRefusesForeignAndMissing(t *testing.T) {
	tcs := []struct {
		name    string
		userID  int64
		role    string
		cardID  int64
		mediaOf int64
		status  int
	}{
		{"чужая карточка — 403", 10, "owner_activity", 8, 8, http.StatusForbidden},
		{"медиа другой карточки — 404", 10, "owner_activity", 7, 8, http.StatusNotFound},
		{"медиа нет — 404", 10, "owner_activity", 7, 0, http.StatusNotFound},
		{"роль не владелец — 403", 30, "user", 7, 7, http.StatusForbidden},
		{"владелец услуги и занятие — 403", 20, "owner_service", 7, 7, http.StatusForbidden},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			hr := newMediaHarness(t)
			row := hr.store.seedMedia(t, hr.dir, 7, 0, models.MediaKindPhoto, "sedmoy.jpg")
			if tc.mediaOf == 8 {
				hr.store.seedMedia(t, hr.dir, 8, 0, models.MediaKindPhoto, "vosmoy.jpg")
			}
			cookie := hr.cookie(t, tc.userID, tc.role)
			mediaID := row.ID
			if tc.mediaOf == 0 {
				mediaID = 999999
			} else if tc.mediaOf == 8 {
				for id, r := range hr.store.rows {
					if r.CardID == 8 {
						mediaID = id
					}
				}
			}
			rec := hr.do(t, http.MethodDelete,
				"/api/v1/me/activities/"+strconv.FormatInt(tc.cardID, 10)+"/media/"+strconv.FormatInt(mediaID, 10),
				nil, "", cookie)
			assertMediaError(t, rec, tc.status)
			assertMediaPrivate(t, rec)
			if len(hr.store.rows) == 0 {
				t.Error("отказ удалил строку")
			}
			if files := storedFiles(t, hr.dir); len(files) == 0 {
				t.Error("отказ удалил файл с диска")
			}
		})
	}
}

func TestMediaDeleteMissingFileIsSuccess(t *testing.T) {
	hr := newMediaHarness(t)
	row := hr.store.seedMedia(t, hr.dir, 7, 0, models.MediaKindPhoto, "poteryan.jpg")
	if err := os.Remove(filepath.Join(hr.dir, "cards", "7", "poteryan.jpg")); err != nil {
		t.Fatalf("уборка файла: %v", err)
	}
	cookie := hr.cookie(t, 10, "owner_activity")

	rec := hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(row.ID, 10), nil, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d, ждали 200: отсутствующий файл — не ошибка; тело: %s", rec.Code, rec.Body.String())
	}
	if _, ok := hr.store.rows[row.ID]; ok {
		t.Error("строка осталась в базе")
	}
}

// Путь из базы не обязан быть честным: строка могла остаться от прошлой версии
// или быть подделанной. Удалять по нему файл за пределами тома нельзя.
func TestMediaDeleteUnsafeDBPath(t *testing.T) {
	hr := newMediaHarness(t)
	outside := filepath.Join(filepath.Dir(hr.dir), "secret-delete.txt")
	if err := os.WriteFile(outside, []byte("не трогать"), 0o640); err != nil {
		t.Fatalf("внешний файл: %v", err)
	}
	t.Cleanup(func() { _ = os.Remove(outside) })

	hr.store.mu.Lock()
	row := models.CardMedia{
		ID:     hr.store.nextID,
		CardID: 7,
		Kind:   models.MediaKindPhoto,
		Media:  models.Media{Path: "../../secret-delete.txt", Order: 0},
	}
	hr.store.nextID++
	hr.store.rows[row.ID] = row
	hr.store.mu.Unlock()

	cookie := hr.cookie(t, 10, "owner_activity")
	rec := hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(row.ID, 10), nil, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d, ждали 200: строка удалена, файл трогать нельзя; тело: %s", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(outside); err != nil {
		t.Errorf("файл за пределами тома удалён: %v", err)
	}
	if _, ok := hr.store.rows[row.ID]; ok {
		t.Error("строка осталась в базе")
	}
}

func TestMediaDeleteBadIDs(t *testing.T) {
	hr := newMediaHarness(t)
	cookie := hr.cookie(t, 10, "owner_activity")
	for _, target := range []string{
		"/api/v1/me/activities/abc/media/1",
		"/api/v1/me/activities/7/media/abc",
		"/api/v1/me/activities/-7/media/1",
		"/api/v1/me/activities/7/media/0",
	} {
		t.Run(target, func(t *testing.T) {
			rec := hr.do(t, http.MethodDelete, target, nil, "", cookie)
			assertMediaError(t, rec, http.StatusBadRequest)
		})
	}
}

func TestMediaDeleteStoreFailure(t *testing.T) {
	hr := newMediaHarness(t)
	row := hr.store.seedMedia(t, hr.dir, 7, 0, models.MediaKindPhoto, "celiy.jpg")
	hr.store.deleteErr = errors.New("база недоступна")
	cookie := hr.cookie(t, 10, "owner_activity")

	rec := hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(row.ID, 10), nil, "", cookie)
	assertMediaError(t, rec, http.StatusInternalServerError)
	if _, err := os.Stat(filepath.Join(hr.dir, "cards", "7", "celiy.jpg")); err != nil {
		t.Errorf("файл удалён, хотя строка осталась: %v", err)
	}
}

// Форма ответа — контракт, по которому пишет web: поля и типы фиксируются здесь,
// иначе переименование order_num в position ломает клиент молча.
func TestMediaUploadResponseShape(t *testing.T) {
	hr := newMediaHarness(t)
	cookie := hr.cookie(t, 10, "owner_activity")
	rec := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, map[string]string{"caption": "Подпись"}, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("статус %d, ждали 201; тело: %s", rec.Code, rec.Body.String())
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
		t.Fatalf("разбор ответа: %v", err)
	}
	want := map[string]string{
		"id":         "number",
		"card_id":    "number",
		"kind":       "string",
		"path":       "string",
		"caption":    "string",
		"source_url": "null",
		"author":     "null",
		"order_num":  "number",
	}
	if len(raw) != len(want) {
		t.Errorf("в ответе %d полей, ждали %d: %s", len(raw), len(want), rec.Body.String())
	}
	for name, kind := range want {
		value, ok := raw[name]
		if !ok {
			t.Errorf("в ответе нет поля %q", name)
			continue
		}
		switch kind {
		case "number":
			var n float64
			if err := json.Unmarshal(value, &n); err != nil {
				t.Errorf("%s = %s, ждали число", name, value)
			}
		case "string":
			var s string
			if err := json.Unmarshal(value, &s); err != nil {
				t.Errorf("%s = %s, ждали строку", name, value)
			}
		case "null":
			if string(value) != "null" {
				t.Errorf("%s = %s, ждали null у незаполненного поля", name, value)
			}
		}
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Errorf("Content-Type = %q", ct)
	}

	// Удаление отвечает 200 с телом, а не 204: клиенту нужно знать, что удалилось.
	var uploaded models.CardMedia
	if err := json.Unmarshal(rec.Body.Bytes(), &uploaded); err != nil {
		t.Fatalf("разбор загруженного: %v", err)
	}
	del := hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(uploaded.ID, 10), nil, "", cookie)
	if del.Code != http.StatusOK {
		t.Fatalf("удаление: статус %d; тело: %s", del.Code, del.Body.String())
	}
	var delRaw map[string]json.RawMessage
	if err := json.Unmarshal(del.Body.Bytes(), &delRaw); err != nil {
		t.Fatalf("разбор ответа удаления: %v", err)
	}
	if len(delRaw) != 3 || string(delRaw["deleted"]) != "true" {
		t.Errorf("ответ удаления = %s, ждали deleted:true, id, card_id", del.Body.String())
	}
	for _, name := range []string{"id", "card_id"} {
		var n float64
		if err := json.Unmarshal(delRaw[name], &n); err != nil {
			t.Errorf("%s = %s, ждали число", name, delRaw[name])
		}
	}
}

// Раздача не принимает запись: под r.Handle("/media/*") POST иначе получил бы
// файл в ответ на запрос, который ничего не читает.
func TestMediaServeRejectsWriteMethods(t *testing.T) {
	hr := newMediaHarness(t)
	if err := os.WriteFile(filepath.Join(hr.dir, "x.jpg"), jpegBytes, 0o640); err != nil {
		t.Fatalf("файл: %v", err)
	}
	for _, method := range []string{http.MethodPost, http.MethodDelete, http.MethodPut} {
		t.Run(method, func(t *testing.T) {
			req := httptest.NewRequest(method, "/media/x.jpg", nil)
			rec := httptest.NewRecorder()
			hr.handler.Serve(rec, req)
			assertMediaError(t, rec, http.StatusMethodNotAllowed)
			if got := rec.Header().Get("Allow"); got != "GET, HEAD" {
				t.Errorf("Allow = %q, ждали GET, HEAD", got)
			}
		})
	}

	// HEAD обязан отдать заголовки без тела: его шлют и браузеры, и оптимизатор
	// картинок Next.js.
	req := httptest.NewRequest(http.MethodHead, "/media/x.jpg", nil)
	rec := httptest.NewRecorder()
	hr.handler.Serve(rec, req)
	if rec.Code != http.StatusOK || rec.Body.Len() != 0 {
		t.Errorf("HEAD: статус %d, тело %d байт", rec.Code, rec.Body.Len())
	}
}

// Подделанный path в базе не должен снимать каталог соседней карточки.
func TestMediaDeleteKeepsDirectory(t *testing.T) {
	hr := newMediaHarness(t)
	dir := filepath.Join(hr.dir, "cards", "8")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatalf("каталог: %v", err)
	}

	hr.store.mu.Lock()
	row := models.CardMedia{
		ID:     hr.store.nextID,
		CardID: 7,
		Kind:   models.MediaKindPhoto,
		Media:  models.Media{Path: models.MediaURLPrefix + "cards/8", Order: 0},
	}
	hr.store.nextID++
	hr.store.rows[row.ID] = row
	hr.store.mu.Unlock()

	cookie := hr.cookie(t, 10, "owner_activity")
	rec := hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(row.ID, 10), nil, "", cookie)
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d, ждали 200; тело: %s", rec.Code, rec.Body.String())
	}
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		t.Errorf("каталог соседней карточки удалён: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Статус карточки: галерея на витрине и на проверке — не самообслуживание
// ---------------------------------------------------------------------------

// lockedCardMessage — 409 обязан объяснять, что делать, и совет зависит от
// статуса: опубликованную снять с публикации, а на проверке — дождаться решения.
// Голое «нельзя» владелец не поймёт.
var lockedCardMessage = map[string]string{
	models.CardStatusPublished:    "снимите её с публикации",
	models.CardStatusOnModeration: "дождитесь решения",
}

func assertMediaLockedConflict(t *testing.T, rec *httptest.ResponseRecorder, status string) {
	t.Helper()

	assertMediaError(t, rec, http.StatusConflict)
	assertMediaPrivate(t, rec)
	var body struct {
		Error httpx.Envelope `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("ответ не конверт §9: %v", err)
	}
	want := lockedCardMessage[status]
	if want == "" {
		t.Fatalf("тест не знает совета для статуса %q", status)
	}
	if !strings.Contains(body.Error.Message, want) {
		t.Errorf("сообщение 409 = %q, ждали совет %q", body.Error.Message, want)
	}
}

// TestMediaLockedCardRefusesMutation — загрузка и удаление запрещены и на
// published, и на on_moderation. Published очевиден: файл лёг бы прямо в каталог.
// On_moderation — та же дыра с отсрочкой: модератор открыл очередь и смотрит фото
// A, владелец подменяет его на B, модератор одобряет — и DecideApplication ставит
// published, не перечитывая медиа (repository/moderation.go). На витрине оказывается
// B, которого никто не проверял. Текст анкеты на on_moderation править уже нельзя
// (repository/owned_activities.go), галерея обязана вести себя так же.
// Отказ стоит до чтения тела и до записи: ни строки, ни файла не появляется и не
// исчезает.
func TestMediaLockedCardRefusesMutation(t *testing.T) {
	for _, status := range []string{models.CardStatusPublished, models.CardStatusOnModeration} {
		t.Run(status, func(t *testing.T) {
			t.Run("фото — 409", func(t *testing.T) {
				hr := newMediaHarness(t)
				hr.store.cards[7] = models.MediaCard{ID: 7, OwnerID: 10, Kind: "activity", Status: status}
				cookie := hr.cookie(t, 10, "owner_activity")

				rec := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
				assertMediaLockedConflict(t, rec, status)
				if hr.store.addCalls != 0 {
					t.Error("закрытая карточка дошла до записи в базу")
				}
				if files := storedFiles(t, hr.dir); len(files) != 0 {
					t.Errorf("отказ оставил файлы на диске: %v", files)
				}
			})
			t.Run("видео — 409", func(t *testing.T) {
				hr := newMediaHarness(t)
				hr.store.cards[7] = models.MediaCard{ID: 7, OwnerID: 10, Kind: "activity", Status: status}
				cookie := hr.cookie(t, 10, "owner_activity")

				rec := hr.upload(t, "videos", 7, "file", "x.mp4", mp4Bytes(), nil, cookie)
				assertMediaLockedConflict(t, rec, status)
				if hr.store.addCalls != 0 {
					t.Error("закрытая карточка дошла до записи в базу")
				}
				if files := storedFiles(t, hr.dir); len(files) != 0 {
					t.Errorf("отказ оставил файлы на диске: %v", files)
				}
			})
			t.Run("удаление — 409", func(t *testing.T) {
				hr := newMediaHarness(t)
				// Строка легла до блокировки: удаление сейчас тоже меняет то,
				// что увидит посетитель или модератор.
				row := hr.store.seedMedia(t, hr.dir, 7, 0, models.MediaKindPhoto, "proverennaya.jpg")
				hr.store.cards[7] = models.MediaCard{ID: 7, OwnerID: 10, Kind: "activity", Status: status}
				cookie := hr.cookie(t, 10, "owner_activity")

				rec := hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(row.ID, 10), nil, "", cookie)
				assertMediaLockedConflict(t, rec, status)
				if _, ok := hr.store.rows[row.ID]; !ok {
					t.Error("отказ удалил строку из базы")
				}
				if _, err := os.Stat(filepath.Join(hr.dir, "cards", "7", "proverennaya.jpg")); err != nil {
					t.Errorf("отказ удалил файл с диска: %v", err)
				}
			})
		})
	}
}

// TestMediaMutationAllowedInEditableStatuses — draft и rejected галерея правится
// свободно: иначе владелец не смог бы донести файлы до подачи анкеты и исправить
// их после отказа. On_moderation сюда не входит — см. TestMediaLockedCardRefusesMutation.
func TestMediaMutationAllowedInEditableStatuses(t *testing.T) {
	for _, status := range []string{models.CardStatusDraft, models.CardStatusRejected} {
		t.Run(status, func(t *testing.T) {
			hr := newMediaHarness(t)
			hr.store.cards[7] = models.MediaCard{ID: 7, OwnerID: 10, Kind: "activity", Status: status}
			cookie := hr.cookie(t, 10, "owner_activity")

			rec := hr.upload(t, "photos", 7, "file", "x.jpg", jpegBytes, nil, cookie)
			if rec.Code != http.StatusCreated {
				t.Fatalf("фото в статусе %s: код %d, ждали 201; тело: %s", status, rec.Code, rec.Body.String())
			}
			rec = hr.upload(t, "videos", 7, "file", "x.mp4", mp4Bytes(), nil, cookie)
			if rec.Code != http.StatusCreated {
				t.Fatalf("видео в статусе %s: код %d, ждали 201; тело: %s", status, rec.Code, rec.Body.String())
			}

			row := hr.store.seedMedia(t, hr.dir, 7, 2, models.MediaKindPhoto, "udalyaemaya.jpg")
			rec = hr.do(t, http.MethodDelete, "/api/v1/me/activities/7/media/"+strconv.FormatInt(row.ID, 10), nil, "", cookie)
			if rec.Code != http.StatusOK {
				t.Fatalf("удаление в статусе %s: код %d, ждали 200; тело: %s", status, rec.Code, rec.Body.String())
			}
			if _, ok := hr.store.rows[row.ID]; ok {
				t.Error("строка осталась в базе после разрешённого удаления")
			}
		})
	}
}

// TestMediaPublishedCardForeignStill403 — проверка статуса стоит ПОСЛЕ прав:
// чужая опубликованная карточка остаётся 403, а не 409. Иначе отказ подсказывал
// бы постороннему, что карточка существует и опубликована.
func TestMediaPublishedCardForeignStill403(t *testing.T) {
	for _, tc := range []struct {
		name   string
		userID int64
		role   string
		cardID int64
		kind   string
		owner  int64
	}{
		{"чужой владелец", 20, "owner_service", 7, "activity", 10},
		{"роль не того вида", 10, "owner_activity", 8, "service", 20},
	} {
		t.Run(tc.name, func(t *testing.T) {
			hr := newMediaHarness(t)
			hr.store.cards[tc.cardID] = models.MediaCard{ID: tc.cardID, OwnerID: tc.owner, Kind: tc.kind, Status: models.CardStatusPublished}
			row := hr.store.seedMedia(t, hr.dir, tc.cardID, 0, models.MediaKindPhoto, "chuzhaya.jpg")
			cookie := hr.cookie(t, tc.userID, tc.role)

			rec := hr.upload(t, "photos", tc.cardID, "file", "x.jpg", jpegBytes, nil, cookie)
			assertMediaError(t, rec, http.StatusForbidden)
			rec = hr.upload(t, "videos", tc.cardID, "file", "x.mp4", mp4Bytes(), nil, cookie)
			assertMediaError(t, rec, http.StatusForbidden)
			rec = hr.do(t, http.MethodDelete,
				"/api/v1/me/activities/"+strconv.FormatInt(tc.cardID, 10)+"/media/"+strconv.FormatInt(row.ID, 10),
				nil, "", cookie)
			assertMediaError(t, rec, http.StatusForbidden)

			if hr.store.addCalls != 0 {
				t.Error("чужой дошёл до записи в базу")
			}
			if _, ok := hr.store.rows[row.ID]; !ok {
				t.Error("чужой удалил строку")
			}
			if files := storedFiles(t, hr.dir); len(files) != 1 {
				t.Errorf("на диске %d файлов, ждали только засеянный: %v", len(files), files)
			}
		})
	}
}

// storedFiles — все обычные файлы тома. Пустой список означает, что отказ не
// оставил сироту: именно это отличает «проверили и отказали» от «записали и забыли».
func storedFiles(t *testing.T, dir string) []string {
	t.Helper()

	var out []string
	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.Type().IsRegular() {
			rel, relErr := filepath.Rel(dir, path)
			if relErr != nil {
				return relErr
			}
			out = append(out, filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		t.Fatalf("обход тома: %v", err)
	}
	return out
}
