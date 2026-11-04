package auth

import (
	"encoding/base64"
	"fmt"
	"strings"
	"sync"
	"testing"

	"golang.org/x/crypto/argon2"
)

// Пароли прогона. §3.7 говорит «почта + пароль» без алфавитных ограничений, а
// пользователь Приднестровья пишет пароль кириллицей и может добавить эмодзи:
// хэш обязан считаться по байтам UTF-8, а не по «латинице».
//
// «ё» задана escape-последовательностью: если сохранить её combining-формой,
// тест на нормализацию перестанет различать строки.
const (
	pwCyrillic    = "Тёплый-ключ🔒 для секции"
	pwCyrillicNFD = "Тe\u0308плый-ключ🔒 для секции" // тот же текст другими байтами
	pwAscii       = "Passw0rd!"
	pwShort       = "секрет" // короче PasswordMinLen, но для сверки годится
)

// Три тяжёлых вызова HashPassword (64 MiB на каждый, §12.1) на весь прогон:
// экономию даёт sync.Once, иначе каждый подтест считал бы хэш заново и прогон
// шёл бы десятки секунд.
var (
	heavyOnce   sync.Once
	heavyHashes [3]string
	heavyErr    error
)

// heavyHash возвращает два настоящих хэша разных паролей и третий — повторный
// для pwCyrillic, чтобы увидеть случайную соль.
func heavyHash(t *testing.T) (cyrillic, ascii, repeat string) {
	t.Helper()
	heavyOnce.Do(func() {
		for i, p := range []string{pwCyrillic, pwAscii, pwCyrillic} {
			var h string
			h, heavyErr = HashPassword(p)
			if heavyErr != nil {
				return
			}
			heavyHashes[i] = h
		}
	})
	if heavyErr != nil {
		t.Fatalf("HashPassword: %v", heavyErr)
	}
	return heavyHashes[0], heavyHashes[1], heavyHashes[2]
}

// phcSalt/phcHash — готовые base64-сегменты для строк-«соломинок»: таблицы на
// битые строки ломают формат, а не кодировку случайно.
var (
	phcSalt = base64.RawStdEncoding.EncodeToString([]byte("0123456789abcdef")) // 16 байт
	phcHash = base64.RawStdEncoding.EncodeToString(make([]byte, phcKeyLen))    // 32 байта
)

// phcStringKey собирает строку PHC с указанной стоимостью. Малая стоимость
// (m=64 KiB, t=1, p=1) нужна намеренно: §12.1 требует argon2id, но «сверка со
// старой стоимостью» не обязана жевать 64 MiB — VerifyPassword берёт
// параметры из строки, поэтому дешёвая строка проверяет ровно то же самое.
//
// threads — uint8: такую сигнатуру у argon2.IDKey имеет x/crypto v0.58.
func phcStringKey(t *testing.T, password string, memKiB, iters uint32, threads uint8, keyLen uint32, salt []byte) string {
	t.Helper()
	dk := argon2.IDKey([]byte(password), salt, iters, memKiB, threads, keyLen)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		memKiB, iters, threads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(dk))
}

func phcString(t *testing.T, password string, memKiB, iters uint32, threads uint8, salt []byte) string {
	t.Helper()
	return phcStringKey(t, password, memKiB, iters, threads, phcKeyLen, salt)
}

// noPanic фиксирует требование «никогда не паникует»: битая строка из БД не
// должна ронять процесс, который её сверяет.
func noPanic(t *testing.T, name string, fn func() bool) (got bool) {
	t.Helper()
	defer func() {
		if r := recover(); r != nil {
			t.Fatalf("%s: паника %v", name, r)
		}
	}()
	return fn()
}

func TestPasswordContractConstants(t *testing.T) {
	// §3.7.1 и §12.1: граница длины пароля — 8 символов, её же проверяют
	// handlers на регистрации.
	if PasswordMinLen != 8 {
		t.Errorf("PasswordMinLen = %d, ждали 8", PasswordMinLen)
	}
	if ErrMalformedHash == nil {
		t.Error("ErrMalformedHash должен быть объявлен: на него опирается сверка")
	}
	if ErrMalformedHash.Error() == "" {
		t.Error("у ошибки пустой текст — в логе её не разобрать")
	}
}

