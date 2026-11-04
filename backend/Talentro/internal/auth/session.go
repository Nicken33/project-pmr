package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

const (
	// CookieName — единственная кука, по которой сервер решает, что показывать:
	// витрину из БД или тестовую.
	CookieName = "talentro_session"
	ttl        = 30 * 24 * time.Hour
)

var ErrInvalid = errors.New("сессия недействительна")

type Claims struct {
	UserID   int64  `json:"uid"`
	Email    string `json:"email,omitempty"`
	Name     string `json:"name,omitempty"`
	Picture  string `json:"picture,omitempty"`
	Role     string `json:"role"`
	Provider string `json:"provider"`
	Tester   bool   `json:"tester"`
	Exp      int64  `json:"exp"`
}

type Store struct {
	secret []byte
	now    func() time.Time
}

func NewStore(secret string) (*Store, error) {
	if strings.TrimSpace(secret) == "" {
		return nil, errors.New("не задан SESSION_SECRET: сессии подписывать нечем")
	}
	return &Store{secret: []byte(secret), now: time.Now}, nil
}

// Encode подписывает claims как они есть: срок (Exp) подставляет вызывающий.
// Set заполняет его сам, поэтому ход в код — через Set; напрямую Encode годится
// только там, где Exp посчитан осознанно.
func (s *Store) Encode(c Claims) (string, error) {
	payload, err := json.Marshal(c)
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	return encoded + "." + s.sign(encoded), nil
}

func (s *Store) sign(encoded string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(encoded))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (s *Store) Decode(raw string) (Claims, error) {
	encoded, signature, found := strings.Cut(raw, ".")
	if !found || encoded == "" || signature == "" {
		return Claims{}, ErrInvalid
	}

	want := s.sign(encoded)
	got, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return Claims{}, ErrInvalid
	}
	wantBytes, err := base64.RawURLEncoding.DecodeString(want)
	if err != nil {
		return Claims{}, ErrInvalid
	}
	// Сравнение байтов, а не строк: hmac.Equal не выдаёт длину наружу.
	if subtle.ConstantTimeCompare(got, wantBytes) != 1 {
		return Claims{}, ErrInvalid
	}

	payload, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return Claims{}, ErrInvalid
	}
	var c Claims
	if err := json.Unmarshal(payload, &c); err != nil {
		return Claims{}, ErrInvalid
	}
	if c.Exp <= s.now().Unix() {
		return Claims{}, ErrInvalid
	}
	return c, nil
}

func (s *Store) Set(w http.ResponseWriter, c Claims, secure bool) error {
	c.Exp = s.now().Add(ttl).Unix()
	value, err := s.Encode(c)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(ttl.Seconds()),
	})
	return nil
}

func (s *Store) Clear(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0).UTC(),
	})
}

// ClaimsFromRequest — неаутентифицированный посетитель это не ошибка, а
// состояние: вызывающий код обязан отличить ErrInvalid от прочего.
func (s *Store) ClaimsFromRequest(r *http.Request) (Claims, error) {
	cookie, err := r.Cookie(CookieName)
	if err != nil {
		return Claims{}, ErrInvalid
	}
	return s.Decode(cookie.Value)
}

// Secure: только по https. Заголовок прокси — единственный способ это увидеть,
// сам сервер на стенде слушает http.
func SecureRequest(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}
