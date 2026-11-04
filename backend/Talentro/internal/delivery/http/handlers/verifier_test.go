package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
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
