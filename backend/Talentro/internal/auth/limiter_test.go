package auth

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// §12.2: вход — 10 попыток в минуту на IP, регистрация — 3 в час, ответ 429.
const (
	loginLimit     = 10
	registerLimit  = 3
	loginWindow    = time.Minute
	registerWindow = time.Hour
	shortWindow    = 50 * time.Millisecond
)

// windowsStart — frozen-часы прогона: результат не зависит от машины и от того,
// насколько «крупными» получились тики time.Now.
var windowsStart = time.Unix(1800000000, 0)

// frozenLimiter отдаёт лимитер с подставными часами: Limiter.now — поле пакета,
// поэтому тест переводит время вручную и не ждёт настоящих минут.
func frozenLimiter(limit int, window time.Duration) (*Limiter, func(time.Duration)) {
	l := NewLimiter(limit, window)
	current := windowsStart
	l.now = func() time.Time { return current }
	return l, func(d time.Duration) { current = windowsStart.Add(d) }
}

// Ровно limit разрешённых попыток, limit+1-я — отказ.
func TestLimiterAllowsUpToLimitThenBlocks(t *testing.T) {
	tcs := []struct {
		name   string
		limit  int
		window time.Duration
	}{
		{"вход: 10 в минуту", loginLimit, loginWindow},
		{"регистрация: 3 в час", registerLimit, registerWindow},
		{"окно короче секунды", 2, shortWindow},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			l, _ := frozenLimiter(tc.limit, tc.window)

			for i := 1; i <= tc.limit; i++ {
				if !l.Allow("203.0.113.7") {
					t.Fatalf("попытка %d из %d отклонена", i, tc.limit)
				}
				// Пока лимит не выбран, ждать нечего: 429 без Retry-After.
				if got := l.RetryAfter("203.0.113.7"); got != 0 {
					t.Errorf("RetryAfter = %d до превышения лимита, ждали 0", got)
				}
			}
			if l.Allow("203.0.113.7") {
				t.Fatalf("попытка %d прошла: лимит %d не соблюдается", tc.limit+1, tc.limit)
			}
			if l.Allow("203.0.113.7") {
				t.Error("после отказа попытка всё равно прошла")
			}
		})
	}
}

// Счётчик считается по ключу (IP посетителя): чужой перебор не должен
// блокировать весь стенд.
func TestLimiterKeysAreIndependent(t *testing.T) {
	l, _ := frozenLimiter(2, loginWindow)

	if !l.Allow("203.0.113.1") || !l.Allow("203.0.113.1") {
		t.Fatal("первый ключ не израсходовал свои две попытки")
	}
	if l.Allow("203.0.113.1") {
		t.Error("третий запрос первого ключа пройден")
	}
	if !l.Allow("203.0.113.2") {
		t.Error("второй ключ получил отказ: счётчики не разведены по ключам")
	}
	// Пустой ключ — это просто ещё один ключ, а не «пропуск всегда».
	if !l.Allow("") || !l.Allow("") || l.Allow("") {
		t.Error("пустой ключ ведёт себя не как обычный")
	}
}

func TestLimiterRetryAfter(t *testing.T) {
	l, advance := frozenLimiter(loginLimit, loginWindow)

	for i := 0; i < loginLimit; i++ {
		if !l.Allow("198.51.100.7") {
			t.Fatalf("попытка %d отклонена раньше срока", i+1)
		}
	}
	if l.Allow("198.51.100.7") {
		t.Fatal("11-я попытка в окне пройдена")
	}

	// Остаток считаем вверх: на старте окна осталось ровно 60 с, и округление
	// может дать 61 — поэтому верхняя граница window+1, а не window.
	if got := l.RetryAfter("198.51.100.7"); got < 1 || got > int(loginWindow.Seconds())+1 {
		t.Errorf("RetryAfter на старте окна = %d, ждали 1..%d", got, int(loginWindow.Seconds())+1)
	}

	// Середина окна: сколько осталось, столько и ждать (39.5 с → 40).
	advance(20*time.Second + 500*time.Millisecond)
	if got := l.RetryAfter("198.51.100.7"); got != 40 {
		t.Errorf("через 20.5 с RetryAfter = %d, ждали 40", got)
	}

	// Последняя секунда: 0.8 с → 1, но не 0.
	advance(loginWindow - 200*time.Millisecond)
	if got := l.RetryAfter("198.51.100.7"); got != 1 {
		t.Errorf("за 0.2 с до конца окна RetryAfter = %d, ждали 1", got)
	}

	// Чистый и невиданный ключи — 0, паники нет.
	if got := l.RetryAfter("198.51.100.8"); got != 0 {
		t.Errorf("RetryAfter незаблокированного ключа = %d, ждали 0", got)
	}
	if got := l.RetryAfter("такого-ключа-нет"); got != 0 {
		t.Errorf("RetryAfter неизвестного ключа = %d, ждали 0", got)
	}
}

