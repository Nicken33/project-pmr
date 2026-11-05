package handlers

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/argon2"

	"talentro/internal/auth"
	"talentro/internal/models"
)

// §12.2 в исходном виде говорит про «вход», поэтому окно у всех способов войти
// одно, а заглушка в Login обязана считаться и на аккаунте без пароля. Эти
// проверки держат ровно то, что не видно в обычных ответах: время отказа и
// исчерпанный счётчик.

// heavyDecoy — PHC-строка заметно дороже тестовых «соломинок»: 8 MiB памяти и
// 8 проходов. Нужна затем, чтобы работа сверки измерялась миллисекундами, а не
// шумом прогона: иначе нельзя отличить «посчитали заглушку» от «сразу отказали».
// Параметры не выходят за границы, которые принимает parsePHC (t ≤ 8).
func heavyDecoy(t *testing.T, password string) string {
	t.Helper()

	salt := []byte("sol-za-glushkoy-01234567")
	dk := argon2.IDKey([]byte(password), salt, 8, 8192, 2, 32)
	return fmt.Sprintf("$argon2id$v=19$m=8192,t=8,p=2$%s$%s",
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(dk))
}

// measureVerify — минимальное из трёх замеров одной сверки. Минимальное, потому
// что интересует нас не «как долго вообще», а «была ли работа сделана»: нижняя
// граница порога устойчивее, чем среднее с выбросами планировщика.
func measureVerify(t *testing.T, stored string) time.Duration {
	t.Helper()

	var best time.Duration
	for i := 0; i < 3; i++ {
		start := time.Now()
		if auth.VerifyPassword(stored, "замер-стоимости") {
			t.Fatal("заглушка сверилась с посторонним паролем")
		}
		if d := time.Since(start); best == 0 || d < best {
			best = d
		}
	}
	return best
}

// Отказ по времени не должен выдавать существование почты. Есть два «пустых»
// случая: почты нет вовсе (ErrNoUser) и она есть, но пароля в базе нет (§3.7.4).
// Оба обязаны потратить столько же, сколько настоящая сверка, иначе перебор
// адреса читается по миллисекундам, даже когда текст и статус одинаковые.
func TestLoginRefusalsSpendTheDecoyWork(t *testing.T) {
	h := newLocalHarness(t)
	h.handler.loginDecoy = heavyDecoy(t, decoySecret)

	baseline := measureVerify(t, h.handler.loginDecoy)
	if baseline < time.Millisecond {
		t.Skipf("сверка с заглушкой заняла %v: замер тонет в шуме прогона, проверка бессмысленна", baseline)
	}

	tcs := []struct {
		name  string
		email string
	}{
		{"почты нет", "nikto-net@example.com"},
		{"аккаунт без пароля", "gosha@gmail.com"},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			start := time.Now()
			rec := doLogin(t, h.handler, loginBody(t, tc.email, localPassword), "")
			elapsed := time.Since(start)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("код = %d, ждали 401: %s", rec.Code, rec.Body.String())
			}
			if msg := decodeEnvelope(t, rec).Error.Message; msg != badCredentials {
				t.Errorf("сообщение = %q, ждали %q", msg, badCredentials)
			}
			// Порог — половина чистой сверки: на работу хендлера, фейка и записи
			// ответа время только растёт, а вот её отсутствие даёт разницу в
			// два порядка.
			if elapsed < baseline/2 {
				t.Errorf("отказ занял %v при сверке %v: заглушка не считалась, и по времени "+
					"такой ответ отличается от «неверный пароль»", elapsed, baseline)
			}
		})
	}
}

// countingVerifier считает обращения к Google: лимит обязан срабатывать до них,
// иначе один посетитель превращает наш api в усилитель запросов наружу.
type countingVerifier struct{ calls int }

func (v *countingVerifier) Verify(string) (*models.GoogleProfile, error) {
	v.calls++
	return &models.GoogleProfile{Sub: "sub-1", Email: "pasha@example.com", Name: "Паша"}, nil
}

// fakeGoogleUsers — шов UserStore: вход через сервис заводит строку users.
type fakeGoogleUsers struct{ nextID int64 }

func (f *fakeGoogleUsers) UpsertGoogleUser(p models.GoogleProfile) (models.User, error) {
	f.nextID++
	return models.User{ID: f.nextID, Email: p.Email, Name: p.Name, Provider: "google", Role: "user"}, nil
}

const (
	testerTokenValue = "токен-проверки-для-тестов-0123456789"
	googleID         = "test-client-id.apps.example"
)

func newTokenHarness(t *testing.T) (*AuthHandler, *countingVerifier) {
	t.Helper()

	store, err := auth.NewStore(localSecret)
	if err != nil {
		t.Fatalf("auth.NewStore: %v", err)
	}
	verifier := &countingVerifier{}

	return &AuthHandler{
		verifier:       verifier,
		users:          &fakeGoogleUsers{},
		local:          newLocalHarness(t).users,
		store:          store,
		googleClientID: googleID,
		testerToken:    testerTokenValue,
		loginLimit:     auth.NewLimiter(loginAttempts, time.Minute),
		registerLimit:  auth.NewLimiter(registerAttempts, time.Hour),
		loginDecoy:     cheapHash(t, decoySecret, "salt-decoy-window"),
	}, verifier
}

func postForm(t *testing.T, path, body string) *http.Request {
	t.Helper()

	r := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	return r
}

