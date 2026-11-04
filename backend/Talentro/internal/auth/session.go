// Package auth — серверная сессия кабинета модерации.
//
// Права на §3.9 даёт не клиент: тело запроса, подстрока в письме и роль в
// localStorage браузера подделываются в один клик. Здесь кука хранит только id
// учётной записи, а «модератор или нет» читается из users.account_type на каждом
// запросе (см. handlers.ModerationHandler.authorize). Поэтому переписка роли в
// базе отзывает доступ сразу, даже с живой ещё кукой.
//
// Формат куки: `<id>.<unix-истечения>.<подпись>`, подпись — HMAC-SHA256 по
// первым двум частям на ключе MODERATOR_TOKEN (config.Config.ModeratorToken).
// id и время не шифруются и не секретны; важнее непрочность: без подписи
// подставить свой id нельзя.
package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// CookieName — имя куки. Его же читает фронтенд, чтобы понять «я вошёл»; сама
// кука для фронта недоступна (HttpOnly), и это правильно.
const CookieName = "talentro_session"

// DefaultTTL — на столько часов хватает подписи. Смысл не в безопасности пароля,
// а в том, чтобы ключ MODERATOR_TOKEN можно было ротировать, не выдёргивая
// модератора из кабинета посреди смены.
const DefaultTTL = 12 * time.Hour

// Sessions подписывает и проверяет сессии. Нулевой секрет — не «подпись
// пустым ключом», а «вход закрыт»: сервер без MODERATOR_TOKEN не поднимется
// (internal/config), но тест и стенд не должны получить кабинет на пустом ключе.
type Sessions struct {
	secret []byte
	ttl    time.Duration
}

func NewSessions(secret string, ttl time.Duration) *Sessions {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	return &Sessions{secret: []byte(secret), ttl: ttl}
}

// Enabled — можно ли вообще входить; false обработчик превращает в 401, а не в
// «все входят».
func (s *Sessions) Enabled() bool {
	return s != nil && len(s.secret) > 0
}

// TTL — время жизни только что выданной сессии; нужно обработчику, чтобы назвать
// клиенту тот же срок, что реально попал в куку.
func (s *Sessions) TTL() time.Duration {
	if s == nil {
		return 0
	}
	return s.ttl
}

// Token возвращает значение куки для учётной записи userID, вычисленное в момент
// now. now параметром, а не time.Now(), — чтобы срок и просрочку можно было
// проверить в тесте без ждёт-циклов.
func (s *Sessions) Token(userID int64, now time.Time) string {
	payload := strconv.FormatInt(userID, 10) + "." + strconv.FormatInt(now.Add(s.ttl).Unix(), 10)
	return payload + "." + s.sign(payload)
}

func (s *Sessions) sign(payload string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// Lookup разбирает значение куки: id учётной записи или false, если куки нет,
// она испорчена либо истекла. Подпись сравнивается в постоянное время — время
// ответа не должно подсказывать, на каком символе подпись разошлась.
func (s *Sessions) Lookup(value string, now time.Time) (int64, bool) {
	if !s.Enabled() {
		return 0, false
	}
	parts := strings.Split(value, ".")
	if len(parts) != 3 {
		return 0, false
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return 0, false
	}
	expected := hmac.New(sha256.New, s.secret)
	expected.Write([]byte(parts[0] + "." + parts[1]))
	if !hmac.Equal(signature, expected.Sum(nil)) {
		return 0, false
	}

	userID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || userID <= 0 {
		return 0, false
	}
	expires, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return 0, false
	}
	if time.Unix(expires, 0).Sub(now.UTC()) <= 0 {
		return 0, false
	}
	return userID, true
}

// ExpiresAt — момент истечения токена, возвращённого Token; тот же разбор, что в
// Lookup, но без проверки подписи (токен только что выдал сам сервер).
func (s *Sessions) ExpiresAt(token string) (time.Time, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return time.Time{}, false
	}
	expires, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return time.Time{}, false
	}
	return time.Unix(expires, 0), true
}

// Issue ставит куку. Secure включается только на HTTPS — иначе на локальном
// стенде (http://localhost:8080) браузер куку не примет, и «кабинет не
// работает» станет вопросом к стенду, а не к коду.func (s *Sessions) Issue(w http.ResponseWriter, r *http.Request, userID int64, now time.Time) string {
	token := s.Token(userID, now)
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(s.ttl / time.Second),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   requestSecure(r),
	})
	return token
}

// Clear снимает куку: MaxAge=-1, значение не важно.
func (s *Sessions) Clear(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   requestSecure(r),
	})
}

// UserID достаёт id учётной записи из куки запроса.
func (s *Sessions) UserID(r *http.Request, now time.Time) (int64, bool) {
	c, err := r.Cookie(CookieName)
	if err != nil {
		return 0, false
	}
	return s.Lookup(c.Value, now)
}

// requestSecure — HTTPS ли для клиента: прокси перед Go-сервером (Caddy из
// docker-compose.yml, nginx на стенде) ставит X-Forwarded-Proto, а сам
// сервер слушает обычный tcp.
func requestSecure(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(firstHeaderValue(r.Header.Get("X-Forwarded-Proto"))), "https")
}

func firstHeaderValue(v string) string {
	if i := strings.IndexByte(v, ','); i >= 0 {
		return v[:i]
	}
	return v
}

// VerifyToken сверяет общий секрет кабинета (значение MODERATOR_TOKEN) со
// сравнением в постоянное время: время ответа не должно подсказывать, на каком
// символе секрет разошёлся.
func (s *Sessions) VerifyToken(candidate string) bool {
	return s.Enabled() && subtle.ConstantTimeCompare([]byte(candidate), s.secret) == 1
}