// Остаток меньше секунды обязан округляться вверх: «подожди 0 секунд» —
// обещание, которое клиент не сможет выполнить.
func TestLimiterRetryAfterRoundsUp(t *testing.T) {
	l, advance := frozenLimiter(1, loginWindow)
	l.Allow("ключ")
	if l.Allow("ключ") {
		t.Fatal("вторая попытка при лимите 1 пройдена")
	}
	advance(loginWindow - 400*time.Millisecond)
	if got := l.RetryAfter("ключ"); got != 1 {
		t.Errorf("RetryAfter при остатке 0.4 с = %d, ждали 1", got)
	}
}

// Часы подставные: прошёл весь window — счётчик обнуляется, лимит снова полон.
func TestLimiterWindowRestartsByClock(t *testing.T) {
	l, advance := frozenLimiter(3, loginWindow)

	for i := 0; i < 3; i++ {
		l.Allow("ключ")
	}
	if l.Allow("ключ") {
		t.Fatal("четвёртая попытка в пределах окна обязана быть отклонена")
	}

	// Ещё не истекло: 59 с 999 мс.
	advance(loginWindow - time.Millisecond)
	if l.Allow("ключ") {
		t.Error("попытка внутри старого окна пройдена")
	}

	// Окно закрыто.
	advance(loginWindow)
	if !l.Allow("ключ") {
		t.Fatal("после смены окна попытка отклонена: счётчик не обнулился")
	}
	for i := 0; i < 2; i++ {
		if !l.Allow("ключ") {
			t.Errorf("попытка %d в новом окне отклонена", i+2)
		}
	}
	if l.Allow("ключ") {
		t.Error("в новом окне прошло 4 попытки при лимите 3")
	}
}

// Тот же перезапуск на настоящих часах и коротком окне: NewLimiter не принимает
// инъекцию времени снаружи, поэтому проверяем и путь «sleep + 50 мс» — он
// задевает реальный time.Now, а не только подставной.
func TestLimiterWindowRestartsWithRealClock(t *testing.T) {
	l := NewLimiter(2, shortWindow)

	if !l.Allow("ключ") || !l.Allow("ключ") {
		t.Fatal("две попытки в новом окне обязаны пройти")
	}
	if l.Allow("ключ") {
		t.Fatal("третья попытка в пределах окна обязана быть отклонена")
	}

	time.Sleep(shortWindow + 40*time.Millisecond)

	if !l.Allow("ключ") {
		t.Fatal("после реального окна попытка отклонена: счётчик не обнулился")
	}
	// Лимит ещё не выбран — ждать нечего; округление вверх допускает 1 с.
	if got := l.RetryAfter("ключ"); got > 1 {
		t.Errorf("RetryAfter после перезапуска = %d, ждали 0..1", got)
	}
}

// Горутины не должны удвоить счётчик, иначе §12.2 обходится параллельными
// запросами. Прогон с -race ловит саму гонку, этот тест — её последствие.
func TestLimiterIsConcurrencySafe(t *testing.T) {
	const (
		limit    = 40
		attempts = 200
		key      = "192.0.2.9"
	)

	l := NewLimiter(limit, loginWindow)

	var (
		wg    sync.WaitGroup
		mu    sync.Mutex
		allow int
	)
	start := make(chan struct{})
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			if l.Allow(key) {
				mu.Lock()
				allow++
				mu.Unlock()
			}
		}()
	}
	close(start)
	wg.Wait()

	if allow != limit {
		t.Errorf("пропущено %d попыток при лимите %d и %d запросах: счётчик врёт под нагрузкой",
			allow, limit, attempts)
	}
	if got := l.RetryAfter(key); got <= 0 {
		t.Errorf("после исчерпания RetryAfter = %d, ждали больше нуля", got)
	}
}

