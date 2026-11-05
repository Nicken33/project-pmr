package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const testSecret = "стендовый-секрет-для-проверки"

func newTestStore(t *testing.T, secret string) *Store {
	t.Helper()
	s, err := NewStore(secret)
	if err != nil {
		t.Fatalf("NewStore(%q): %v", secret, err)
	}
	return s
}

// Exp заполняется вручную: его подставляет только Set, а Encode без срока
// отказывается выпускать куку.
func validClaims(s *Store) Claims {
	return Claims{
		UserID:   7,
		Email:    "tester@example.test",
		Name:     "Проверяющий",
		Role:     "tester",
		Provider: "tester",
		Tester:   true,
		Exp:      s.now().Add(time.Hour).Unix(),
	}
}

func flipLastByte(s string) string {
	if s == "" {
		return "x"
	}
	replacement := byte('A')
	if s[len(s)-1] == 'A' {
		replacement = 'B'
	}
	return s[:len(s)-1] + string(replacement)
}

func TestNewStoreRejectsEmptySecret(t *testing.T) {
	for _, secret := range []string{"", " ", "\t", "\n"} {
		if _, err := NewStore(secret); err == nil {
			t.Errorf("NewStore(%q): ожидалась ошибка, получено nil", secret)
		}
	}
}

func TestStoreRoundTrip(t *testing.T) {
	s := newTestStore(t, testSecret)
	want := validClaims(s)

	raw, err := s.Encode(want)
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	if !strings.Contains(raw, ".") {
		t.Fatalf("Encode: токен без разделителя подписи: %q", raw)
	}

	got, err := s.Decode(raw)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if got != want {
		t.Errorf("Decode = %+v, ожидалось %+v", got, want)
	}
}

func TestStoreDecodeRejectsExpired(t *testing.T) {
	frozen := time.Unix(1800000000, 0)

	tests := []struct {
		name string
		exp  int64
	}{
		{"просрочен на секунду", frozen.Add(-time.Second).Unix()},
		{"просрочен на месяц", frozen.Add(-30 * 24 * time.Hour).Unix()},
		{"exp равен нулю", 0},
		{"exp равен now", frozen.Unix()},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newTestStore(t, testSecret)
			s.now = func() time.Time { return frozen }

			// Без срока токен не выпускается вовсе: иначе Encode отдаёт куку,
			// которую тот же Store тут же объявляет недействительной.
			if _, err := s.Encode(Claims{UserID: 1, Role: "tester", Provider: "tester", Exp: tt.exp}); err != ErrInvalid {
				t.Errorf("Encode = %v, ожидалось ErrInvalid", err)
			}
		})
	}
}

func TestStoreDecodeRejectsTokenPastItsLife(t *testing.T) {
	s := newTestStore(t, testSecret)
	minted := time.Unix(1800000000, 0)
	s.now = func() time.Time { return minted }

	raw, err := s.Encode(Claims{UserID: 1, Role: "tester", Exp: minted.Add(time.Hour).Unix()})
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}

	s.now = func() time.Time { return minted.Add(2 * time.Hour) }
	if _, err := s.Decode(raw); err != ErrInvalid {
		t.Errorf("Decode просроченной куки = %v, ожидалось ErrInvalid", err)
	}
}

func TestStoreDecodeRejectsForeignSecret(t *testing.T) {
	issuer := newTestStore(t, testSecret)
	raw, err := issuer.Encode(validClaims(issuer))
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}

	for _, secret := range []string{"другой-секрет", testSecret + " ", "a"} {
		other := newTestStore(t, secret)
		if _, err := other.Decode(raw); err != ErrInvalid {
			t.Errorf("Decode секретом %q = %v, ожидалось ErrInvalid", secret, err)
		}
	}
}

func TestStoreDecodeRejectsMalformedToken(t *testing.T) {
	s := newTestStore(t, testSecret)
	good, err := s.Encode(validClaims(s))
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	payload, signature, _ := strings.Cut(good, ".")

	tests := []struct {
		name string
		raw  string
	}{
		{"пустая строка", ""},
		{"нет разделителя", payload},
		{"пустая подпись", payload + "."},
		{"пустая полезная часть", "." + signature},
		{"подпись не base64", payload + ".!!не-base64!!"},
		{"изменён последний байт подписи", payload + "." + flipLastByte(signature)},
		{"полезная часть не base64", "!!не-base64!!." + signature},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := s.Decode(tt.raw); err != ErrInvalid {
				t.Errorf("Decode(%q) = %v, ожидалось ErrInvalid", tt.raw, err)
			}
		})
	}
}

