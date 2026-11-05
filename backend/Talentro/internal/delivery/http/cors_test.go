package deliveryhttp

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS(t *testing.T) {
	const allowed = "http://localhost:3000"

	hits := 0
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		w.WriteHeader(http.StatusOK)
	})

	tests := []struct {
		name           string
		origins        []string
		method         string
		origin         string
		preflight      bool
		wantStatus     int
		wantACAO       string
		wantNextCalled bool
	}{
		{
			name:    "разрешённый источник получает свой origin",
			origins: []string{allowed}, method: http.MethodGet, origin: allowed,
			wantStatus: http.StatusOK, wantACAO: allowed, wantNextCalled: true,
		},
		{
			name:    "preflight обслуживает прослойка, обработчик не вызывается",
			origins: []string{allowed}, method: http.MethodOptions, origin: allowed, preflight: true,
			wantStatus: http.StatusNoContent, wantACAO: allowed,
		},
		{
			name:    "чужой preflight отклоняется до маршрута",
			origins: []string{allowed}, method: http.MethodOptions, origin: "http://evil.example", preflight: true,
			wantStatus: http.StatusForbidden, wantACAO: "",
		},
		{
			name:    "совпадение точное, а не по префиксу",
			origins: []string{allowed}, method: http.MethodGet, origin: allowed + ".evil.example",
			wantStatus: http.StatusOK, wantACAO: "", wantNextCalled: true,
		},
		{
			name:    "запрос без Origin (тот же источник, curl) проходит как обычно",
			origins: []string{allowed}, method: http.MethodGet, origin: "",
			wantStatus: http.StatusOK, wantACAO: "", wantNextCalled: true,
		},
		{
			name:    "пустой ALLOWED_ORIGINS не выдаёт заголовок ни кому",
			origins: nil, method: http.MethodGet, origin: allowed,
			wantStatus: http.StatusOK, wantACAO: "", wantNextCalled: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			hits = 0

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(tc.method, "/api/cards", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if tc.preflight {
				req.Header.Set("Access-Control-Request-Method", http.MethodGet)
			}

			CORS(tc.origins)(next).ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Errorf("код ответа = %d, want %d", rec.Code, tc.wantStatus)
			}
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tc.wantACAO {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, tc.wantACAO)
			}
			if (hits > 0) != tc.wantNextCalled {
				t.Errorf("обработчик вызван = %v, want %v", hits > 0, tc.wantNextCalled)
			}
			if tc.wantACAO != "" {
				if rec.Header().Get("Vary") != "Origin" {
					t.Error("без Vary: Origin общий кэш отдаст чужой Access-Control-Allow-Origin")
				}
				if rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
					t.Error("нет Access-Control-Allow-Credentials")
				}
			}
		})
	}
}