// §12.1: пароль хранится хэшем argon2id в строке PHC с параметрами внутри.
func TestHashPasswordFormat(t *testing.T) {
	stored, _, _ := heavyHash(t)

	const wantPrefix = "$argon2id$v=19$m=65536,t=3,p=4$"
	if !strings.HasPrefix(stored, wantPrefix) {
		t.Fatalf("префикс = %q, ждали %q", stored, wantPrefix)
	}

	parts := strings.Split(stored, "$")
	if len(parts) != 6 || parts[0] != "" {
		t.Fatalf("формат PHC из пяти непустых сегментов, получили %q", stored)
	}
	if parts[1] != "argon2id" {
		t.Errorf("алгоритм = %q, ждали argon2id (§12.1)", parts[1])
	}
	if parts[2] != "v=19" {
		t.Errorf("версия = %q, ждали v=19", parts[2])
	}
	if parts[3] != "m=65536,t=3,p=4" {
		t.Errorf("параметры = %q, ждали m=65536,t=3,p=4 (нижняя граница OWASP)", parts[3])
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		t.Fatalf("соль не base64 RawStd: %v", err)
	}
	if len(salt) != 16 {
		t.Errorf("длина соли = %d, ждали 16 байт", len(salt))
	}
	dk, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		t.Fatalf("хэш не base64 RawStd: %v", err)
	}
	if len(dk) != 32 {
		t.Errorf("длина ключа = %d, ждали 32 байта", len(dk))
	}
	// 30 (префикс с параметрами) + 1 + 22 (соль) + 1 + 43 (ключ) = 97.
	// Диапазон вместо точного числа: правка длины ключа не должна молча
	// «починить» тест.
	if l := len(stored); l < 90 || l > 110 {
		t.Errorf("длина строки = %d, ожидалось ~97", l)
	}
	if strings.ContainsAny(stored, "\n\r\t ") {
		t.Errorf("в строке хэша есть пробелы: %q", stored)
	}
}

func TestHashVerifyRoundTrip(t *testing.T) {
	cyrillic, ascii, repeat := heavyHash(t)

	tcs := []struct {
		name     string
		stored   string
		password string
	}{
		{"кириллица и эмодзи", cyrillic, pwCyrillic},
		{"латиница", ascii, pwAscii},
		{"повторный хэш того же пароля", repeat, pwCyrillic},
		// Хэш, посчитанный до подъёма констант, обязан продолжаться
		// проверяться по своей стоимости.
		{"малая стоимость из строки", phcString(t, pwShort, 64, 1, 1, []byte("salt-for-roundtrip")), pwShort},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			if !noPanic(t, tc.name, func() bool { return VerifyPassword(tc.stored, tc.password) }) {
				t.Errorf("правильный пароль не прошёл: %q", tc.stored)
			}
		})
	}
}

func TestHashPasswordSaltIsRandom(t *testing.T) {
	first, _, repeat := heavyHash(t)
	if first == repeat {
		t.Fatalf("один и тот же пароль дал одну и ту же строку: соль не случайна")
	}
	// Отличается именно соль: тогда и ключ пересчитан по ней.
	segment := func(s string, i int) string { return strings.Split(s, "$")[i] }
	if segment(first, 4) == segment(repeat, 4) {
		t.Errorf("соль совпала: %q против %q", first, repeat)
	}
	if segment(first, 5) == segment(repeat, 5) {
		t.Errorf("ключ совпал при разной соли: %q", first)
	}
}

