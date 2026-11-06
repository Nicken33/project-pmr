package handlers

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"talentro/internal/config"
)

// Обязательность aud — то, из-за чего вход через Google нельзя было открыть
// «любым ID-токеном». Сверка проверяется без сети: подменён только endpoint.
func TestTokenInfoVerifierEnforcesAudience(t *testing.T) {
	tests := []struct {
		name        string
		clientID    string
		status      int
		body        string
		wantErr     bool
		wantEmail   string
		wantErrText string
	}{
		{
			name:      "токен нашего клиента",
			clientID:  "our-client.apps.test",
			status:    http.StatusOK,
			body:      `{"sub":"1","email":"parent@example.test","aud":"our-client.apps.test","name":"Родитель","email_verified":"true"}`,
			wantEmail: "parent@example.test",
		},
		{
			name:        "токен чужого клиента",
			clientID:    "our-client.apps.test",
			status:      http.StatusOK,
			body:        `{"sub":"1","email":"parent@example.test","aud":"chuzhoj-client"}`,
			wantErr:     true,
			wantErrText: "другого клиента",
		},
		{
			name:        "aud отсутствует",
			clientID:    "our-client.apps.test",
			status:      http.StatusOK,
			body:        `{"sub":"1","email":"parent@example.test"}`,
			wantErr:     true,
			wantErrText: "другого клиента",
		},
		{
			name:        "Google сообщил ошибку",
			clientID:    "our-client.apps.test",
			status:      http.StatusBadRequest,
			body:        `{"error":"invalid_token","error_description":"Signature did not match"}`,
			wantErr:     true,
			wantErrText: "HTTP 400",
		},
		{
			name:        "нет subject",
			clientID:    "our-client.apps.test",
			status:      http.StatusOK,
			body:        `{"aud":"our-client.apps.test","email":"parent@example.test"}`,
			wantErr:     true,
			wantErrText: "subject",
		},
		{
			name:        "ответ не JSON",
			clientID:    "our-client.apps.test",
			status:      http.StatusOK,
			body:        "<html>прокси перехватил запрос</html>",
			wantErr:     true,
			wantErrText: "разбор ответа",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotQuery string
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotQuery = r.URL.RawQuery
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(tt.body))
			}))
			defer srv.Close()

			v := &tokenInfoVerifier{clientID: tt.clientID, client: srv.Client(), endpoint: srv.URL}
			profile, err := v.Verify("eyJhbGciOi.токен.подпись")

			switch {
			case tt.wantErr && err == nil:
				t.Fatalf("ожидалась ошибка, получено %+v", profile)
			case !tt.wantErr && err != nil:
				t.Fatalf("неожиданная ошибка: %v", err)
			}
			if tt.wantErrText != "" && !strings.Contains(err.Error(), tt.wantErrText) {
				t.Errorf("текст ошибки = %q, ожидалось вхождение %q", err.Error(), tt.wantErrText)
			}
			if profile != nil && profile.Email != tt.wantEmail {
				t.Errorf("email = %q, ожидалось %q", profile.Email, tt.wantEmail)
			}
			// credential обязан уйти закодированным параметром, а не склеиться в путь.
			if !strings.Contains(gotQuery, "id_token=eyJhbGciOi.") {
				t.Errorf("credential не передан параметром: %q", gotQuery)
			}
		})
	}
}

