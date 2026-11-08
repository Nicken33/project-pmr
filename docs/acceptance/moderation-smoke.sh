#!/usr/bin/env bash
# docs/acceptance/moderation-smoke.sh — независимая проверка кабинета модерации
# (§3.9, §12.1) живым curl против уже стоящего API. Скрипт сервер НЕ поднимает.
#
# Запуск (по умолчанию — канонический стенд: api на :8080 и база 55432):
#   bash docs/acceptance/moderation-smoke.sh
#   TESTER=<токен проверочного входа> bash docs/acceptance/moderation-smoke.sh
#   BASE=http://127.0.0.1:8083 PSQL_PORT=55435 PSQL_DB=talentro_mod \
#     bash docs/acceptance/moderation-smoke.sh   — отдельная сборка ветки
#   БД для повышения/отзыва роли: PSQL_HOST / PSQL_PORT / PSQL_DB / PSQL_USER /
#   PSQL_BIN. Без TESTER строки про тестировщика уходят в SKIP, остальное
#   матрица проверяет.
#
# Проверяется ровно то, что заявлено в handlers/moderation.go:
#   401 анониму, 403 обычному user и тестировщику, 200 модератору; журнал и
#   жалобы; идемпотентность решения (повтор того же — 200 с replayed=true,
#   попытка переписать — 409); 400 на отказ без причины; отзыв роли отзывает
#   доступ сразу, живая кука не помогает.
#
# Данные трогает точечно: роль повышает и отзывает у своей проверяющей почты,
# решение принимает по одной заявке, после чего возвращает её в pending,
# восстанавливает статус карточки и удаляет строки журнала, добавленные этим
# прогоном. Прогон повторяем.
#
# Формат вывода — как в auth-curl.sh: на строку матрицы одна строка результата,
# OKE — совпало, IMEY — расхождение. Код выхода 0, только если всё OKE.
set -uo pipefail

BASE="${1:-${BASE:-http://127.0.0.1:8080}}"
PSQL_BIN="${PSQL_BIN:-C:/Program Files/PostgreSQL/18/bin/psql.exe}"
PSQL_HOST="${PSQL_HOST:-127.0.0.1}"
PSQL_PORT="${PSQL_PORT:-55432}"
PSQL_DB="${PSQL_DB:-talentro_accept_1516}"
PSQL_USER="${PSQL_USER:-user7}"

EMAIL="${MOD_EMAIL:-coord-mod-check@example.test}"
PASSWORD="проверочный-пароль-2026"
# Токен проверочного входа в репозиторий не кладём (тот же порядок, что у
# docs/acceptance/15-16-checklist.md §«токен не раскрыт»). Без него две строки
# про тестировщика просто не проверяются, остальное матрица делает.
TESTER="${TESTER:-}"

OUT=/tmp/moderation-smoke.out.json
BODY=/tmp/moderation-smoke.body.json
JAR_USER=/tmp/moderation-smoke-user.jar
JAR_TESTER=/tmp/moderation-smoke-tester.jar
JAR_MOD=/tmp/moderation-smoke-mod.jar
rm -f "$OUT" "$BODY" "$JAR_USER" "$JAR_TESTER" "$JAR_MOD"
: > "$OUT"
: > "$BODY"

PASS=0
FAIL=0
SKIP=0

oke() { printf 'OKE\t%s — %s\n' "$1" "$2"; PASS=$((PASS + 1)); }
imey() { printf 'IMEY\t%s — ждали %s, имею %s\n' "$1" "$2" "$3"; FAIL=$((FAIL + 1)); }
skipped() { printf 'SKIP\t%s — %s\n' "$1" "$2"; SKIP=$((SKIP + 1)); }

# row <подпись> <ждали> <получили>
row() {
	if [ "$3" = "$2" ]; then oke "$1" "$3"; else imey "$1" "$2" "$3"; fi
}