func TestVerifyPasswordRejectsWrongPassword(t *testing.T) {
	stored := phcString(t, pwCyrillic, 64, 1, 1, []byte("0123456789abcdef"))

	if pwCyrillic == pwCyrillicNFD {
		t.Fatal("константы прогона совпали: проверка на байтовую точность бессмысленна")
	}

	tcs := []struct {
		name     string
		password string
	}{
		{"пустой пароль", ""},
		{"опечатка в регистре", strings.ToLower(pwCyrillic)},
		{"лишний символ", pwCyrillic + "1"},
		{"недостающий символ", strings.TrimSuffix(pwCyrillic, "и")},
		{"другой пароль целиком", pwAscii},
		{"пробелы по бокам", " " + pwCyrillic + " "},
		{"та же строка в форме NFD", pwCyrillicNFD},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			if noPanic(t, tc.name, func() bool { return VerifyPassword(stored, tc.password) }) {
				t.Errorf("неверный пароль %q принят", tc.password)
			}
		})
	}

	// Хэш, посчитанный по другой соли, не принимает пароль «из чужой строки».
	other := phcString(t, pwCyrillic, 64, 1, 1, []byte("fedcba9876543210"))
	if stored == other {
		t.Error("разные соли дали одинаковую строку")
	}
	if VerifyPassword(other, pwAscii) {
		t.Error("пароль от другой строки принят")
	}
	if !VerifyPassword(other, pwCyrillic) {
		t.Error("хэш с другой солью не сверяет свой пароль")
	}
}

// §12.1: стоимость лежит в строке, а не в константах кода.
func TestVerifyPasswordTakesCostFromStoredString(t *testing.T) {
	salt := []byte("0123456789abcdef")
	cheap := phcString(t, pwShort, 64, 1, 1, salt)
	older := phcString(t, pwShort, 128, 2, 2, salt)

	if cheap == older {
		t.Fatal("разные параметры дали одинаковую строку")
	}
	for _, tc := range []struct {
		name   string
		stored string
	}{
		{"m=64,t=1,p=1", cheap},
		{"m=128,t=2,p=2", older},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if !VerifyPassword(tc.stored, pwShort) {
				t.Errorf("хэш со стоимостью %s не сверился: параметры читаются не из строки", tc.name)
			}
			if VerifyPassword(tc.stored, pwShort+"!") {
				t.Errorf("неверный пароль прошёл на %s", tc.name)
			}
		})
	}

	// Ключ длиннее базовых 32 байт — легитимная строка: парсер требует минимум,
	// а не точную длину.
	longKey := phcStringKey(t, pwShort, 64, 1, 1, 64, salt)
	if !VerifyPassword(longKey, pwShort) {
		t.Errorf("хэш с 64-байтным ключом не сверился: %q", longKey)
	}
}

