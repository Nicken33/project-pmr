#!/usr/bin/env bash
# docs/acceptance/auth-curl.sh — приёмочная матрица локального входа (§3.7, §9,
# §12) живым curl против стоящего стенда. Скрипт сервер НЕ поднимает: он только
# стучится в уже запущенный api.
#
# Запуск:
#   bash docs/acceptance/auth-curl.sh
#   BASE=https://api.example.test bash docs/acceptance/auth-curl.sh
#   bash docs/acceptance/auth-curl.sh http://192.168.1.10:8081
#
# Формат вывода: на каждую строку матрицы — одна строка результата.
#   OKE   — совпало с ожидаемым
#   IMEY  — «имею» расхождение: ожидалось одно, получено другое
# В конце — итог и код выхода 0, только если все строки OKE.
#
# Про базу, на которой стоит прогонять:
#   * матрица пишет настоящие строки в `users` (регистрации, почты с меткой
#     времени) — на базе приёмочного стенда их быть не должно: Агенты сверяют
#     побайтовые ответы и counts, а этот прогон их сдвигает.
#   * для матрицы поднимайте отдельную базу (клон или свою на отдельном порту) и
#     отдельный порт api; `BASE` по умолчанию — 8081, это scratch-порт
#     координатора, а не стендовый 8080.
#
# Про лимиты (§12.2), чтобы не спутать падение с лимитом:
#   * регистрация — 3 в час на IP. Второй запуск скрипта в том же час упирается
#     в 429 на register; это не дефект, скрипт печатает отдельную подсказку.
#   * вход — 10 попыток в минуту на IP. Блок перебора учитывает входы, сделанные
#     выше по скрипту, и ждёт 429 ровно на (11 - уже_сделано)-й попытке.
#   * адреса почты уникальны на запуск (метка времени), поэтому 409 возникает
#     только на втором обращении к одной и той же почте внутри прогона.
set -uo pipefail

BASE="${1:-${BASE:-http://127.0.0.1:8081}}"

PASS=0
FAIL=0

JAR="$(mktemp)"        # куки после успешного входа: ими и проверяем /me
JAR_ANON="$(mktemp)"   # пустой jar для анонимного /me
HDR="$(mktemp)"        # заголовки последнего ответа
BODY="$(mktemp)"       # тело последнего ответа
BODY_WRONG="$(mktemp)" # тело 401 «неверный пароль» — эталон побайтовой сверки
BODY_UNKNOWN="$(mktemp)"
BODY_DUP="$(mktemp)"
BODY_REG="$(mktemp)"
trap 'rm -f "$JAR" "$JAR_ANON" "$HDR" "$BODY" "$BODY_WRONG" "$BODY_UNKNOWN" "$BODY_DUP" "$BODY_REG"' EXIT

oke() {
	printf 'OKE\t%s\n' "$1"
	PASS=$((PASS + 1))
}

imey() {
	printf 'IMEY\t%s\n' "$1"
	FAIL=$((FAIL + 1))
}

# check <подпись> <команда проверки...>: команда — любой test/grep, результат
# которого уже посчитан (код 0 = совпало).
check() {
	local name="$1"
	shift
	if "$@"; then
		oke "$name"
	else
		imey "$name"
	fi
}

# check_code <ждали> <получили> <подпись> <что значит 429>: код сверяется
# буквально, а 429 на месте другого кода печатается отдельной строкой — иначе
# исчерпанное окно (§12.2) читалось бы как дефект входа.
check_code() {
	local want="$1" got="$2" name="$3" limit_note="$4"
	if [ "$got" = "$want" ]; then
		oke "$name"
	elif [ "$got" = "429" ]; then
		imey "$name: 429 — $limit_note, строка неинформативна"
	else
		imey "$name: код $got, ждали $want"
	fi
}

# Регистраций на IP — 3 в час (§12.2), поэтому матрица делает ровно три
# «зачётных» обращений к register: обычный, дубль и пустое имя. Проверки
# валидации кода не тратят: хендлер проверяет форму до счётчика.
REG_NOTE="окно 3 регистрации/час исчерпано"
LOGIN_NOTE="окно 10 входов/минуту исчерпано раньше"