# req <method> <path> <jar|-> — код ответа; тело берётся из $BODY (и очищается),
# ответ лежит в $OUT. Тело уходит файлом: Git Bash перекодирует argv для
# нативного curl, и кириллица доезжает мусором.
req() {
	local method="$1"
	local path="$2"
	local jar="$3"
	local args=(-s -o "$OUT" -w '%{http_code}' -X "$method" "$BASE$path"
		-H 'content-type: application/json')
	if [ "$jar" != "-" ]; then args+=(-b "$jar" -c "$jar"); fi
	if [ -s "$BODY" ]; then args+=(--data-binary "@$BODY"); fi
	curl "${args[@]}"
	: > "$BODY"
}

# sql <запрос> — скалярный ответ psql; пустой вывод = нет строк.
sql() {
	"$PSQL_BIN" -h "$PSQL_HOST" -p "$PSQL_PORT" -U "$PSQL_USER" -d "$PSQL_DB" -At -c "$1" 2>/dev/null
}

# has <подпись> <подстрока> — проверка поля в теле последнего ответа.
has() {
	if grep -q -- "$2" "$OUT"; then oke "$1" "есть $2"; else imey "$1" "в ответе $2" "$(head -c 160 "$OUT")"; fi
}

# 1) Аноним: очередь не существует для него, но и не молчит — 401 с подсказкой.
code=$(req GET /api/v1/moderation/queue -)
row "аноним в очередь" 401 "$code"

# 2) Проверяющая учётка: вход, а при первом запуске — регистрация.
printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD" > "$BODY"
code=$(req POST /api/auth/login "$JAR_USER")
if [ "$code" = "429" ]; then
	imey "вход проверяющей почты" 200 "429 — окно лимита входов исчерпано, прогони позже"
	exit 1
fi
if [ "$code" != "200" ]; then
	printf '{"email":"%s","password":"%s","name":"%s"}' "$EMAIL" "$PASSWORD" "Координатор-проверка" > "$BODY"
	code=$(req POST /api/auth/register "$JAR_USER")
	if [ "$code" = "429" ]; then
		imey "регистрация проверяющей почты" 201 "429 — окно 3 регистрации/час исчерпано"
		exit 1
	fi
	row "регистрация проверяющей почты" 201 "$code"
	printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD" > "$BODY"
	code=$(req POST /api/auth/login "$JAR_USER")
fi
row "вход по почте и паролю" 200 "$code"

# 3) Обычный пользователь в кабинет не допускается — и это не 404: маршрут
# существует, права кончились.
code=$(req GET /api/v1/moderation/queue "$JAR_USER")
row "очередь под обычным user" 403 "$code"

# 4) Тестировщик: моки кабинетов видит, чужие заявки — нет (§3.7).
if [ -z "$TESTER" ]; then
	skipped "вход тестировщика" "токен не передан: TESTER=<токен стенда> bash $0"
	skipped "очередь под тестировщиком" "сессии тестировщика нет"
else
	printf '{"token":"%s"}' "$TESTER" > "$BODY"
	code=$(req POST /api/auth/tester "$JAR_TESTER")
	if [ "$code" = "401" ]; then
		imey "вход тестировщика" "200" "401 — переданный TESTER не совпал с токеном api"
	else
		row "вход тестировщика" 200 "$code"
	fi
	code=$(req GET /api/v1/moderation/queue "$JAR_TESTER")
	row "очередь под тестировщиком" 403 "$code"
fi

# 5) Повышение роли в базе и свежий вход: роль приходит из users, не из догадок.
sql "update users set account_type='moderator' where email='$EMAIL'" > /dev/null
printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD" > "$BODY"
code=$(req POST /api/auth/login "$JAR_MOD")
row "вход после повышения роли" 200 "$code"

code=$(req GET /api/v1/moderation/queue "$JAR_MOD")
row "очередь модератора" 200 "$code"
# Число заявок — не проверка, а факт: на пустой базе очередь пустая, и это
# правильно (заявок никто не подавал). Выдавать её за «непустую» нельзя.
count=$(grep -o '"id"' "$OUT" | wc -l | tr -d ' ')
printf 'INFO\tочередь модератора — заявок в ответе: %s\n' "$count"