// Битая строка в БД — это не 500 и не паника, а «неверная почта или пароль»
// (§3.7, §9): наружу причина не уходит, поэтому проверка обязана вернуть false
// на любом мусоре.
func TestVerifyPasswordRejectsMalformedStrings(t *testing.T) {
	tcs := []struct {
		name   string
		stored string
	}{
		{"пустая строка", ""},
		{"пробел", " "},
		{"не PHC вовсе", "password123"},
		{"слишком мало сегментов", "$argon2id$v=19$m=64,t=1,p=1$" + phcSalt},
		{"слишком много сегментов", "$argon2id$v=19$m=64,t=1,p=1$" + phcSalt + "$" + phcHash + "$extra"},
		{"нет ведущего разделителя", "argon2id$v=19$m=64,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"чужой алгоритм argon2i", "$argon2i$v=19$m=64,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"чужой алгоритм argon2d", "$argon2d$v=19$m=64,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"чужой алгоритм bcrypt", "$2b$10$" + phcSalt + "$" + phcHash},
		{"версия v=16", "$argon2id$v=16$m=64,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"версия без префикса v=", "$argon2id$19$m=64,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"нет сегмента версии", "$argon2id$m=64,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"нет t=", "$argon2id$v=19$m=64,p=1$" + phcSalt + "$" + phcHash},
		{"нет m=", "$argon2id$v=19$t=1,p=1$" + phcSalt + "$" + phcHash},
		{"нет p=", "$argon2id$v=19$m=64,t=1$" + phcSalt + "$" + phcHash},
		{"пустые параметры", "$argon2id$v=19$$" + phcSalt + "$" + phcHash},
		{"параметр без =", "$argon2id$v=19$m=64,t1,p=1$" + phcSalt + "$" + phcHash},
		{"параметр не число", "$argon2id$v=19$m=abc,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"отрицательное m", "$argon2id$v=19$m=-64,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"m=0", "$argon2id$v=19$m=0,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"t=0", "$argon2id$v=19$m=64,t=0,p=1$" + phcSalt + "$" + phcHash},
		{"p=0", "$argon2id$v=19$m=64,t=1,p=0$" + phcSalt + "$" + phcHash},
		// Верхняя граница: строка с m больше 2 GiB не должна заставлять сервер
		// выделять память — отказ до попытки посчитать (§12.1).
		{"m больше 2^21", "$argon2id$v=19$m=2147483648,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"m на границе плюс один", "$argon2id$v=19$m=2097153,t=1,p=1$" + phcSalt + "$" + phcHash},
		{"t больше 32", "$argon2id$v=19$m=64,t=33,p=1$" + phcSalt + "$" + phcHash},
		{"p больше 16", "$argon2id$v=19$m=64,t=1,p=17$" + phcSalt + "$" + phcHash},
		{"соль не base64", "$argon2id$v=19$m=64,t=1,p=1$!!!не base64!!!$" + phcHash},
		{"хэш не base64", "$argon2id$v=19$m=64,t=1,p=1$" + phcSalt + "$????&%"},
		{"base64-мусор в обоих сегментах", "$argon2id$v=19$m=64,t=1,p=1$%&/()$%&/()"},
		{"пустая соль", "$argon2id$v=19$m=64,t=1,p=1$$" + phcHash},
		{"пустой хэш", "$argon2id$v=19$m=64,t=1,p=1$" + phcSalt + "$"},
		{"хэш короче 32 байт", "$argon2id$v=19$m=64,t=1,p=1$" + phcSalt + "$" +
			base64.RawStdEncoding.EncodeToString(make([]byte, 16))},
		{"сегменты перепутаны местами", "$argon2id$m=64,t=1,p=1$v=19$" + phcSalt + "$" + phcHash},
		{"только разделители", "$$$$$"},
		{"URL-экранирование вместо base64", "$argon2id$v=19$m=64,t=1,p=1$" + phcSalt + "%3D$" + phcHash},
		{"строка в верхнем регистре алгоритма", "$ARGON2ID$v=19$m=64,t=1,p=1$" + phcSalt + "$" + phcHash},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			if noPanic(t, tc.name, func() bool { return VerifyPassword(tc.stored, pwShort) }) {
				t.Errorf("битая строка %q принята как валидный хэш", tc.stored)
			}
			// Пустой пароль на битой строке — тоже false, и всё ещё без паники.
			if noPanic(t, tc.name+" (пустой пароль)", func() bool { return VerifyPassword(tc.stored, "") }) {
				t.Errorf("пустой пароль принят на %q", tc.stored)
			}
		})
	}
}

// Пробелы — часть пароля, а не «шум ввода»: иначе половина реально слабых
// паролей становится совместимой с другим паролем.
func TestVerifyPasswordIsByteExact(t *testing.T) {
	stored := phcString(t, "  leading", 64, 1, 1, []byte("0123456789abcdef"))
	if !VerifyPassword(stored, "  leading") {
		t.Error("ведущие пробелы отброшены при сверке")
	}
	if VerifyPassword(stored, "leading") {
		t.Error("пробелы по бокам не входят в пароль")
	}
}

func TestVerifyPasswordDifferentSaltDifferentString(t *testing.T) {
	// Две сборки одной стоимости различаются только солью: иначе «случайная
	// соль» превращается в фиктивную.
	saltA := phcString(t, pwShort, 64, 1, 1, []byte("0123456789abcdef"))
	saltB := phcString(t, pwShort, 64, 1, 1, []byte("fedcba9876543210"))
	if saltA == saltB {
		t.Error("разные соли дали одинаковый хэш")
	}
	if !VerifyPassword(saltA, pwShort) || !VerifyPassword(saltB, pwShort) {
		t.Error("оба хэша обязаны сверяться со своим паролем")
	}
	if VerifyPassword(saltA, pwShort+" ") || VerifyPassword(saltB, pwShort+" ") {
		t.Error("мусорный вариант пароля принят")
	}
}
