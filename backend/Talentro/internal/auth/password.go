package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

// PasswordMinLen — нижняя граница длины пароля. §3.7 говорит «почта + пароль» и
// не называет числа; 8 символов — минимум, ниже которого пароль не защищает
// ничего, и он же проверяется на регистрации и на входе.
const PasswordMinLen = 8

const (
	// Пароль хранится хэшем argon2id (§7.3, §12.1). Текст пароля не пишется ни
	// в базу, ни в лог, ни в ответ API.
	phcAlgo    = "argon2id"
	phcVersion = 19 // номер версии формата, его пишет в строку x/crypto
	phcKeyLen  = 32
	phcSaltLen = 16

	// phcSaltMinLen — нижняя граница соли из готовой строки. Пишем мы 16
	// (phcSaltLen), но короткая соль делает таблицы предвычислений на один
	// пароль дешёвыми, поэтому строку с солью в пару байт не проверяем вовсе.
	phcSaltMinLen = 8

	// Параметры — нижняя граница OWASP для argon2id: 64 MiB памяти, 3 прохода,
	// 4 потока. На стенде с 2 ГБ это ~60 МБ на одну проверку, а проверок — не
	// больше десяти в минуту на IP (§12.2), поэтому память не кончится.
	mem64MiBKiB = 64 * 1024
	phcTime     = 3
	phcThreads  = 4
)

// Верхние границы параметров, которые мы принимаем из готовой строки хэша.
// Строку читаем из БД, но менять её должны умеющие люди: лимиты защищают от
// опечатки, после которой проверка пароля съедает весь сервер.
const (
	maxMemKiB  = 1 << 18 // 256 MiB — вчетверо выше текущей стоимости
	maxTime    = 8
	maxThreads = 8

	// Один m работу не ограничивает: строка m=256 MiB,t=8 стоит столько же,
	// сколько m=2 GiB,t=1. Поэтому ограниченно и произведение — потолок
	// 1 GiB «килобайт-проходов», то есть m=65536,t=3 (наша стоимость) входит
	// в него с запасом, а m=2097152 из битой строки — нет.
	maxWorkKiB = 1 << 20
)

// ErrMalformedHash — строка не разбирается как наш хэш. Наружу не отдаётся:
// проверяющий пароль отвечает «неверная почта или пароль», а не «в базе мусор».
var ErrMalformedHash = errors.New("хэш пароля повреждён")

// HashPassword считает argon2id и упаковывает его в строку PHC:
//
//	$argon2id$v=19$m=65536,t=3,p=4$<соль>$<хэш>
//
// Параметры лежат внутри строки, а не в коде: поднимать стоимость можно, не
// переписывая уже сохранённые хэши — старый сверяется по своим, новому
// посчитается по новым.
func HashPassword(password string) (string, error) {
	salt := make([]byte, phcSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("генерация соли: %w", err)
	}

	dk := argon2.IDKey([]byte(password), salt, phcTime, mem64MiBKiB, phcThreads, phcKeyLen)
	return formatParams(mem64MiBKiB, phcTime, phcThreads) +
		"$" + base64.RawStdEncoding.EncodeToString(salt) +
		"$" + base64.RawStdEncoding.EncodeToString(dk), nil
}

// VerifyPassword сверяет пароль с сохранённой строкой. Ложь возвращается и на
// повреждённой строке, и на пустом пароле: вызывающий не обязан различать
// причины, а посетителю они ничего полезного не скажут.
//
// Пустая stored — отказ мгновенный, без единого прохода argon2. Вызывающий,
// который читает хэш из базы, обязан сам сравнять время такого ответа с
// настоящим (см. handlers.Login), иначе «пароля нет» станет тем же признаком,
// который §3.7.1 запрещает подсматривать.
func VerifyPassword(stored, password string) bool {
	if stored == "" || password == "" {
		return false
	}

	salt, dk, memKiB, iters, threads, err := parsePHC(stored)
	if err != nil {
		return false
	}

	// Стоимость берётся из строки: иначе хэши, посчитанные до изменения
	// констант, перестали бы проверяться.
	candidate := argon2.IDKey([]byte(password), salt, iters, memKiB, uint8(threads), uint32(len(dk)))
	return subtle.ConstantTimeCompare(candidate, dk) == 1
}

func formatParams(memKiB, iters, threads uint32) string {
	return fmt.Sprintf("$%s$v=%d$m=%d,t=%d,p=%d", phcAlgo, phcVersion, memKiB, iters, threads)
}

func parsePHC(stored string) (salt, dk []byte, memKiB, iters, threads uint32, err error) {
	// Leading $ делает первым элемент пустым: $argon2id$v=… → ["", "argon2id", …].
	parts := strings.Split(stored, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != phcAlgo {
		return nil, nil, 0, 0, 0, ErrMalformedHash
	}

	var version uint64
	if v, ok := strings.CutPrefix(parts[2], "v="); ok {
		version, err = strconv.ParseUint(v, 10, 32)
	} else {
		err = errors.New("нет версии")
	}
	if err != nil || version != phcVersion {
		return nil, nil, 0, 0, 0, ErrMalformedHash
	}

	params := map[string]uint32{}
	for _, pair := range strings.Split(parts[3], ",") {
		key, val, ok := strings.Cut(pair, "=")
		if !ok {
			return nil, nil, 0, 0, 0, ErrMalformedHash
		}
		n, err := strconv.ParseUint(val, 10, 32)
		if err != nil {
			return nil, nil, 0, 0, 0, ErrMalformedHash
		}
		params[key] = uint32(n)
	}

	memKiB, iters, threads = params["m"], params["t"], params["p"]
	if memKiB == 0 || memKiB > maxMemKiB || iters == 0 || iters > maxTime ||
		threads == 0 || threads > maxThreads ||
		uint64(memKiB)*uint64(iters) > maxWorkKiB {
		return nil, nil, 0, 0, 0, ErrMalformedHash
	}

	if salt, err = base64.RawStdEncoding.DecodeString(parts[4]); err != nil || len(salt) < phcSaltMinLen {
		return nil, nil, 0, 0, 0, ErrMalformedHash
	}
	if dk, err = base64.RawStdEncoding.DecodeString(parts[5]); err != nil || len(dk) < phcKeyLen {
		return nil, nil, 0, 0, 0, ErrMalformedHash
	}

	return salt, dk, memKiB, iters, threads, nil
}