// Разные ключи под нагрузкой не делят одно окно.
func TestLimiterConcurrentKeys(t *testing.T) {
	l := NewLimiter(5, loginWindow)

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			key := fmt.Sprintf("198.51.100.%d", i)
			for j := 0; j < 5; j++ {
				if !l.Allow(key) {
					t.Errorf("ключ %s получил отказ на попытке %d из 5", key, j+1)
					return
				}
			}
		}(i)
	}
	wg.Wait()
}

// ClientIP: служебные заголовки слушаются, только когда непосредственный пир —
// loopback или приватная сеть (за api стоит Caddy в docker-сети). Иначе XFF
// подделывается первым же посетителем, и лимит §12.2 превращается в украшение.
func TestClientIP(t *testing.T) {
	tcs := []struct {
		name       string
		remoteAddr string
		realIP     string
		xff        string
		want       string
	}{
		{
			name:       "публичный пир, XFF подделан",
			remoteAddr: "203.0.113.7:44321",
			xff:        "198.51.100.9",
			want:       "203.0.113.7",
		},
		{
			name:       "публичный пир, XFF со списком",
			remoteAddr: "203.0.113.7:44321",
			xff:        "198.51.100.9, 10.0.0.1, 127.0.0.1",
			want:       "203.0.113.7",
		},
		{
			name:       "публичный пир, X-Real-IP подделан",
			remoteAddr: "203.0.113.7:44321",
			realIP:     "198.51.100.9",
			want:       "203.0.113.7",
		},
		{
			name:       "публичный пир без заголовков",
			remoteAddr: "198.51.100.42:52000",
			want:       "198.51.100.42",
		},
		{
			name:       "публичный IPv6-пир",
			remoteAddr: "[2001:db8::1]:80",
			xff:        "198.51.100.9",
			want:       "2001:db8::1",
		},
		{
			name:       "loopback-пир берёт левое значение XFF",
			remoteAddr: "127.0.0.1:5555",
			xff:        "198.51.100.9, 203.0.113.7",
			want:       "198.51.100.9",
		},
		{
			name:       "IPv6 loopback-пир",
			remoteAddr: "[::1]:5555",
			xff:        "203.0.113.7",
			want:       "203.0.113.7",
		},
		{
			name:       "X-Real-IP важнее цепочки XFF",
			remoteAddr: "127.0.0.1:5555",
			realIP:     "198.51.100.9",
			xff:        "203.0.113.7",
			want:       "198.51.100.9",
		},
		{
			name:       "приватная сеть 10/8 (Caddy в docker)",
			remoteAddr: "10.0.0.5:80",
			xff:        "198.51.100.9, 10.0.0.1",
			want:       "198.51.100.9",
		},
		{
			name:       "приватная сеть 172.16/12",
			remoteAddr: "172.16.5.4:8080",
			xff:        "198.51.100.9",
			want:       "198.51.100.9",
		},
		{
			name:       "приватная сеть 192.168/16",
			remoteAddr: "192.168.1.10:8080",
			xff:        "198.51.100.9",
			want:       "198.51.100.9",
		},
		{
			name:       "приватный пир без заголовков",
			remoteAddr: "192.168.1.10:8080",
			want:       "192.168.1.10",
		},
		{
			name:       "приватный пир, пустые заголовки",
			remoteAddr: "127.0.0.1:5555",
			want:       "127.0.0.1",
		},
		{
			name:       "пробелы вокруг левого значения",
			remoteAddr: "127.0.0.1:5555",
			xff:        "  198.51.100.9  , 203.0.113.7",
			want:       "198.51.100.9",
		},
		{
			name:       "мусор вместо адреса в XFF не проходит",
			remoteAddr: "127.0.0.1:5555",
			xff:        "не-ip, 198.51.100.9",
			want:       "127.0.0.1",
		},
		{
			name:       "link-local 169.254/16 приватным пиром не считается",
			remoteAddr: "169.254.1.1:80",
			xff:        "198.51.100.9",
			want:       "169.254.1.1",
		},
		{
			name:       "порт отрезан от адреса",
			remoteAddr: "93.184.216.34:12345",
			want:       "93.184.216.34",
		},
		// Пир, который не является IP (пустой RemoteAddr, unix-сокет), заголовки
		// не согласует: доверить ему X-Real-IP — значит разрешить посетителю
		// выбрать, в чьём окне считать его собственные попытки.
		{
			name:       "пустой RemoteAddr, X-Real-IP подставлен",
			remoteAddr: "",
			realIP:     "198.51.100.9",
			want:       "",
		},
		{
			name:       "не-IP пир с цепочкой XFF",
			remoteAddr: "/run/caddy.sock",
			xff:        "198.51.100.9",
			want:       "/run/caddy.sock",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
			r.RemoteAddr = tc.remoteAddr
			if tc.realIP != "" {
				r.Header.Set("X-Real-IP", tc.realIP)
			}
			if tc.xff != "" {
				r.Header.Set("X-Forwarded-For", tc.xff)
			}

			got := ClientIP(r)
			if got != tc.want {
				t.Errorf("ClientIP = %q, ждали %q (пир %q, X-Real-IP %q, XFF %q)",
					got, tc.want, tc.remoteAddr, tc.realIP, tc.xff)
			}
			// Ключ лимитера обязан быть адресом без порта: иначе попытки одного
			// посетителя рассыпаются по сотням ключей. Для IPv6 двоеточия —
			// часть адреса, поэтому сравниваем с ожидаемым значением.
			if !strings.ContainsRune(tc.want, ':') && strings.ContainsRune(got, ':') {
				t.Errorf("ClientIP вернул адрес с портом: %q", got)
			}
		})
	}
}