// §12.2: «вход — 10 попыток в минуту с одного IP». У входа по токену и у Google
// своего лимита не было, поэтому токен проверки можно было подбирать со
// скоростью соединения, а сверку в Google вызывать без ограничения вовсе.
func TestTesterLoginIsRateLimited(t *testing.T) {
	h, _ := newTokenHarness(t)

	for i := 1; i <= loginAttempts; i++ {
		rec := httptest.NewRecorder()
		h.TesterLogin(rec, postForm(t, "/api/auth/tester", `{"token":"не-тот-токен"}`))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("попытка %d: код = %d, ждали 401: %s", i, rec.Code, rec.Body.String())
		}
	}

	rec := httptest.NewRecorder()
	h.TesterLogin(rec, postForm(t, "/api/auth/tester", `{"token":"`+testerTokenValue+`"}`))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("после лимита: код = %d, ждали 429: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Error("429 без Retry-After")
	}
	if len(rec.Header().Values("Set-Cookie")) != 0 {
		t.Error("на 429 кука выставлена: верный токен всё равно вошёл бы")
	}
}

// Битое тело — 400, и счётчик оно не двигает (та же связка, что у пароля).
func TestTesterMalformedBodyDoesNotConsumeQuota(t *testing.T) {
	h, _ := newTokenHarness(t)

	for i := 0; i < 3; i++ {
		rec := httptest.NewRecorder()
		h.TesterLogin(rec, postForm(t, "/api/auth/tester", "{"))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("код = %d, ждали 400: %s", rec.Code, rec.Body.String())
		}
	}

	rec := httptest.NewRecorder()
	h.TesterLogin(rec, postForm(t, "/api/auth/tester", `{"token":"`+testerTokenValue+`"}`))
	if rec.Code != http.StatusOK {
		t.Errorf("после трёх 400 вход отклонён: код = %d, ждали 200", rec.Code)
	}
}

// Окно входа одно на все способы войти: §12.2 считает попытки входа с адреса, а
// не в каждой эндпоинте, и переключаться между ними, чтобы получить втрое
// больше попыток, нельзя.
func TestLoginWindowIsSharedAcrossMethods(t *testing.T) {
	h, verifier := newTokenHarness(t)

	// Пять попыток паролем + пять токеном проверки = десять из десяти.
	for i := 0; i < 5; i++ {
		rec := doLogin(t, h, loginBody(t, "nikto-net@example.com", "не-тот-пароль"), "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("вход паролем %d: код = %d, ждали 401", i+1, rec.Code)
		}
	}
	for i := 0; i < 5; i++ {
		rec := httptest.NewRecorder()
		h.TesterLogin(rec, postForm(t, "/api/auth/tester", `{"token":"не-тот"}`))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("вход токеном %d: код = %d, ждали 401", i+1, rec.Code)
		}
	}

	rec := httptest.NewRecorder()
	h.GoogleLogin(rec, postForm(t, "/api/auth/google", `{"credential":"какой-то-токен"}`))
	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("google: код = %d, ждали 429 (одиннадцатый вход того же окна): %s", rec.Code, rec.Body.String())
	}
	if verifier.calls != 0 {
		t.Errorf("обращений к Google = %d, ждали 0: лимит обязан срабатывать до внешней сверки", verifier.calls)
	}

	// Регистрация живёт в своём окне (3/час) и от входа не зависит.
	reg := httptest.NewRecorder()
	h.Register(reg, postForm(t, "/api/auth/register", structJSON(t, map[string]any{
		"email": "ok-0@example.com", "password": localPassword, "name": "Ноль",
	})))
	if reg.Code != http.StatusCreated {
		t.Errorf("register на заблокированном входе: код = %d, ждали 201: %s", reg.Code, reg.Body.String())
	}
}

// Google-вход тоже считается: сверка идёт наружу, и без счётчика один адрес
// держал бы очередь запросов к oauth2.googleapis.com сколь угодно долго.
func TestGoogleLoginIsRateLimited(t *testing.T) {
	h, verifier := newTokenHarness(t)

	for i := 1; i <= loginAttempts; i++ {
		rec := httptest.NewRecorder()
		h.GoogleLogin(rec, postForm(t, "/api/auth/google", `{"credential":"токен-`+fmt.Sprint(i)+`"}`))
		if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusOK {
			t.Fatalf("попытка %d: код = %d, ждали ответ сверки", i, rec.Code)
		}
	}
	calls := verifier.calls
	if calls != loginAttempts {
		t.Fatalf("обращений к Google = %d, ждали %d", calls, loginAttempts)
	}

	rec := httptest.NewRecorder()
	h.GoogleLogin(rec, postForm(t, "/api/auth/google", `{"credential":"ещё-один"}`))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("одиннадцатая: код = %d, ждали 429: %s", rec.Code, rec.Body.String())
	}
	if verifier.calls != calls {
		t.Errorf("сверх лимита к Google ушло ещё %d запросов: счётчик стоит после сверки, а должен до", verifier.calls-calls)
	}
}

// Тело эндпоинтов входа ограничено: MaxBytesReader обрывает чтение, а не только
// разбор, поэтому «некорректное тело» нельзя получить, закачав мегабайты.
func TestAuthRejectsOversizedBody(t *testing.T) {
	h := newLocalHarness(t)

	body := `{"email":"` + strings.Repeat("a", maxAuthBodyBytes) + `@example.com","password":"` + localPassword + `"}`
	rec := doLogin(t, h.handler, body, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("код = %d, ждали 400: %s", rec.Code, rec.Body.String())
	}
	if msg := decodeEnvelope(t, rec).Error.Message; msg != "некорректное тело запроса" {
		t.Errorf("сообщение = %q, ждали текст про разбор тела", msg)
	}
	if len(rec.Header().Values("Set-Cookie")) != 0 {
		t.Error("на 400 выставлена кука")
	}
}
