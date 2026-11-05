package auth

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Ограничение частоты по §12.2: вход — 10 попыток в минуту с одного IP,
// регистрация — 3 в час, ответ 429.
//
// Окно фиксированное, а не скользящее: счётчик живёт в памяти процесса и
// сбрасывается целиком. Скользящее окно честнее по краям, но требует хранить
// момент каждой попытки, а смысл здесь — отрезать перебор паролей, для которого
// точность на границе окна не важна.

// Limiter считает попытки на ключ (обычно IP) в текущем окне.
type Limiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	entries map[string]*attemptBucket
	now     func() time.Time
}

type attemptBucket struct {
	count int
	start time.Time
}

// NewLimiter: limit попыток на ключ за окно window. Часы держит в себе now —
// тесты из этого же пакета подменяют её и прокручивают окно без sleep'ов.
func NewLimiter(limit int, window time.Duration) *Limiter {
	return &Limiter{
		limit:   limit,
		window:  window,
		entries: map[string]*attemptBucket{},
		now:     time.Now,
	}
}

// Allow увеличивает счётчик и говорит, разрешена ли попытка. Ключ пустым быть
// не должен (тогда все посетители делят одно окно), но и не паникует: пустой
// ключ — это просто ещё один ключ.
func (l *Limiter) Allow(key string) bool {
	now := l.now()

	l.mu.Lock()
	defer l.mu.Unlock()

	b := l.entries[key]
	if b == nil || now.Sub(b.start) >= l.window {
		l.prune(now)
		b = &attemptBucket{start: now}
		l.entries[key] = b
	}
	b.count++
	return b.count <= l.limit
}

// RetryAfter — сколько секунд ждать до конца окна; 0, если лимит ещё не выбран.
func (l *Limiter) RetryAfter(key string) int {
	now := l.now()

	l.mu.Lock()
	defer l.mu.Unlock()

	b := l.entries[key]
	if b == nil || b.count <= l.limit {
		return 0
	}
	left := l.window - now.Sub(b.start)
	if left <= 0 {
		return 0
	}
	// Округляем вверх: «подожди 0 секунд» при остатке 0.4 с — это обещание,
	// которое клиент не сможет выполнить. Но не дольше самого окна — при
	// остатке ровно 60.0 с «61» обещал бы блок на секунду длиннее, чем он живёт.
	seconds := left + time.Second - 1
	if seconds > l.window {
		seconds = l.window
	}
	return int(seconds / time.Second)
}

// Окон может стать много (обходчики NAT'ов, сканеры), а живут они только окно.
// Чистим не по таймеру — лишняя горутину ради двух лимитеров не нужна, — а когда
// карта выросла: старые окна к этому моменту уже просрочены.
const pruneThreshold = 4096

func (l *Limiter) prune(now time.Time) {
	if len(l.entries) < pruneThreshold {
		return
	}
	for key, b := range l.entries {
		if now.Sub(b.start) >= l.window {
			delete(l.entries, key)
		}
	}
}

// ClientIP — адрес посетителя, по которому считаем частоту (§12.2).
//
// Заголовок доверять нельзя по умолчанию: клиент придумает любую строку. Поэтому
// служебные заголовки читаем, только когда непосредственный пир приватный — за
// api всегда стоит прокси (в стенде это Caddy на docker-сети, на dev — localhost).
// Caddy проставляет X-Real-IP своим значением ({remote_host} в infra/Caddyfile),
// то есть адрес TCP-соединения с собой, а не то, что принёс клиент.
//
// Если api опубликовать наружу напрямую, пир становится публичным и X-Real-IP
// просто игнорируется: остаётся RemoteAddr, подделать который нельзя.
func ClientIP(r *http.Request) string {
	peer := peerAddress(r)

	if !peerIsTrusted(peer) {
		if peer != "" {
			return peer
		}
		return r.RemoteAddr
	}

	if ip := cleanIPOrigin(r.Header.Get("X-Real-IP")); ip != "" {
		return ip
	}
	// X-Forwarded-For — цепочка, левый адрес заявлен самым первым сервером,
	// то есть клиентом. Берем его только потому, что за приватным пиром
	// альтернативы нет; X-Real-IP надёжнее и стоит выше в этом списке.
	first, _, _ := strings.Cut(r.Header.Get("X-Forwarded-For"), ",")
	if ip := cleanIPOrigin(first); ip != "" {
		return ip
	}
	return peer
}

func peerAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		return strings.TrimSpace(r.RemoteAddr)
	}
	return host
}

func peerIsTrusted(peer string) bool {
	ip := net.ParseIP(peer)
	if ip == nil {
		// Не IP (_named pipe_ в Windows-тестах, пустой RemoteAddr) — считаем
		// локальным: дальше по коду это всё равно вернёт сам peer.
		return true
	}
	return ip.IsLoopback() || ip.IsPrivate()
}

func cleanIPOrigin(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if ip := net.ParseIP(raw); ip != nil {
		return ip.String()
	}
	return ""
}