// Две строки X-Forwarded-For net/http складывает в одну через запятую — левым
// остаётся значение из первой строки.
func TestClientIPJoinsRepeatedXFFHeader(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/api/auth/login", nil)
	r.RemoteAddr = "127.0.0.1:5555"
	r.Header.Add("X-Forwarded-For", "198.51.100.9")
	r.Header.Add("X-Forwarded-For", "203.0.113.7")

	if got := ClientIP(r); got != "198.51.100.9" {
		t.Errorf("ClientIP = %q, ждали адрес из первой строки", got)
	}
}

// Поток с новым адресом на каждый запрос: просроченных окон в нём нет, и чистка
// по времени не удаляет ничего. Без потолка карта росла бы до OOM-killer'а, а
// обход при каждой вставке — до квадрата.
func TestLimiterCapsEntriesUnderKeyFlood(t *testing.T) {
	l, _ := frozenLimiter(loginLimit, loginWindow)

	maxSeen := 0
	start := time.Now()
	for i := 0; i < 2*maxKeys; i++ {
		l.Allow(fmt.Sprintf("203.0.113.%d", i))
		if n := len(l.entries); n > maxSeen {
			maxSeen = n
		}
	}
	elapsed := time.Since(start)

	if maxSeen > maxKeys {
		t.Errorf("окон стало %d при потолке %d: память не ограничена", maxSeen, maxKeys)
	}
	if maxSeen < maxKeys/2 {
		t.Errorf("вытеснение началось на %d окнах при потолке %d: легитимные посетители теряют счётчик слишком рано",
			maxSeen, maxKeys)
	}
	// Ожидаемая стоимость — линейная: обход раз на len записей, снос четверти раз
	// на maxKeys/4 вставок. Квадратичный вариант на этом же прогоне уходит в
	// минуты, поэтому верхняя граница щедрая и поймает только возврат к старому.
	if elapsed > 30*time.Second {
		t.Errorf("%d вставок заняли %v: стоимость растёт квадратом", 2*maxKeys, elapsed)
	}

	// Вытеснение не должно превращать отказ в «сервис не отвечает»: новая попытка
	// по-прежнему получает обычный ответ лимитера.
	if !l.Allow("после-потока") {
		t.Error("первая попытка после потока ключей запрещена")
	}
}

// Чистка просроченных окон осталась, просто стала амортизированной: окну
// достаточно пережить окно по времени, и на ближайшей серии вставок оно уходит.
func TestLimiterStillSweepsExpiredWindows(t *testing.T) {
	l, advance := frozenLimiter(loginLimit, loginWindow)

	for i := 0; i < 100; i++ {
		l.Allow(fmt.Sprintf("203.0.113.%d", i))
	}
	if len(l.entries) != 100 {
		t.Fatalf("окон = %d, ждали 100", len(l.entries))
	}

	advance(loginWindow) // все сто окон просрочены
	for i := 100; i < 300; i++ {
		l.Allow(fmt.Sprintf("203.0.113.%d", i))
	}

	if len(l.entries) > 200 {
		t.Errorf("окон = %d после чистки: просроченные не удаляются, карта растёт мусором", len(l.entries))
	}
}