# req <метод> <путь> <тело> <файл_куда_писать_тело> [jar]: печатает HTTP-код.
# Заголовки всегда пишутся в $HDR — по ним сверяем Set-Cookie и Retry-After.
req() {
	local method="$1" path="$2" body="$3" out="$4" jar="${5:-}"
	local args=(-s -D "$HDR" -o "$out" -w '%{http_code}' -X "$method" "$BASE$path"
		-H 'Content-Type: application/json')
	[ -n "$jar" ] && args+=(-b "$jar" -c "$jar")
	[ -n "$body" ] && args+=(--data "$body")
	curl "${args[@]}"
}

# Счётчик попыток входа с одного адреса: лимит считается по IP (§12.2), и все
# запросы скрипта приходят с одного адреса.
LOGIN_ATTEMPTS=0

# login пишет код в LAST_LOGIN_CODE, а не в stdout: `code=$(login ...)` — это
# подшелл, и приращение LOGIN_ATTEMPTS в нём исчезало бы вместе с ним. Счётчик
# заврался бы на нуле, и проверка лимита ждала бы 429 на попытке, которой нет.
login() {
	local email="$1" password="$2" out="$3" jar="${4:-}"
	LOGIN_ATTEMPTS=$((LOGIN_ATTEMPTS + 1))
	LAST_LOGIN_CODE=$(req POST /api/auth/login "{\"email\":\"$email\",\"password\":\"$password\"}" "$out" "$jar")
}

header_value() {
	local name="$1"
	# Имя заголовка без учёта регистра, значение после первого двоеточия.
	grep -i "^$name:" "$HDR" | head -n 1 | sed -e "s/^[^:]*:[[:space:]]*//" -e 's/[[:space:]]*$//' -e 's/\r$//'
}

json_has() {
	local file="$1" pattern="$2"
	grep -Eq "$pattern" "$file"
}

STAMP="$(date +%s)$$"
PW="пароль-для-приёмки-42"
PW_BAD="пароль-не-тот-99"
EMAIL="accept-$STAMP@example.test"
EMAIL_GHOST="ghost-$STAMP@example.test"
NAME="Приёмка"

printf '# Talentro, локальный вход: %s\n' "$BASE"
printf '# почта прогона: %s\n' "$EMAIL"

# 0. Стенд вообще отвечает: иначе пустые коды читаются как падение входа.
health=$(req GET /health '' "$BODY" '')
if [ "$health" != "200" ]; then
	imey "/health = $health: api на $BASE не отвечает, дальние строки неинформативны"
	exit 2
fi
oke 'стенд жив: /health 200'

# 1. Регистрация (§3.7.1, §9.8): 201 и кука в том же ответе — входить повторно
#    не нужно; тип аккаунта ставит сервер = user (§3.7.2).
code=$(req POST /api/auth/register \
	"{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"name\":\"$NAME\"}" "$BODY_REG" "$JAR")
if [ "$code" = "429" ]; then
	imey "register = 429: $REG_NOTE (§12.2). Повтори прогон позже или с другого адреса"
	# Дальше сверять нечего: аккаунта нет, вход и /me рухнут каскадом.
	imey "остальные строки пропущены: аккаунт $EMAIL не создан"
	exit 1
fi
check_code 201 "$code" 'register 201' "$REG_NOTE"
json_has "$BODY_REG" '"authenticated"[[:space:]]*:[[:space:]]*true' &&
	oke 'register: authenticated:true в теле' ||
	imey 'register: в теле нет authenticated:true'
json_has "$BODY_REG" '"provider"[[:space:]]*:[[:space:]]*"local"' &&
	oke 'register: provider local' ||
	imey 'register: provider не local'
json_has "$BODY_REG" '"role"[[:space:]]*:[[:space:]]*"user"' &&
	oke 'register: роль user (сервер, не клиент — §3.7.2)' ||
	imey 'register: роль не user'

# Кука: ровно та, что выдаёт session.go (§3.7, §12).
grep -i '^set-cookie:' "$HDR" | grep -q 'talentro_session' &&
	oke 'register: Set-Cookie talentro_session' ||
	imey 'register: в ответе нет Set-Cookie talentro_session'
for attr in 'Path=/' 'HttpOnly' 'SameSite=Lax' 'Max-Age=2592000'; do
	grep -i '^set-cookie:' "$HDR" | tr -d '\r' | grep -q "$attr" &&
		oke "register: атрибут куки $attr" ||
		imey "register: в Set-Cookie нет $attr (30 суток, HttpOnly, Lax, Path=/)"
done