code=$(req GET /api/v1/moderation/journal "$JAR_MOD")
row "журнал модератора" 200 "$code"
code=$(req GET /api/v1/moderation/reports "$JAR_MOD")
row "жалобы модератора" 200 "$code"

# 6) Решение по заявке. Счётчик журнала берём до, чтобы потом убрать только свои
# строки и не тронуть сид.
APPID=$(sql "select id from moderation_applications where status='pending' order by id limit 1")
if [ -z "$APPID" ]; then
	skipped "проверка решений" "в базе нет заявок в pending — прогон нечего проверять"
else
	CARDID=$(sql "select card_id from moderation_applications where id=$APPID")
	CARDSTATUS=$(sql "select status from cards where id=$CARDID")
	JMAX=$(sql "select coalesce(max(id), 0) from moderation_journal")

	printf '{"action":"approve","comment":"проверка координатора"}' > "$BODY"
	code=$(req POST "/api/v1/moderation/applications/$APPID/decision" "$JAR_MOD")
	row "одобрение заявки" 200 "$code"
	has "одобрение записано как новое решение" '"replayed":false'
	after=$(sql "select count(*) from moderation_journal where id > $JMAX")
	row "строка журнала добавлена" 1 "$after"

	# Повтор той же кнопки после оборвавшейся сети: успех, но не вторая запись.
	printf '{"action":"approve","comment":"проверка координатора"}' > "$BODY"
	code=$(req POST "/api/v1/moderation/applications/$APPID/decision" "$JAR_MOD")
	row "повтор того же решения" 200 "$code"
	has "повтор помечен replayed" '"replayed":true'
	after=$(sql "select count(*) from moderation_journal where id > $JMAX")
	row "повтор не плодит журнал" 1 "$after"

	# Переписать одобрение отказом нельзя — 409 (§3.9.4).
	printf '{"action":"reject","reason":"проверка переписывания"}' > "$BODY"
	code=$(req POST "/api/v1/moderation/applications/$APPID/decision" "$JAR_MOD")
	row "переписка решения отказом" 409 "$code"

	# Отказ без типовой причины — 400 до всякой записи (§3.9.3).
	OTHER=$(sql "select id from moderation_applications where status='pending' and id <> $APPID order by id limit 1")
	if [ -z "$OTHER" ]; then
		skipped "отказ без причины" "вторая pending-заявка не найдена"
	else
		printf '{"action":"reject"}' > "$BODY"
		code=$(req POST "/api/v1/moderation/applications/$OTHER/decision" "$JAR_MOD")
		row "отказ без причины" 400 "$code"
	fi

	# Возврат стенда в исходное состояние: заявка снова ждёт решения, карточка
	# стоит на своём статусе, журнал без наших строк.
	sql "delete from moderation_journal where id > $JMAX" > /dev/null
	sql "update moderation_applications set status='pending', decided_by=NULL, decided_at=NULL, reject_reason=NULL where id=$APPID" > /dev/null
	if [ -n "$CARDSTATUS" ]; then
		sql "update cards set status='$CARDSTATUS', reject_reason=NULL where id=$CARDID" > /dev/null
	fi
	oke "стенд восстановлен" "заявка $APPID возвращена в pending"
fi

# 7) Отзыв роли с живой кукой: доступ кончается в тот же запрос, потому что
# роль перечитывается из базы (§12.1).
sql "update users set account_type='user' where email='$EMAIL'" > /dev/null
code=$(req GET /api/v1/moderation/queue "$JAR_MOD")
row "очередь после отзыва роли" 403 "$code"

printf 'ИТОГ\tOKE %d, IMEY %d, SKIP %d\n' "$PASS" "$FAIL" "$SKIP"
[ "$FAIL" -eq 0 ] || exit 1