// Пустой client ID — не «пропускаем проверку», а «вход закрыт»: он проверяется
// выше на уровне handler-а, здесь — что верификатор не примет токен вовсе.
func TestTokenInfoVerifierRejectsWhenClientIDEmpty(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"sub":"1","aud":"любой","email":"parent@example.test"}`))
	}))
	defer srv.Close()

	v := &tokenInfoVerifier{clientID: "", client: srv.Client(), endpoint: srv.URL}
	if _, err := v.Verify("токен"); err == nil {
		t.Fatal("токен принят при ненастроенном GOOGLE_CLIENT_ID")
	}
}

// credential уходит в Google параметром запроса, а транспортная ошибка
// (*url.Error) печатает URL целиком — вместе с живым ID-токеном посетителя.
// Лог-файлы читают шире, чем базу: сборщик логов, панель хостинга, резервная
// копия. Поэтому от Google возвращается класс ошибки, а не её текст.
func TestTokenInfoVerifierTransportErrorCarriesNoCredential(t *testing.T) {
	const credential = "eyJhbGciOiJIUzI1.ЖИВОЙ-ID-токен-посетителя.eyJemail_verified"

	slow := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		time.Sleep(200 * time.Millisecond)
	}))
	defer slow.Close()

	dead := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	deadURL := dead.URL
	dead.Close() // соединение будет отвергнуто — это путь через *url.Error

	tests := []struct {
		name        string
		client      *http.Client
		endpoint    string
		wantErrText string
	}{
		{"не удалось соединиться", http.DefaultClient, deadURL, "недоступен"},
		{"нет ответа за отведённое время", &http.Client{Timeout: 20 * time.Millisecond}, slow.URL, "не ответил"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := &tokenInfoVerifier{clientID: "our-client.apps.test", client: tt.client, endpoint: tt.endpoint}
			_, err := v.Verify(credential)
			if err == nil {
				t.Fatal("транспортная ошибка проглотилась: Verify вернула успех")
			}
			text := err.Error()
			// В логи и ответы ошибка уходит в двух формах: как есть и
			// percent-encoded внутри URL. Запрещены обе.
			for _, form := range []string{credential, url.QueryEscape(credential)} {
				if strings.Contains(text, form) {
					t.Errorf("в тексте ошибки остался credential (%q…): %q", form[:24], text)
				}
			}
			if strings.Contains(text, "id_token") || strings.Contains(text, "?") {
				t.Errorf("в тексте ошибки есть URL запроса к Google: %q", text)
			}
			if !strings.Contains(text, tt.wantErrText) {
				t.Errorf("текст ошибки %q не называет класс (%q)", text, tt.wantErrText)
			}
		})
	}
}

// Тот же leak второй раз на выводе: `log.Println("GoogleLogin: ", err)` печатает
// то, что вернул верификатор. Проверка на уровне хендлера, потому что именно
// сюда прилетает ошибка, и именно эта строка попадает в файл логов.
func TestGoogleLoginDoesNotLogCredential(t *testing.T) {
	// Charset как у настоящего ID-токена (base64url): его percent-encoding
	// не меняет строку, поэтому проверка «в логе нет этого токена» ловит
	// leak в любой форме.
	const credential = "eyJhbGciOiJIUzI1NiJ9.NEVER-IN-LOG-0123456789.eyJsub"

	// Порт, на котором никто не слушает: домен разрешается, соединение
	// отвергается — тот самый путь, на котором Go отдаёт *url.Error с полным
	// URL (и нашим credential внутри) в тексте.
	const refused = "http://localhost:1/tokeninfo"

	var logs bytes.Buffer
	out, flags := log.Writer(), log.Flags()
	log.SetOutput(&logs)
	defer func() { log.SetOutput(out); log.SetFlags(flags) }()

	h := newTestAuthHandler(t,
		&config.Config{GoogleClientID: "our-client.apps.test"},
		&tokenInfoVerifier{
			clientID: "our-client.apps.test",
			client:   &http.Client{Timeout: 2 * time.Second},
			endpoint: refused,
		},
		&fakeUsers{},
	)

	req := httptest.NewRequest(http.MethodPost, "/api/auth/google",
		strings.NewReader(`{"credential":"`+credential+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.GoogleLogin(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("код ответа = %d, ждали 401 (текст ответа посетителю не меняется)", rec.Code)
	}
	line := logs.String()
	if strings.Contains(line, credential) || strings.Contains(line, url.QueryEscape(credential)) {
		t.Errorf("в лог попал ID-токен посетителя: %q", line)
	}
	if strings.Contains(line, "id_token") {
		t.Errorf("в лог ушёл URL запроса к Google: %q", line)
	}
}