# 2. Повторная регистрация той же почты — 409 с подсказкой по полю email (§3.7.1, §9).
code=$(req POST /api/auth/register \
	"{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"name\":\"$NAME\"}" "$BODY_DUP" '')
check_code 409 "$code" 'повторный register тем же имейлом 409' "$REG_NOTE"
json_has "$BODY_DUP" '"code"[[:space:]]*:[[:space:]]*409' &&
	oke 'дубль: code 409 в конверте (§9)' ||
	imey 'дубль: в конверте нет code:409'
json_has "$BODY_DUP" '"fields"[[:space:]]*:[[:space:]]*{[^}]*"email"' &&
	oke 'дубль: fields.email заполнен' ||
	imey 'дубль: в fields нет ключа email'
grep -i '^set-cookie:' "$HDR" | grep -q 'talentro_session' &&
	imey 'дубль: на 409 выставлена кука — чужая почта оформила бы сессию' ||
	oke 'дубль: куки нет'

# 3. Неверная почта или пароль (§3.7.1): существование адреса не должно читаться
#    ни в статусе, ни в теле — сверяем ответы побайтово.
login "$EMAIL" "$PW_BAD" "$BODY_WRONG" ''; code=$LAST_LOGIN_CODE
check_code 401 "$code" 'login неверным паролем 401' "$LOGIN_NOTE"
login "$EMAIL_GHOST" "$PW" "$BODY_UNKNOWN" ''; code=$LAST_LOGIN_CODE
check_code 401 "$code" 'login неизвестной почтой 401' "$LOGIN_NOTE"
if cmp -s "$BODY_WRONG" "$BODY_UNKNOWN"; then
	oke 'оба 401 совпадают побайтово (существование почты не утекает)'
else
	imey 'тексты 401 различаются: сравни тела — ожидался один и тот же конверт'
	printf '#   неверный пароль: %s\n' "$(tr -d '\r\n' <"$BODY_WRONG")"
	printf '#   нет такой почты: %s\n' "$(tr -d '\r\n' <"$BODY_UNKNOWN")"
fi
json_has "$BODY_UNKNOWN" '"message"[[:space:]]*:[[:space:]]*"неверная почта или пароль"' &&
	oke '401: текст «неверная почта или пароль»' ||
	imey '401: текст не тот'
grep -i '^set-cookie:' "$HDR" | grep -q 'talentro_session' &&
	imey '401: на отказе выставлена кука' ||
	oke '401: куки нет'

# 4. Слабый пароль и битая почта — 400 с fields по именам полей (§3.7.1, §9).
code=$(req POST /api/auth/register "{\"email\":\"$EMAIL\",\"password\":\"123\",\"name\":\"$NAME\"}" "$BODY" '')
check_code 400 "$code" 'register коротким паролем 400' "$REG_NOTE"
json_has "$BODY" '"fields"[[:space:]]*:[[:space:]]*{[^}]*"password"' &&
	oke '400: fields.password' || imey '400: нет fields.password'

code=$(req POST /api/auth/register "{\"email\":\"не почта\",\"password\":\"$PW\",\"name\":\"$NAME\"}" "$BODY" '')
check_code 400 "$code" 'register битой почтой 400' "$REG_NOTE"
json_has "$BODY" '"fields"[[:space:]]*:[[:space:]]*{[^}]*"email"' &&
	oke '400: fields.email' || imey '400: нет fields.email'

# Имя — не поле входа (§3.7.1 называет почту и пароль), пустое не ошибка:
# сервер пишет пустой `users.name`, а витрина строит подпись из почты.
code=$(req POST /api/auth/register "{\"email\":\"noname-$STAMP@example.test\",\"password\":\"$PW\",\"name\":\"  \"}" "$BODY" '')
check_code 201 "$code" 'register пустым именем 201 (имя необязательное)' "$REG_NOTE"
json_has "$BODY" '"role"[[:space:]]*:[[:space:]]*"user"' &&
	oke 'register без имени: роль user' || imey 'register без имени: роль не user'

# 5. GET на эндпоинты входа — 405, а не 401/201 (§9.8).
code=$(req GET /api/auth/login '' "$BODY" '')
check 'GET /api/auth/login 405' test "$code" = "405"
code=$(req GET /api/auth/register '' "$BODY" '')
check 'GET /api/auth/register 405' test "$code" = "405"