// Подпись от одной анкеты не должна открывать другую: это проверка того, что
// Decode сверяет подпись именно с полезной частью, а не принимает любую валидную.
func TestStoreDecodeRejectsCrossTokenSignature(t *testing.T) {
	s := newTestStore(t, testSecret)

	first, err := s.Encode(validClaims(s))
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	second, err := s.Encode(Claims{
		UserID:   999,
		Role:     "user",
		Provider: "google",
		Exp:      s.now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}

	firstPayload, _, _ := strings.Cut(first, ".")
	_, secondSignature, _ := strings.Cut(second, ".")

	if _, err := s.Decode(firstPayload + "." + secondSignature); err != ErrInvalid {
		t.Errorf("Decode с чужой подписью = %v, ожидалось ErrInvalid", err)
	}
}

func TestStoreSetCookieAttributes(t *testing.T) {
	tests := []struct {
		name   string
		secure bool
	}{
		{"http-стенд", false},
		{"https за прокси", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := newTestStore(t, testSecret)
			w := httptest.NewRecorder()

			err := s.Set(w, Claims{UserID: 3, Role: "tester", Provider: "tester", Tester: true}, tt.secure)
			if err != nil {
				t.Fatalf("Set: %v", err)
			}

			cookies := w.Result().Cookies()
			if len(cookies) != 1 {
				t.Fatalf("Set выдал %d кук, ожидалась одна", len(cookies))
			}
			c := cookies[0]

			if c.Name != CookieName {
				t.Errorf("Name = %q, ожидалось %q", c.Name, CookieName)
			}
			if !c.HttpOnly {
				t.Error("HttpOnly = false, кука доступна из JS")
			}
			if c.Path != "/" {
				t.Errorf("Path = %q, ожидалось \"/\"", c.Path)
			}
			if c.SameSite != http.SameSiteLaxMode {
				t.Errorf("SameSite = %v, ожидалось Lax", c.SameSite)
			}
			if c.Secure != tt.secure {
				t.Errorf("Secure = %v, ожидалось %v", c.Secure, tt.secure)
			}
			if want := int((30 * 24 * time.Hour).Seconds()); c.MaxAge != want {
				t.Errorf("MaxAge = %d, ожидалось %d", c.MaxAge, want)
			}

			// Set проставляет Exp сам, поэтому выданная кука обязана читаться.
			got, err := s.Decode(c.Value)
			if err != nil {
				t.Fatalf("Decode выданной куки: %v", err)
			}
			if got.UserID != 3 || !got.Tester {
				t.Errorf("Decode = %+v, ожидалось UserID 3 и Tester true", got)
			}
		})
	}
}

func TestStoreClearExpiresCookie(t *testing.T) {
	s := newTestStore(t, testSecret)
	w := httptest.NewRecorder()

	s.Clear(w, false)

	cookies := w.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("Clear выдал %d кук, ожидалась одна", len(cookies))
	}
	c := cookies[0]

	if c.Name != CookieName {
		t.Errorf("Name = %q, ожидалось %q", c.Name, CookieName)
	}
	if c.Value != "" {
		t.Errorf("Value = %q, ожидалась пустая строка", c.Value)
	}
	if c.MaxAge > 0 {
		t.Errorf("MaxAge = %d, ожидалось неположительное", c.MaxAge)
	}
	if !c.Expires.Equal(time.Unix(0, 0).UTC()) {
		t.Errorf("Expires = %v, ожидалось %v", c.Expires, time.Unix(0, 0).UTC())
	}
}

func TestClaimsFromRequest(t *testing.T) {
	s := newTestStore(t, testSecret)
	raw, err := s.Encode(validClaims(s))
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}

	tests := []struct {
		name       string
		cookie     *http.Cookie
		wantErr    error
		wantTester bool
	}{
		{"куки нет", nil, ErrInvalid, false},
		{"кука пуста", &http.Cookie{Name: CookieName, Value: ""}, ErrInvalid, false},
		{"чужое имя куки", &http.Cookie{Name: "session", Value: raw}, ErrInvalid, false},
		{"валидная кука", &http.Cookie{Name: CookieName, Value: raw}, nil, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
			if tt.cookie != nil {
				r.AddCookie(tt.cookie)
			}

			got, err := s.ClaimsFromRequest(r)
			if err != tt.wantErr {
				t.Fatalf("ClaimsFromRequest err = %v, ожидалось %v", err, tt.wantErr)
			}
			if tt.wantErr == nil && got.Tester != tt.wantTester {
				t.Errorf("Tester = %v, ожидалось %v", got.Tester, tt.wantTester)
			}
		})
	}
}

func TestSecureRequest(t *testing.T) {
	tests := []struct {
		header string
		want   bool
	}{
		{"", false},
		{"http", false},
		{"https", true},
		{"HTTPS", true},
		{"Https", true},
		{"websocket", false},
	}

	for _, tt := range tests {
		t.Run("X-Forwarded-Proto="+tt.header, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.header != "" {
				r.Header.Set("X-Forwarded-Proto", tt.header)
			}
			if got := SecureRequest(r); got != tt.want {
				t.Errorf("SecureRequest = %v, ожидалось %v", got, tt.want)
			}
		})
	}
}
