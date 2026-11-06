package deliveryhttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Кука `talentro_session` — SameSite=Lax, и на этом защита от CSRF раньше
// держалась целиком. Проверка ниже добавляет второй, независимый признак:
// браузер сам говорит, с чьего сайта ушёл запрос (`Origin`, `Sec-Fetch-Site`),
// и эти слова надо услышать на эндпоинтах, которые выдают или снимают куку.
// Нето-запросы (curl, серверный BFF) ни одного из заголовков не присылают —
// они не браузер, и приложить чужую куку сами не могут, поэтому проходят.
func TestSameSiteGuard(t *testing.T) {
	const (
		own     = "http://localhost:3000"
		ownHost = "localhost:3000"
		vitrine = "http://localhost:5173"
	)

	tests := []struct {
		name           string
		allowed        []string
		method         string
		origin         string
		secFetchSite   string
		host           string
		wantStatus     int
		wantNextCalled bool
	}{
		{
			name:       "запрос без Origin и Sec-Fetch-Site (curl, BFF) проходит",
			method:     http.MethodPost,
			host:       ownHost,
			wantStatus: http.StatusOK, wantNextCalled: true,
		},
		{
			name:   "тот же origin: Host совпал",
			method: http.MethodPost, origin: own, host: ownHost,
			wantStatus: http.StatusOK, wantNextCalled: true,
		},
		{
			name:   "витрина на другом порту того же хоста — то же место",
			method: http.MethodPost, origin: own, host: "localhost:8080",
			wantStatus: http.StatusOK, wantNextCalled: true,
		},
		{
			name:    "источник из ALLOWED_ORIGINS",
			allowed: []string{vitrine}, method: http.MethodPost,
			origin: vitrine, host: ownHost,
			wantStatus: http.StatusOK, wantNextCalled: true,
		},
		{
			name:   "чужой сайт в Origin и Sec-Fetch-Site: cross-site",
			method: http.MethodPost, origin: "http://evil.example", secFetchSite: "cross-site", host: ownHost,
			wantStatus: http.StatusForbidden,
		},
		{
			// Старый браузер или браузер без Sec-Fetch-*: одного Origin довольно.
			name:   "чужой Origin без Sec-Fetch-Site",
			method: http.MethodPost, origin: "http://evil.example", host: ownHost,
			wantStatus: http.StatusForbidden,
		},
		{
			// Оpaque-origin (`sandbox` без allow-same-origin) — так из iframe
			// убирают принадлежность сайту; «null» нельзя считать своим.
			name:   "Origin: null от изолированного фрейма",
			method: http.MethodPost, origin: "null", host: ownHost,
			wantStatus: http.StatusForbidden,
		},
		{
			name:   "Origin, который нельзя разобрать",
			method: http.MethodPost, origin: "не URL", host: ownHost,
			wantStatus: http.StatusForbidden,
		},
		{
			// Поддомен — уже другой host: сверка по имени хоста, а не по «похоже
			// на наш домен», иначе взломанный поддомен становится своим.
			name:   "похожий поддомен",
			method: http.MethodPost, origin: "https://evil.talentro.example", host: "talentro.example",
			wantStatus: http.StatusForbidden,
		},
		{
			// Sec-Fetch-Site браузер ставит сам, и на нём защита держится даже
			// тогда, когда Origin почему-то не доехал (некоторые прокси).
			name:   "Sec-Fetch-Site: cross-site без Origin",
			method: http.MethodPost, secFetchSite: "cross-site", host: ownHost,
			wantStatus: http.StatusForbidden,
		},
		{
			name:   "Sec-Fetch-Site: same-origin",
			method: http.MethodPost, secFetchSite: "same-origin", host: ownHost,
			wantStatus: http.StatusOK, wantNextCalled: true,
		},
		{
			name:   "Sec-Fetch-Site: none (вкладка, адресная строка)",
			method: http.MethodPost, secFetchSite: "none", host: ownHost,
			wantStatus: http.StatusOK, wantNextCalled: true,
		},
		{
			// Чтение каталога ничего не меняет: GET с чужого сайта остаётся
			// обычным запросом, его решает CORS.
			name:   "GET с чужого сайта прослойку не интересует",
			method: http.MethodGet, origin: "http://evil.example", secFetchSite: "cross-site", host: ownHost,
			wantStatus: http.StatusOK, wantNextCalled: true,
		},
		{
			name:   "preflight (OPTIONS) не задерживается здесь",
			method: http.MethodOptions, origin: "http://evil.example", host: ownHost,
			wantStatus: http.StatusOK, wantNextCalled: true,
		},
		{
			name:   "регистрация — тоже выдача куки",
			method: http.MethodPost, origin: "https://evil.example", host: ownHost,
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			hits := 0
			next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				hits++
				w.WriteHeader(http.StatusOK)
			})

			handler := SameSiteGuard(tc.allowed)(next)

			req := httptest.NewRequest(tc.method, "/api/auth/login", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if tc.secFetchSite != "" {
				req.Header.Set("Sec-Fetch-Site", tc.secFetchSite)
			}
			req.Host = tc.host

			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Errorf("код = %d, ждали %d (тело %q)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if got := hits > 0; got != tc.wantNextCalled {
				t.Errorf("ниже прослойки прошли = %v, ждали %v", got, tc.wantNextCalled)
			}
			if tc.wantStatus == http.StatusForbidden {
				var envelope struct {
					Error struct {
						Code    int    `json:"code"`
						Message string `json:"message"`
					} `json:"error"`
				}
				if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
					t.Fatalf("отказ отдан не конвертом §9: %v (тело %q)", err, rec.Body.String())
				}
				if envelope.Error.Code != http.StatusForbidden {
					t.Errorf("в конверте code = %d, ждали 403", envelope.Error.Code)
				}
				if !strings.Contains(envelope.Error.Message, "чужого сайта") {
					t.Errorf("сообщение %q не объясняет, что запрос с чужого сайта", envelope.Error.Message)
				}
			}
		})
	}
}