# 6. Успешный вход: 200, та же форма MeView, что у /me, и кука.
rm -f "$JAR"; : >"$JAR"
login "$EMAIL" "$PW" "$BODY" "$JAR"; code=$LAST_LOGIN_CODE
check_code 200 "$code" 'login верной парой 200' "$LOGIN_NOTE"
json_has "$BODY" '"authenticated"[[:space:]]*:[[:space:]]*true' &&
	oke 'login: authenticated:true' || imey 'login: нет authenticated:true'
json_has "$BODY" '"provider"[[:space:]]*:[[:space:]]*"local"' &&
	oke 'login: provider local' || imey 'login: provider не local'
json_has "$BODY" '"role"[[:space:]]*:[[:space:]]*"user"' &&
	oke 'login: роль user' || imey 'login: роль не user'
json_has "$BODY" "\"email\"[[:space:]]*:[[:space:]]*\"$EMAIL\"" &&
	oke 'login: почта в ответе совпала' || imey 'login: почта в ответе не та'
grep -i '^set-cookie:' "$HDR" | grep -q 'talentro_session' &&
	oke 'login: Set-Cookie выставлена' || imey 'login: кука не выставлена'

# 7. /me с кукой и без (§3.7): аноним — это 200 с authenticated:false, а не 401.
code=$(req GET /api/auth/me '' "$BODY" "$JAR")
check '/me с кукой 200' test "$code" = "200"
json_has "$BODY" '"authenticated"[[:space:]]*:[[:space:]]*true' &&
	oke '/me с кукой: authenticated:true' || imey '/me с кукой: authenticated:false'
json_has "$BODY" '"provider"[[:space:]]*:[[:space:]]*"local"' &&
	oke '/me с кукой: provider local' || imey '/me с кукой: provider не local'

code=$(req GET /api/auth/me '' "$BODY" "$JAR_ANON")
check '/me без куки 200' test "$code" = "200"
json_has "$BODY" '"authenticated"[[:space:]]*:[[:space:]]*false' &&
	oke '/me без куки: authenticated:false' ||
	imey '/me без куки: authenticated не false (аноним обязан быть состоянием, а не ошибкой)'

# 8. Перебор паролей (§12.2): 10 попыток в минуту на IP, одиннадцатая — 429 с
#    Retry-After. Счёт учитывает входы, сделанные выше (шаги 3 и 6).
UNTIL_BLOCK=$((11 - LOGIN_ATTEMPTS))
if [ "$UNTIL_BLOCK" -lt 1 ]; then
	imey "перебор пропущен: до него сделано $LOGIN_ATTEMPTS входов, окно исчерпано раньше"
else
	block_at=0
	for i in $(seq 1 "$UNTIL_BLOCK"); do
		login "$EMAIL" "не-тот-пароль-$i" "$BODY" ''; code=$LAST_LOGIN_CODE
		if [ "$code" = "429" ]; then
			block_at="$i"
			break
		fi
	done
	if [ "$block_at" = "$UNTIL_BLOCK" ]; then
		oke "перебор: 429 ровно на ${block_at}-й попытке (всего ${LOGIN_ATTEMPTS} в окне)"
		retry=$(header_value Retry-After)
		case "$retry" in
		'' | *[!0-9]*) imey "429 без корректного Retry-After (получено: «$retry»)" ;;
		*)
			if [ "$retry" -ge 1 ] && [ "$retry" -le 61 ]; then
				oke "429: Retry-After = $retry с"
			else
				imey "429: Retry-After = $retry, ждали 1..61 с (окно — минута)"
			fi
			;;
		esac
		# Другой IP не должен делить чужое окно, но проверить это одним curl
		# нельзя: адрес берётся из TCP-соединения. Остаётся ручной проверкой:
		# прогон с второй машины или через -x proxy.
	else
		if [ "$block_at" = "0" ]; then
			imey "перебор: 429 так и не пришёл за $UNTIL_BLOCK попыток (до этого было ${LOGIN_ATTEMPTS} входов) — лимит 10/мин не работает"
		else
			imey "перебор: 429 на ${block_at}-й попытке, ждали на ${UNTIL_BLOCK}-й — окно считает не так, как §12.2"
		fi
	fi
fi

printf '# итог: OKE %d, IMEY %d\n' "$PASS" "$FAIL"
if [ "$FAIL" -ne 0 ]; then
	exit 1
fi
exit 0
