# Приёмка задач №15 / №16

Документ для независимой приёмки. Реализацию ведёт Агент 1 в ветке
`feat/15-clean-site-tester-session`; этот чек-лист её **не правит**, а проверяет.

- Спека: `docs/superpowers/specs/2026-11-04-clean-site-tester-session-design.md`
- Журнал фронтовых аудитов: `web/COORDINATION.md`
- Каноническая модель данных: §7 ТЗ (`groups` / `locations` / `districts`, `/api/v1/activities`)

Найдено расхождение — не чиним сами, а отдаём Агенту 1 и координатору с путём и
номером строки (раздел «Куда отправлять находки»).

---

## Правила прогона

1. **Дерево живое и меняется.** Файлы `backend/Talentro/**` и `web/src/**`
   редактируются параллельно. Каждый результат записывать с временем
   (`date +%H:%M:%S`) и с `git rev-parse --short HEAD` + `git status --short | wc -l`.
   Результат без отметки времени через час невозможно интерпретировать.
2. **Порты заняты — не занимать и не перезапускать.** `:3000`, `:3010`, `:8080`,
   `:55432` — Агента 1; `:8081` — **стенд Агента 2**, только `GET`-запросы,
   не перезапускать (указание координатора 17:47):

   | Порт | Что | Владелец | Чем запущено |
   |---|---|---|---|
   | `:3000` | Next dev, основное дерево | Агент 1 | `next dev` из `web/` |
   | `:3010` | Next prod, основное дерево | Агент 1 | `next start -p 3010` из `web/` |
   | `:8080` | бэкенд ветки №15 | Агент 1 | `go run ./cmd/app` из `backend/Talentro` |
   | `:8081` | **канонический** бэкенд | **Агент 2** | `C:\Users\user7\AppData\Local\talentro_build\api.exe` |
   | `:5432` | системный Postgres | общий | служба Windows (нужен пароль) |
   | `:55432` | изолированный кластер стенда | Агент 1 | `pg_ctl` (trust-авторизация) |

   Свободные порты для своих проверок: `:3011` (Next), `:8082` (Go).
   **Серверы Агента 1 не останавливать** (решение координатора 18:00): окно
   простоя для `next build` согласует сам координатор, приёмка его не инициирует.
3. **`next build` в `web/` не запускать без согласования.** Сборка пишет в общий
   `web/.next`, а `:3000` и `:3010` обслуживаются из того же каталога.
   `web/COORDINATION.md` (раздел «Тап-зоны 44×44», ловушка на будущее) фиксирует:
   после перетирания чанков уже запущенный `next dev` начинает отдавать 404 на CSS,
   и страница приходит «без стилей». Для приёмки прод-сборки нужен отдельный
   каталог сборки или согласованное окно простоя.
4. **Записи в БД — только по согласованию с Агентом 1.** Пункт 1 §7
   (`psql -f database/init.sql`) меняет данные стенда, который сейчас используется.
5. **Только чтение.** `curl`, `GET`-запросы, `psql -Atc "SELECT ..."`, статические
   гейты. Никаких `merge` / `rebase` / `checkout`. Не трогать `frontend/mobile/**`
   и `.worktrees/backend/**`.
6. `psql` и `pg_ctl` **не на PATH**. Клиент Postgres 18 лежит здесь:

   ```bash
   PSQL="/c/Program Files/PostgreSQL/18/bin/psql.exe"
   export PGCONNECT_TIMEOUT=5
   "$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d postgres -Atc "SELECT 1;"
   ```

   Флаг `-w` обязателен: без него `psql` молча ждёт пароль и команда виснет до
   таймаута. `PGCONNECT_TIMEOUT` — чтобы не ждать минуту на недоступном порту.
7. **Окружение пересобирается на ходу.** Замер 17:21: база `talentro` на `:55432`
   появилась в списке и исчезла между двумя соседними командами. Имя базы
   выяснять непосредственно перед прогоном (команда в пункте 1 §7), а не брать из
   этого документа как константу.
8. **Кириллица в URL — только percent-encoding.** Консоль Git Bash на Windows не
   в UTF-8 (вывод `tasklist` приходит в mojibake). Переданная через shell
   кириллица даёт от канона `400 {"error":{"code":400,...,"fields":{"q":"значение
   должно быть корректной строкой в UTF-8"}}}` — это **артефакт консоли, не дефект
   сервера**. Проверено literal-кодированием:
   `?q=%D1%88%D0%B0%D1%85%D0%BC%D0%B0%D1%82` → `200` с результатами.
   В скриптах использовать `curl -G --data-urlencode` либо готовый percent-encoded
   литерал, и всегда перепроверять подозрительный `400` вторым способом.

---

## Перепроверки

Сводная лента повторных замеров. Базовые замеры лежат в «Базовый замер A» и
«Базовый замер B и C»; здесь — только то, что пересчитывалось позже, с указанием
времени и `HEAD` на момент прогона. `HEAD` за день двигался часто, поэтому без
него строка бессмысленна: выводы действительны только для своей ревизии.

| # | Время | `HEAD` | Что перепроверено | Итог | Подробности |
|---|---|---|---|---|---|
| 1 | 17:36–17:37 | `b9b34c5` | Канонический контракт на `:8081`: плоский `price` как `min(groups[].price_from)` на всех 8 анкетах, полный набор `org_slug`, маршруты фронта на `:3010` | расхождение слагов между четырьмя источниками | «Перепроверка 17:36–17:37», «Находка: слаги» |
| 2 | 18:00 | `b9b34c5` | Решения координатора: слаги-цели `studiya-palitra` и `tiraspol-studiya-palitra`, отсутствие `/api/v1/organizations/{slug}`, игнорирование `?org=` и `?org_slug=`, отсутствие auth-маршрутов | часть §7 п.5 про `/organizations/*` — блок, не провал | «Находка: слаги», Раздел E |
| 3 | 19:04–19:20 | `796a00b` → `03d854e` | Сборка чекпоинта `b9b34c5` через `git archive`; гейты Go трижды и flaky-подтест 12 отдельными процессами; веб-гейты; отпечаток запущенного `:8080`; пригодность `:3010` для замеров §6 | два дефекта гейта Go — оба закрыты; auth-срез ожил на `:8080`; стенд `:3010` держит устаревшую сборку и для замеров §6 непригоден | «Третий прогон A» и два подраздела о дефектах гейта Go ниже |

---

## Раздел A. Статические гейты (§7, пункт 8)

Запускать из корня репозитория, если не указано иное.

| # | Команда | Ожидание |
|---|---|---|
| A1 | `cd backend/Talentro && go vet ./...` | exit 0, вывод пустой |
| A2 | `cd backend/Talentro && go test ./...` | `ok` или `no test files`, ни одного `FAIL` |
| A3 | `cd web && npx tsc --noEmit --incremental false` | exit 0, вывод пустой |
| A4 | `cd web && npx eslint src` | `0 errors`. Предупреждения `@next/next/no-img-element` допустимы |
| A5 | `cd web && npx vitest run` | все тесты зелёные, ни одного `failed` |
| A6 | `cd web && npx next build` | exit 0, `Compiled successfully`. **Только по согласованию** (правило 3) |

`--incremental false` в A3 обязателен: без него `tsc` пишет общий
`web/tsconfig.tsbuildinfo` и конфликтует с таким же прогоном Агента 1.

### Базовый замер A (17:14–17:15, HEAD `b9b34c5` + 27 незакоммиченных файлов)

| Гейт | Факт |
|---|---|
| A1 `go vet` | exit 0, вывод пустой |
| A2 `go test` | `ok talento/internal/delivery/http` (единственный пакет с тестами — `cors_test.go`); `no test files` у `internal/auth`, `handlers`, `models`, `repository`, `config`, `cmd/app` |
| A3 `tsc` | exit 0, ошибок нет |
| A4 `eslint src` | 0 ошибок, 12 предупреждений `no-img-element` (`app/organizations/[slug]/page.tsx:84`, `components/account/ApplicationForm.tsx:1530`, `components/activity/ActivityDetail.tsx:290,308,685,767`, `components/activity/ReviewsBlock.tsx:336,442,636`, `components/catalog/Hero.tsx:171`, `components/layout/Footer.tsx:10`, `components/layout/Header.tsx:75`) |
| A5 `vitest run` | 59/59 в 3 файлах: `lib/filters.test.ts` (24), `lib/api-server.test.ts` (11), `lib/moderation.test.ts` (24) |
| A6 `next build` | **не запускался** — правило 3 |

Тестов `internal/auth` нет: §7 требует табличные тесты на подпись/проверку куки.
Файлы в основном дереве не создавать — передать Агенту 1 текстом или патчем.
Готовый проверенный патч — в Разделе F.

### Повторный прогон A (17:52–17:55, HEAD `b9b34c5` + 31 незакоммиченный файл)

Прогнано после правок чек-листа по четырём поправкам координатора. Регрессии нет,
все значения совпадают с базовым замером A:

| Гейт | 17:14–17:15 | 17:52–17:55 |
|---|---|---|
| A1 `go vet ./...` | exit 0 | exit 0, вывод пустой |
| A2 `go test ./...` | `ok internal/delivery/http` | `ok internal/delivery/http 0.963s`; `no test files` у остальных семи пакетов |
| A3 `tsc --noEmit` | exit 0 | exit 0 |
| A4 `eslint src` | 0 ошибок, 12 предупреждений | `12 problems (0 errors, 12 warnings)` — тот же набор `no-img-element` |
| A5 `vitest run` | 59/59 в 3 файлах | 59/59 в 3 файлах (`filters` 24, `api-server` 11, `moderation` 24) |
| A6 `next build` | не запускался | не запускался — правило 3 |

`:8081` при этом не перезапускался: все канонические замеры этого прогона
(`districts`, форма детали) — только `GET`.

### Третий прогон A (19:12–19:19, HEAD `03d854e`)

Прогнан после четырёх коммитов Агента 1 (`ea2eb99`, `796a00b`, `7518f10`,
`03d854e`, легли в 19:03–19:07). Регрессии по веб-гейтам нет, по Go изменился
состав пакетов с тестами.

| Гейт | Факт 19:12–19:19 |
|---|---|
| A1 `go vet ./...` | exit 0, вывод пустой — три прогона подряд |
| A2 `go test -count=1 ./...` | `ok talento/internal/auth 1.473–1.529s`, `ok talento/internal/delivery/http 0.426–0.523s`; `no test files` у `talentro`, `cmd/app`, `handlers`, `models`, `repository`, `config`. Три прогона (19:12:44, 19:12:52, 19:12:58) — все exit 0 |
| A3 `tsc --noEmit` | exit 0, 19:15 |
| A4 `eslint src` | `12 problems (0 errors, 12 warnings)` — тот же набор `no-img-element` |
| A5 `vitest run` | 59/59 в 3 файлах (`filters` 24, `api-server` 11, `moderation` 24), старт 19:15:11 |
| A6 `next build` | **не запускался** — правило 3 и решение координатора 18:00 |

**Изменение относительно базового замера A:** `internal/auth` больше не
`no test files` — туда лёг файл из Раздела F (коммит `7518f10`). Требование §7 о
табличных тестах подписи и проверки куки закрыто по составу; качество проверено
мутациями в подразделе о flaky ниже.

**Отклонение от собственной методики, зафиксировано честно.** A3 прогнан как
`npx tsc --noEmit`, без предписанного `--incremental false`. Проверено: общий
`web/tsconfig.tsbuildinfo` не перезаписан — mtime остался `17:02:20`, файл в
`web/.gitignore:40`. Конфликта с Агентом 1 не возникло, но следующий прогон
делать строго с `--incremental false`.

### Дефект гейта Go: чекпоинт `b9b34c5` не собирался (закрыт)

**Статус: закрыт.** Ответственный — Агент 1 (задача #10). Это дефект чекпоинта,
а не канона: сломанная ревизия существовала между коммитами и уже исправлена.

На `b9b34c5` в `route.go` был объявлен параметр, типа которого в той же ревизии
не существовало, а `main.go` вызывал эту функцию с числом аргументов на один
меньше:

| Файл на `b9b34c5` | Строка | Факт |
|---|---|---|
| `internal/delivery/http/route.go` | 13 | `authHandler *handlers.AuthHandler` — четвёртый параметр `RegisterRoutes` (`:9-14`) |
| `internal/delivery/http/handlers/auth.go` | — | **отсутствует** на этой ревизии, тип `AuthHandler` не определён |
| `internal/models/auth.go`, `internal/repository/users.go`, `internal/auth/session.go` | — | **отсутствуют** на этой ревизии |
| `cmd/app/main.go` | 44 | `httpdelivery.RegisterRoutes(r, cardHandler, healthHandler)` — **3 аргумента при 4 параметрах** |

Проверка без worktree, как предписал координатор, — распаковкой ревизии в
gitignored каталог:

```bash
mkdir -p .audit-tmp/head-check
git archive b9b34c5 backend/Talentro | tar -x -C .audit-tmp/head-check
cd .audit-tmp/head-check/backend/Talentro && go build ./...
```

Факт (19:05):

```
# talentro/internal/delivery/http
internal\delivery\http\route.go:13:24: undefined: handlers.AuthHandler
код возврата: 1
```

Компилятор выдаёт только одну ошибку: пакет `cmd/app` зависит от
`internal/delivery/http`, поэтому его собственная ошибка про три аргумента не
доходит до вывода. Несовпадение арности подтверждается чтением обоих мест —
`main.go:44` против `route.go:9-14`.

**Текущий HEAD собирается чисто:** та же процедура для `796a00b` дала exit 0 и
пустой вывод, `go build ./...` в рабочем дереве на `03d854e` — exit 0. Для
приёмки из этого следует одно: **промежуточные чекпоинты нельзя считать точками
отката** — откат на `b9b34c5` даёт несобирающийся бэкенд.

### Дефект гейта Go: flaky-подтест подписи (открыт 19:05 → закрыт 19:13)

**Статус: закрыт, проверен.** Пункт гейта A2 «`go test ./...` не пройден до
фикса» открыт по сообщению координатора и закрыт после верификации фикса.

`go build ./...` и `go vet ./...` проходили, а `go test ./...` падал
недетерминированно в
`TestStoreDecodeRejectsMalformedToken/изменён_последний_байт_подписи`.

**Причина — в тестовом хелпере, а не в реализации.** `flipLastByte`
(`internal/auth/session_test.go:36-45`) меняет последний **символ строки**
подписи на `'A'`, а если он уже `'A'` — на `'B'`. Прежняя реализация
(`session.go` до `03d854e`) декодировала обе подписи и сверяла **байты** через
`subtle.ConstantTimeCompare`. `base64.RawURLEncoding` отбрасывает неканонические
хвостовые биты: 32 байта HMAC дают 43 символа, где последний несёт только
4 значимых бита, поэтому его индекс всегда кратен четырём и принадлежит алфавиту
`AEIMQUYcgkosw048`. При последнем символе `'A'` (индекс 0) замена на `'B'`
(индекс 1) меняет только отбрасываемые биты — декодированные байты оставались
прежними, подпись признавалась верной, и подтест падал.

Доля отказа — ровно 1/16. Подтверждено перечислением 20 000 различных подписей в
изолированном модуле `.audit-tmp/authtest` (байт-в-байт копии `session.go` и
`session_test.go` из дерева, probe-файл `flaky_probe_test.go`):

```
всего=20000  последний_символ_A=1221  прежняя_побайтовая_сверка_приняла_бы=1221  вне_алфавита=0
```

`1221/20000 = 6,1 %` при ожидаемых `1/16 = 6,25 %` — расхождение 0,85σ, обычный
биномиальный шум. Совпадение числа «последний символ `'A'`» и числа «прежняя
сверка приняла бы подмену» (1221 и 1221) подтверждает механизм целиком.

Внутри одного процесса падение **не** воспроизводится: `validClaims` берёт `Exp`
из `s.now()`, поэтому за 1,4 с прогона все итерации получают одну и ту же
подпись. `-count=256` дал 0 падений — flaky привязан к секунде запуска, а не к
итерации, и потому особенно опасен в CI.

**Как исправлено (коммит `03d854e`).** Агент 1 починил не тест, а реализацию:
сверка подписей идёт в той кодировке, в которой они пришли —
`hmac.Equal([]byte(signature), []byte(want))` вместо декодирования и
`subtle.ConstantTimeCompare` (`session.go:78`). `flipLastByte` остался прежним.

Оценка приёмки: вариант допустимый и **строго более сильный**, чем правка теста.
Побочный эффект — устранена податливость подписи: неканонический base64-вариант
действительной подписи больше не принимается. Легитимные куки не страдают,
поскольку `Encode` всегда выдаёт каноническую кодировку. `hmac.Equal` константна
по времени, а длина подписи секретом не является. Декодирование входящей подписи
удалено целиком — валидность base64 проверять не нужно: невалидная строка просто
не совпадёт с `want`.

Коммитом `7518f10` в `Encode` добавлен запрет `c.Exp <= s.now().Unix()`
(`session.go:50`). Мой тест `TestStoreDecodeRejectsExpired` из-за этого
переориентирован на проверку `Encode`, а покрытие «`Decode` отвергает
просроченную куку» восстановлено новым `TestStoreDecodeRejectsTokenPastItsLife`
(выпуск в `T`, срок `T+1ч`, проверка в `T+2ч`). **Ни одна проверка не ослаблена.**

**Верификация фикса:**

| Проверка | Результат |
|---|---|
| `go build`, `go vet`, `go test -count=1 ./...` ×3 (19:12:44, 19:12:52, 19:12:58) | все exit 0, `ok internal/auth`, `ok internal/delivery/http` |
| Подтест 12 отдельными процессами на разных секундах (19:13–19:15) | **0 падений из 12** |
| Перечисление 20 000 подписей, подменённая подпись отвергнута | **20 000 из 20 000**, ни одного приёма |
| Полный изолированный набор (11 тестов, 24 подтеста + 2 probe-теста) | все PASS |

**Мутационная проверка новой реализации** — тесты по-прежнему ловят поломку, а не
просто зелёные. Мутации вносились в копию `.audit-tmp/authtest/session.go`;
после каждой копия восстановлена и сверена `diff -q` с деревом:

| Мутация | Кем убита |
|---|---|
| `if false && !hmac.Equal(...)` (строка 78 — сверка подписи отключена) | `TestStoreDecodeRejectsForeignSecret`, `TestStoreDecodeRejectsMalformedToken/подпись_не_base64`, `.../изменён_последний_байт_подписи`, `TestStoreDecodeRejectsCrossTokenSignature`, `TestFlakyProbeFlippedSignatureAlwaysRejected` |
| `if false && c.Exp <= s.now().Unix()` (строка 50 — запрет в `Encode`) | `TestStoreDecodeRejectsExpired`, все 4 подтеста |
| `if false && c.Exp <= s.now().Unix()` (строка 90 — проверка срока в `Decode`) | `TestStoreDecodeRejectsTokenPastItsLife` |

Все три мутации компилируются и падают ровно тем набором тестов, который
ожидается. Probe-файл остаётся в `.audit-tmp/authtest/` и в основное дерево не
переносится: он диагностический, а не приёмочный.

---

## Раздел B. Приёмка по §7 спеки, пункты 1–8

### B1. Идемпотентность `database/init.sql` (§7 п.1)

**Требование:** скрипт запускается поверх живой БД без ошибок, повторный прогон
тоже без ошибок.

**Порядок согласован координатором 18:00 и отличается от первоначального:**

1. **Не на БД Агента 1.** Создаётся отдельная база на `:55432`, например
   `talentro_accept`. Базы `talentro` и `main_db` не трогать.
2. **Ничего не дропать.** Ни `DROP DATABASE`, ни `DROP TABLE`, ни `TRUNCATE`.
   Если `talentro_accept` уже существует — прогонять поверх неё, это и есть
   проверка идемпотентности.
3. **Только после чекпоинта Агента 2.** Проверяется **канонический**
   `database/init.sql`. Тот файл, который лежит в дереве сейчас (с `cards`,
   `age_from/age_to`, `card_locations`), — сид ветки №15; его идемпотентность
   **не проверяется**, он будет заменён каноном.
4. Имя базы выяснять непосредственно перед прогоном (правило 7): окружение
   пересобирается на ходу.

```bash
PSQL="/c/Program Files/PostgreSQL/18/bin/psql.exe"; export PGCONNECT_TIMEOUT=5

# 1) что уже есть на кластере — убедиться, что talentro/main_db не будут задеты
"$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d postgres -Atc \
  "SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY 1;"

# 2) создать отдельную приёмочную базу (если её ещё нет)
"$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d postgres -c \
  "SELECT 1 FROM pg_database WHERE datname='talentro_accept'" | grep -q 1 \
  || "$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d postgres -c "CREATE DATABASE talentro_accept"

# 3) два прогона канонического сида
DB=talentro_accept
"$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d "$DB" -v ON_ERROR_STOP=1 -f database/init.sql
"$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d "$DB" -v ON_ERROR_STOP=1 -f database/init.sql
```

**Ожидание:** оба прогона exit 0, ни одного `ERROR`. `-v ON_ERROR_STOP=1`
обязателен: без него `psql` печатает ошибку и продолжает, а exit-код остаётся 0.

**Проверка идемпотентности данных.** Состав таблиц канона отличается от №15
(`groups`/`locations`/`districts` вместо `card_locations`), поэтому счётчики
снимаются по фактическому списку таблиц, а не по зашитым именам:

```bash
"$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d "$DB" -Atc \
  "SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY 1;" |
while read -r t; do
  printf "  %-22s %s\n" "$t" \
    "$("$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d "$DB" -Atc "SELECT count(*) FROM $t;")"
done
```

Снять дважды — после первого и после второго прогона. **Ожидание:** наборы чисел
совпадают построчно; ни один счётчик не удвоился.

**Целевые слаги после прогона** (решение координатора 18:00): организация id 1 —
`studiya-palitra`, занятие id 1 — `tiraspol-studiya-palitra`. Значение
`dom-tvorchestva-palitra` из `database/init.sql:238` — легаси ветки №15, оно
умирает вместе с её сидом, и в каноническом `init.sql` его нет.

```bash
"$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d "$DB" -Atc \
  "SELECT 'org', slug FROM organizations WHERE id=1
   UNION ALL SELECT 'activity', slug FROM activities WHERE id=1;"
```

### B2. `GET /api/cards` — полнота полей (§7 п.2)

```bash
curl -s "http://localhost:8080/api/cards" -o .audit-tmp/acc-cards.json
node -e "
const d=JSON.parse(require('fs').readFileSync('.audit-tmp/acc-cards.json','utf8'));
console.log('карт:', d.length);
const need=['price','category','district','org_id'];
// price===0 — это «бесплатно» (§10.3), а не пустое значение: в список missing не берём.
for (const c of d) {
  const missing=need.filter(k=>c[k]===null||c[k]===undefined);
  console.log('  id='+c.id, c.name.slice(0,28).padEnd(28), missing.length?'ПУСТО: '+missing.join(','):'ok');
}"
```

**Ожидание по спеке:** 6 анкет, у каждой заполнены `price`, `category`, `district`, `org_id`.

**Правило цены (решение координатора 18:00, §10.3 ТЗ):** `price = 0` означает
**«бесплатно»**, `price = null` — **«не указана»**. Значит `0` — полноценное
значение, а не дыра в данных, и **дефектом БД это не пишется**. Проверять нужно
маппинг в UI, а не базу — см. C6.

Прежняя формулировка этого пункта («нулевая цена неотличима от не указана,
фронтенд покажет 0 ₽») **отозвана**: `formatPrice` в `web/src/lib/filters.ts:448-456`
уже возвращает «Бесплатно» при `priceFrom === 0`, поэтому «0 ₽» на экране не
появляется. Что действительно стоит проверить — в C6.

Замер для протокола:

```bash
node -e "
const d=JSON.parse(require('fs').readFileSync('.audit-tmp/acc-cards.json','utf8'));
console.log('price===0 («бесплатно», §10.3):', d.filter(c=>c.price===0).map(c=>c.id).join(',')||'нет');
console.log('price===null («не указана»)   :', d.filter(c=>c.price===null).map(c=>c.id).join(',')||'нет');
console.log('district===null               :', d.filter(c=>c.district===null).map(c=>c.id).join(',')||'нет');"
```

### B3. `GET /api/cards/{id}` — карточка целиком (§7 п.3)

```bash
curl -s "http://localhost:8080/api/cards/1" -o .audit-tmp/acc-card1.json
node -e "
const c=JSON.parse(require('fs').readFileSync('.audit-tmp/acc-card1.json','utf8'));
console.log('id:',c.id,'| name:',c.name);
console.log('locations:',Array.isArray(c.locations)?c.locations.length:'НЕТ ПОЛЯ');
console.log('organization:',c.organization?JSON.stringify(c.organization):'НЕТ/null');
for (const l of (c.locations??[])) console.log('   точка',l.id,l.name,'lat='+l.lat,'lng='+l.lng);"
```

**Ожидание:** `200`, `locations[]` непустой с координатами, `organization` с `slug`.

**Координаты должны попадать в рамку Приднестровья** `45.9–48.9 / 27.4–30.6`
(её же проверяет `validateCoordinates()` в `web/src/components/moderation/QuickEditForm.tsx`):

```bash
node -e "
const c=JSON.parse(require('fs').readFileSync('.audit-tmp/acc-card1.json','utf8'));
for (const l of (c.locations??[])) {
  const ok=l.lat>=45.9&&l.lat<=48.9&&l.lng>=27.4&&l.lng<=30.6;
  console.log((ok?'ok  ':'ВНЕ ')+' '+l.name+' '+l.lat+'/'+l.lng);}"
```

### B4. 404 на неопубликованное и несуществующее (§7 п.4)

```bash
for id in 7 8 999 abc; do
  printf "  /api/cards/%-5s " "$id"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:8080/api/cards/$id"
done
```

**Ожидание:** `7` (`on_moderation`) → 404, `8` (`rejected`) → 404, `999` → 404,
`abc` → 400 («некорректный идентификатор», `handlers/search.go:61-65`).

### B5. Аноним не получает моки (§7 п.5) — главный критерий §6

```bash
node .audit-tmp/acceptance-clean.mjs http://localhost:3010
```

Скрипт считает **вхождения** маркеров (не строки: HTML минифицирован, `grep -c`
всегда даёт 1) и разделяет ответ на `visible` (HTML без `<script>`) и `flight`
(payload `self.__next_f.push` — пропсы серверных компонентов).

**Ожидание:** `Итого вхождений маркеров: 0`.

Маркеры и их адреса — в `.audit-tmp/acceptance-clean.mjs` (константа `MARKERS`).
Особое внимание: `visible=0` при `flight>0` — это утечка в RSC-поток без
отрисовки, ровно тот случай, который §6 называет «если мок просто не отрисовать,
он всё равно сериализуется в RSC-поток». Такой маршрут **не проходит** приёмку,
хотя визуально страница чистая.

**Условие действительности проверки:** прод-сборка должна быть собрана с
`NEXT_PUBLIC_API_URL`, указывающим на канон (`:8081`). Без этой переменной
`web/src/app/page.tsx:34` (`isApiEnabled()`) уходит в mock-режим, и замер
показывает не нарушение §6, а штатную работу моков. Перед B5 убедиться:

```bash
curl -s http://localhost:3010/ -o .audit-tmp/acc-root.html
grep -o "Выбор редакции" .audit-tmp/acc-root.html | head -1   # есть => сборка в mock-режиме
```

**Маршрутная часть §7 п.5 — приёмочные цели (решение координатора 18:00).**
Проверяются канонические слаги; моковые цели не являются, и после §6 аноним
должен получать на них `404`:

```bash
B=http://localhost:3011   # каноническая прод-сборка (C4), не :3010 Агента 1
for p in "/activities/tiraspol-studiya-palitra" "/activities/dubossary-shakhmaty" \
         "/activities/hudozhestvennaya-studiya-palitra" "/activities/futbolnaya-sekciya-chempion" \
         "/organizations/studiya-palitra"; do
  printf "  %-46s " "$p"; curl -s -o /dev/null -w "HTTP %{http_code}\n" -m 10 "$B$p"; done
```

| Маршрут | Ожидание после §6 |
|---|---|
| `/activities/tiraspol-studiya-palitra` | `200` — канонический слаг, приёмочная цель |
| `/activities/dubossary-shakhmaty` | `200` — канонический слаг |
| `/activities/hudozhestvennaya-studiya-palitra` | `404` — моковый слаг, моков у анонима больше нет |
| `/activities/futbolnaya-sekciya-chempion` | `404` — моковый слаг |
| `/organizations/studiya-palitra` | **заблокировано** — на каноне нет `/api/v1/organizations/{slug}` (`404`, замер 18:00), `?org=` игнорируется и возвращает все 8. Эндпоинт назначен Агенту 2; до его появления это блок, а не провал |

`404` на моковых слагах — **ожидаемый результат**, а не регрессия. `dom-tvorchestva-palitra`
из `database/init.sql:238` — легаси ветки №15, приёмочной целью не является.

### B6. Тестер получает моки (§7 п.6)

**Заблокировано:** `POST /api/auth/tester` отсутствует на обоих бэкендах
(`:8080` и `:8081` → `404`), `GET /api/auth/me` тоже `404`. Куку получить нечем.

Как пойдёт — получить куку и прогнать тот же скрипт с ней:

```bash
COOKIE=$(curl -s -i -X POST "http://localhost:8081/api/auth/tester" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TESTER_TOKEN\"}" \
  | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
echo "кука: ${COOKIE:-ПУСТО}"
node .audit-tmp/acceptance-clean.mjs http://localhost:3011 "$COOKIE"
```

**Ожидание:** `Set-Cookie: talento_session=...` с атрибутами `HttpOnly`,
`SameSite=Lax`, `Path=/`, `Max-Age=2592000` (§5). Маркеры присутствуют —
для тестера ненулевые числа являются нормой.

Дополнительно по §5:

```bash
# просроченная/битая подпись => authenticated:false, а не 500
curl -s -H "Cookie: talento_session=$(echo -n '{"tester":true}' | base64 -w0).AAAA" \
  "http://localhost:8081/api/auth/me"
```

**Ожидание:** `200 {"authenticated":false,...}`.

### B7. Карта соответствует `card_locations` (§7 п.7)

Число маркеров на `/map` должно равняться числу точек опубликованных анкет:

```bash
"$PSQL" -w -h 127.0.0.1 -p 55432 -U user7 -d "$DB" -Atc \
  "SELECT count(*) FROM card_locations cl JOIN cards c ON c.id=cl.card_id WHERE c.status='published';"
```

Сравнить с числом маркеров в ответе `/map` (в `flight`-payload):

```bash
curl -s http://localhost:3010/map -o .audit-tmp/acc-map.html
grep -o "leaflet-marker-icon\|mapPin" .audit-tmp/acc-map.html | wc -l
```

**Ожидание:** числа совпадают; видимая область карты не сбрасывается при смене
фильтра (проверяется в браузере — `web/COORDINATION.md`, раздел «Правки другого
инструмента», описывает дефект remount и паттерн `syncedKey`/`filtersKey` в
`MapClient.tsx:89`).

### B8. Статические гейты (§7 п.8)

Раздел A целиком. Все шесть строк, с отметкой времени.

---

## Раздел C. Совместимость с каноном

Канон — модель §7 ТЗ: `groups` / `locations` / `districts`, `/api/v1/activities`.
Схема ветки №15 (`cards.age_from/age_to` + `card_locations`) каноном **не является**.
Ветка №15 — источник `web/` и auth-среза.

### Поправки координатора от 17:47 (обязательны к чтению перед разделами C1 и C2)

1. **Отозвана прежняя формулировка C1.** Плоско-карточные `age` и `price` в
   каноническом списке — **канонические поля**, агрегат по группам. Их наличие и
   их чтение сами по себе **не нарушение**. Правило звучит иначе: на странице
   детали возраст и цена берутся из `groups[]` (`age_from`/`age_to`/
   `price_from`/`price_to`), и `web` не должен выдумывать поля, которых сервер не
   отдаёт. В сообщении Агенту 1 от 17:44 это было подано как «карточные
   `age`/`price` теряют группы» и названо нарушением канона — **та формулировка
   недействительна**. Действительная находка у́же и другая: см. таблицу по строкам
   `cardToActivity` в C1.
2. **Три legacy-алиаса — не дефект канона.** `/api/cards/{id}`, `/api/categories`,
   `/api/cities` → `404`; работа назначена **Агенту 2**. Фиксируются в C2 как
   **ожидающие**, действий от Агента 1 не требуют.
3. **`/api/v1/districts` без `city` → `400` by design** (§5.4 ТЗ), а не ошибка.
   Проверять с `city=tiraspol` — см. C5.
4. **`:8081` — стенд Агента 2**, не перезапускать. Все замеры этого раздела —
   только `GET`.

Форма детали, подтверждённая координатором и переснятая в 17:48: плоские поля +
`organization`, `locations[]`, `groups[]`, `photos[]`, `videos[]`. Ключи — в
таблице ниже.

### Фактический канонический контракт (замер 17:19, `:8081`)

| Путь | Статус | Форма ответа |
|---|---|---|
| `GET /health` | 200 | `{"status","database","version"}` |
| `GET /api/v1/activities` | 200 | `{items[], total, page, limit}` |
| `GET /api/v1/activities/{slug\|id}` | 200 | объект, 43 поля, вложенные `groups[]`, `locations[]`, `photos[]`, `videos[]`, `organization` |
| `GET /api/v1/categories` | 200 | дерево `[{id,slug,name,kind,icon,order_num,children[]}]` |
| `GET /api/v1/cities` | 200 | `[{id,slug,name}]` |
| `GET /api/v1/districts` | 400 без `city` | **так и задумано** (§5.4 ТЗ): `{error:{code,message,fields}}` — модель ошибок §9.3 ТЗ. Не дефект |
| `GET /api/v1/districts?city=tiraspol` | 200 | `[{id,slug,name,city_id}]`, 4 района Тирасполя |
| `GET /api/cards` (legacy) | 200 | тот же плоский ряд, что и `/api/v1/activities.items` |
| `GET /api/cards/{id}` (legacy) | **404** | ожидает реализации, назначено Агенту 2 — не дефект канона |
| `GET /api/categories` (legacy) | **404** | ожидает реализации, назначено Агенту 2 — не дефект канона |
| `GET /api/cities` (legacy) | **404** | ожидает реализации, назначено Агенту 2 — не дефект канона |
| `GET /api/v1/organizations/{slug}` | **404** | ожидает реализации, назначено Агенту 2 (замер 18:00). Должен вернуть `organization` + `activities[]` только с `published` |
| `GET /api/organizations/{slug}` (legacy) | **404** | то же, legacy-вариант (замер 18:00) |
| `GET /api/v1/activities?org=…` | 200, но **фильтр игнорируется** | `?org=studiya-palitra` и `?org_slug=studiya-palitra` возвращают `total=8` — весь список (замер 18:00) |
| `GET /api/auth/me` | **404** | auth-срез на канон не перенесён (C3) |

Плоская строка списка (39 полей): `id, slug, name, kind, org_id, city, age, link,
description, district, price, category, org_slug, org_name, org_type, phone,
address, lat, lng, location_id, location_name, group_id, group_name, price_to,
price_period, seats, category_id, category_slug, super_category,
super_category_slug, format, lesson_type, status, verified, photo, groups_count,
locations_count, updated_at`.

Плоские `age` и `price` в этой строке — **канонические поля**, агрегат по группам.
Их наличие не нарушение.

Форма детали `GET /api/v1/activities/{slug|id}` — те же плоские поля плюс пять
вложенных блоков (замер 17:48, анкета id 1):

| Блок | Ключи |
|---|---|
| `organization` | `id, slug, name, type, description, phone, email, site, address, city, contacts_verified_at` |
| `locations[]` | `id, name, city, district, address, lat, lng, phone, contacts_verified_at, groups_count, photos` |
| `groups[]` | `id, name, age_from, age_to, price_from, price_to, price_period, location_id, seats, schedules` |
| `photos[]` | `path, caption, source_url, author, order_num` |
| `videos[]` | массив; у анкеты id 1 пуст |

Плоские `age={min:5,max:7}`, `price=300`, `price_to=null`, `price_period=month`
в детали — значения первой группы. В `groups[]` той же анкеты:

```
group 1 «5–7 лет»   age 5-7    price 300-null  month  location_id 1  seats 8   schedules 1
group 2 «8–12 лет»  age 8-12   price 350-400   month  location_id 1  seats 10  schedules 2
```

Проверка формы:

```bash
curl -s "http://localhost:8081/api/v1/activities/1" -o .audit-tmp/canon-detail.json
node -e "
const a=JSON.parse(require('fs').readFileSync('.audit-tmp/canon-detail.json','utf8'));const d=a.activity||a;
const show=(n,v)=>console.log(n+':',Array.isArray(v)?(v.length?Object.keys(v[0]).join(','):'(пусто)'):(v&&typeof v==='object'?Object.keys(v).join(','):JSON.stringify(v)));
for(const k of ['organization','locations','groups','photos','videos']) show(k,d[k]);"
```

### C1. `web` не выдумывает поля и берёт возраст/цену из `groups[]` в детали

**Требование (уточнено координатором 17:47):** плоско-карточные `age` и `price`
в каноне **есть** — это агрегат по группам, их чтение само по себе не нарушение.
Нарушения два: (а) на странице детали возраст и цена должны браться из
`groups[]` (`age_from`/`age_to`/`price_from`/`price_to`), а не из плоского
агрегата; (б) `web` не должен выдумывать поля, которых сервер не отдаёт.

**Замер 17:48, `GET :8081/api/v1/activities/1`:** канон отдаёт `org_slug`,
`super_category_slug`, `photo`, `lat`, `lng`, `address`, `district`, `price_to`,
`price_period`, `groups_count`, `locations_count` и вложенные `groups[]`,
`locations[]`, `photos[]`, `organization`. `web` из этого не берёт ничего.

`web/src/lib/api-server.ts:14-35` (`cardToActivity`):

| Строка | Что делает | Факт канона |
|---|---|---|
| `:18` | `slug: card.id` — подставляет числовой id | канон отдаёт настоящий `slug` (`tiraspol-studiya-palitra`); id подставляется потому, что в схеме №15 колонки `slug` у `cards` нет (`init.sql:266-267`) |
| `:20` | `organizationSlug: ""` | канон отдаёт `org_slug` = `studiya-palitra` |
| `:22` | `superSlug: "other"` — выдуманное значение | канон отдаёт `super_category_slug` |
| `:25` | `photos: []` | канон отдаёт `photo` в списке и `photos[]` в детали |
| `:32` | `locations: []` | канон отдаёт `lat`, `lng`, `address`, `district`, `locations_count` и `locations[]` в детали |
| `:33` | `groups: []` | канон отдаёт `groups[]` в детали — именно отсюда берутся возраст и цена |

**Последствие для детали:** у анкеты id 1 группа 2 — `8–12 лет`, `350–400`,
10 мест, два расписания. При `groups: []` страница занятия не может показать ни
её, ни цену из `groups[]`, поэтому требование (а) не выполнено: возраст и цена
фактически берутся из плоского агрегата, то есть только по первой группе.
`5 из 8` анкет канона имеют `groups_count > 1`: `10(2)`, `4(2)`, `3(2)`, `2(3)`,
`1(2)` — значит потеря не единична.

Комментарий `api-server.ts:8-12` объясняет пустые массивы тем, что
`repository.SearchCards` этих полей не возвращает. Для бэкенда №15 (`:8080`) это
верно, для канона (`:8081`) — уже нет: канонический плоский ряд содержит
`org_slug`, `super_category_slug`, `photo`, `lat`, `lng`, `address`, `district`.

**Как проверять:**

```bash
grep -rn "\.age\b\|\.price\b" web/src/lib/api.ts web/src/lib/api-server.ts
sed -n '14,35p' web/src/lib/api-server.ts
curl -s "http://localhost:8081/api/v1/activities" -o .audit-tmp/acc-v1.json
node -e "
const d=JSON.parse(require('fs').readFileSync('.audit-tmp/acc-v1.json','utf8')).items;
const multi=d.filter(x=>x.groups_count>1);
console.log('строк с groups_count>1:', multi.length, 'из', d.length);
for (const x of multi) console.log('  id='+x.id, 'slug='+x.slug, 'org_slug='+x.org_slug, 'age='+JSON.stringify(x.age), 'price='+x.price, 'groups='+x.groups_count);"
```

**Ожидание:** `cardToActivity` заполняет `slug`, `organizationSlug`, `superSlug`,
`photos` и `locations` из полей, которые канон действительно отдаёт; на странице
занятия возраст и цена читаются из `groups[]`. Ни одно поле не выдумывается:
если сервер его не вернул, его нет в модели, а не заполнено заглушкой.

### C2. Legacy-алиасы работают и отдают данные канона

**Требование:** `/api/cards`, `/api/cards/{id}`, `/api/categories`, `/api/cities`
отвечают и содержат канонические данные.

```bash
for p in "/api/cards" "/api/cards/10" "/api/categories" "/api/cities"; do
  printf "  %-20s " "$p"
  curl -s -o .audit-tmp/acc-alias.json -w "HTTP %{http_code} " "http://localhost:8081$p"
  node -e "
  const fs=require('fs');const t=fs.readFileSync('.audit-tmp/acc-alias.json','utf8');
  try{const d=JSON.parse(t);console.log(Array.isArray(d)?('массив '+d.length):(d.items?'items '+d.items.length:Object.keys(d).slice(0,6).join(',')))}
  catch{console.log(t.slice(0,60))}"
done
```

**Ожидание:** четыре раза `200` с непустыми данными.

**Текущий факт (замер 17:36, перепроверен 17:48):** `200` только у `/api/cards`;
`/api/cards/10`, `/api/categories`, `/api/cities` → `404 page not found`.
**Это не дефект канона:** три отсутствующих алиаса уже назначены Агенту 2,
фиксируются здесь как **ожидающие** и в приёмке считаются незакрытым пунктом
совместимости, а не ошибкой. Возвращаться к ним после того, как Агент 2 их
поднимет, — тем же циклом команд.

Для сравнения: на бэкенде ветки №15 (`:8080`) все четыре алиаса работают
(`200`), а `/api/v1/activities` — `404`. То есть ни один из двух серверов пока не
удовлетворяет требованию полностью.

Дополнительно: формы ответов должны совпадать между алиасом и каноном —

```bash
curl -s "http://localhost:8081/api/cards" -o .audit-tmp/acc-legacy.json
curl -s "http://localhost:8081/api/v1/activities" -o .audit-tmp/acc-v1.json
node -e "
const fs=require('fs');
const l=JSON.parse(fs.readFileSync('.audit-tmp/acc-legacy.json','utf8'));
const v=JSON.parse(fs.readFileSync('.audit-tmp/acc-v1.json','utf8')).items;
const a=Object.keys(l[0]).sort().join(','), b=Object.keys(v[0]).sort().join(',');
console.log('формы идентичны:', a===b);
if(a!==b){console.log(' только в legacy:', Object.keys(l[0]).filter(k=>!(k in v[0])).join(',')||'—');
          console.log(' только в v1    :', Object.keys(v[0]).filter(k=>!(k in l[0])).join(',')||'—');}"
```

### C3. Auth-срез после переноса на канон ведёт себя по §4/§5

Проверять на каноническом стенде (`:8081`). **Сейчас заблокировано**: на `:8081`
нет ни одного auth-маршрута (`/api/auth/me` → `404`), на `:8080`
зарегистрирован только `POST /api/auth/google` (`route.go`), а `tester`, `me`,
`logout` отсутствуют.

Когда появится — прогнать:

```bash
BASE=http://localhost:8081
# 1) аноним: /me это состояние, а не ошибка (§4)
printf "  me без куки      "; curl -s -o .audit-tmp/a.json -w "HTTP %{http_code} " "$BASE/api/auth/me"; cat .audit-tmp/a.json; echo
# 2) тестер с верным токеном
printf "  tester верный    "; curl -s -i -X POST "$BASE/api/auth/tester" -H 'Content-Type: application/json' -d "{\"token\":\"$TESTER_TOKEN\"}" | grep -iE '^HTTP|^set-cookie' | tr -d '\r'; echo
# 3) тестер с неверным токеном
printf "  tester неверный  "; curl -s -o .audit-tmp/a.json -w "HTTP %{http_code} " -X POST "$BASE/api/auth/tester" -H 'Content-Type: application/json' -d '{"token":"неверный"}'; cat .audit-tmp/a.json; echo
# 4) logout снимает куку
printf "  logout           "; curl -s -i -X POST "$BASE/api/auth/logout" | grep -i '^set-cookie' | tr -d '\r'; echo
# 5) google без GOOGLE_CLIENT_ID => 503, а не «пропускаем» (§4)
printf "  google без aud   "; curl -s -o .audit-tmp/a.json -w "HTTP %{http_code} " -X POST "$BASE/api/auth/google" -H 'Content-Type: application/json' -d '{"credential":"x"}'; cat .audit-tmp/a.json; echo
# 6) CORS с куками: точный Origin, не звёздочка (§4)
printf "  CORS свой origin "; curl -s -i -H "Origin: http://localhost:3011" "$BASE/api/cards" | grep -iE 'access-control-allow-(origin|credentials)|^vary' | tr -d '\r'; echo
printf "  CORS чужой origin"; curl -s -o /dev/null -w "HTTP %{http_code}\n" -X OPTIONS -H "Origin: http://evil.example" -H "Access-Control-Request-Method: POST" "$BASE/api/auth/tester"
```

**Ожидание по §4/§5:**

| Проверка | Ожидание |
|---|---|
| 1 | `200` + `{"authenticated":false,...}` — не 401 и не 500 |
| 2 | `200` + `Set-Cookie: talento_session=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`; `Secure` при `X-Forwarded-Proto: https` |
| 3 | `401`/`403`, кука не выдаётся |
| 4 | `Max-Age=-1` или `Expires` в прошлом |
| 5 | `503` при незаполненном `GOOGLE_CLIENT_ID` |
| 6 | `Access-Control-Allow-Origin` равен переданному Origin (не `*`), `Allow-Credentials: true`, `Vary: Origin`; чужой Origin → `403` на preflight |

Проверка 6 для своего Origin ожидает `Access-Control-Allow-Origin:
http://localhost:3011` только если этот Origin есть в `ALLOWED_ORIGINS`; иначе
корректный ответ — отсутствие заголовка. Сверить со значением переменной.

Реализация CORS уже есть и покрыта тестом: `backend/Talentro/internal/delivery/http/cors.go`,
`cors_test.go`; подключён в `cmd/app/main.go:44` первым промежуточным слоем.

### C4. Приёмка чистоты (§6/§7) на каноническом стенде

Чистота проверяется на прод-сборке, поднятой против канона:

```bash
# сборка и запуск на свободных портах (правила 2 и 3)
cd web
NEXT_PUBLIC_API_URL=http://localhost:8081 npx next build     # только по согласованию
NEXT_PUBLIC_API_URL=http://localhost:8081 npx next start -p 3011

cd ..
node .audit-tmp/acceptance-clean.mjs http://localhost:3011              # аноним: 0 вхождений
node .audit-tmp/acceptance-clean.mjs http://localhost:3011 "$COOKIE"    # тестер: моки есть
```

Дополнительно — данные на витрине должны быть из канона, а не из моков.
Признак канона: анкета `slug=tiraspol-veselye-noty` («Детская музыкальная школа
«Весёлые ноты»», Тирасполь) и `dubossary-shakhmaty` («Шахматная гостиная»).
Признак моков: «Палитра», «Киберход», «Грация», «Лапки».

```bash
curl -s http://localhost:3011/ -o .audit-tmp/acc-c4.html
for m in "Весёлые ноты" "Шахматная гостиная" "Палитра" "Киберход"; do
  printf "  %-24s %s\n" "$m" "$(grep -o -F "$m" .audit-tmp/acc-c4.html | wc -l)"
done
```

**Ожидание:** первые два > 0, последние два = 0.

### C5. `/api/v1/districts` требует `city` (§5.4 ТЗ)

**Требование:** районы отдаются только в рамках города. Запрос без `city` →
`400` **by design** (§5.4), а не дефект канона. Проверять с `city=tiraspol`.

```bash
printf "  без city         "; curl -s -o /dev/null -w "HTTP %{http_code}\n" -m 5 "http://localhost:8081/api/v1/districts"
printf "  city=tiraspol    "; curl -s -o /dev/null -w "HTTP %{http_code}\n" -m 5 "http://localhost:8081/api/v1/districts?city=tiraspol"
curl -s -m 5 "http://localhost:8081/api/v1/districts?city=tiraspol" -o .audit-tmp/districts.json
node -e "const d=require('./.audit-tmp/districts.json');console.log('штук:',d.length,'| ключи:',Object.keys(d[0]).join(','));for(const x of d)console.log('  ',x.slug,x.name,'city_id='+x.city_id)"
```

**Ожидание:** `400`, затем `200` и непустой массив `[{id,slug,name,city_id}]`.

**Факт (замер 17:48):** `400` / `200`; 4 района Тирасполя, все с `city_id=1`:
`centr` «Центр», `balka` «Балка», `naselenka` «Населёнка», `tarnovka` «Тарновка».
Ключи ответа `id, slug, name, city_id` — совпадают с заявленной формой.

**Что из этого следует для `web`:** districts нельзя грузить одним запросом на
все города. Либо запрос на каждый выбранный город, либо район берётся из
`locations[].district`, который канон уже отдаёт в списке и в детали. Сейчас
`web` читает `districts` из моков (`web/src/lib/data.ts`) и передаёт их в
`CatalogClient` безусловно — см. Раздел D, утечка справочников.

### C6. Маппинг цены в UI: `0` — «бесплатно», `null` — «не указана» (§10.3 ТЗ)

**Требование (решение координатора 18:00):** `price = 0` означает «бесплатно»,
`price = null` — «не указана». Дефектом БД нулевая цена **не пишется**; проверять
нужно маппинг в UI.

**Что уже правильно.** `web/src/lib/filters.ts:448-456`:

```ts
export function formatPrice(group?: AgeGroup): string {
  if (!group) return "Цена не указана";
  if (group.priceFrom === 0) return "Бесплатно";
  ...
}
```

Ветка для `0` есть, поэтому «0 ₽» на экране не появляется. `formatPriceCard`
(`filters.ts:459-467`) повторяет правило, отличаясь только заглушкой
(«Цена по запросу») и отсутствием «ПМР».

**Проверка 1 — нулевая цена доходит до UI как «Бесплатно».** В каноне две анкеты
с нулевой ценой группы (замер 18:00, обход всех 8 деталей `:8081`):

```
dubossary-shakhmaty      group 11 «6–18 лет»   price_from = 0
tiraspol-futbol-detyam   group  3 «7–10 лет»   price_from = 0
```

```bash
node -e "
const d=require('./.audit-tmp/canon-list.json').items;
(async()=>{for(const a of d){const r=await fetch('http://localhost:8081/api/v1/activities/'+a.slug);
const x=await r.json();const det=x.activity||x;
for(const g of det.groups||[]) if(g.price_from===0||g.price_from===null)
  console.log(a.slug.padEnd(30),'group',String(g.id).padEnd(3),g.name.padEnd(10),'price_from='+g.price_from);}})()"
```

**Проверка 2 — плоский ноль не значит «всё бесплатно».** У `tiraspol-futbol-detyam`
плоский `price = 0`, но `price_from` по группам = `[0, 250, 300]`. Значит ноль
здесь — «есть бесплатная группа», а не «занятие бесплатное». Подпись «Бесплатно»
на карточке каталога была бы неверной: честный вариант — «от 250 руб.» или цена
по группам. Это вторая, независимая от C1 причина читать `groups[]`, а не плоский
агрегат.

Замер 18:06 по всем 8 анкетам: плоский `price` **всегда равен минимуму
`price_from` по группам** — `200/[200,250]`, `400/[400]`, `0/[0]`, `250/[250]`,
`150/[150,200]`, `450/[450,500]`, `0/[0,250,300]`, `300/[300,350]`. То есть
агрегат — это «от минимальной цены», и он корректен как агрегат. Единственная
анкета, где его нельзя показать как «Бесплатно», — `tiraspol-futbol-detyam`;
`dubossary-shakhmaty` при `0/[0]` действительно бесплатна целиком.

```bash
node -e "
const d=require('./.audit-tmp/canon-list.json').items;
(async()=>{for(const a of d){const r=await fetch('http://localhost:8081/api/v1/activities/'+a.slug);
const x=await r.json();const det=x.activity||x;const p=(det.groups||[]).map(g=>g.price_from);
console.log(a.slug.padEnd(30),'плоский price='+String(a.price).padEnd(5),'группы=['+p.join(',')+']',
 (a.price===0&&p.some(v=>v>0))?'  <-- плоский 0 при платных группах':'');}})()"
```

**Проверка 3 — `null` в модели не представим.** `web/src/lib/types.ts:88`:
`priceFrom: number` — обязательное и не-nullable. Ветки для `null` в
`formatPrice` нет: значение `null` провалится в `${group.priceFrom} руб. ПМР`.
Сегодня случай не срабатывает — во всех 8 канонических анкетах `price_from`
число (замер 18:00). Но §10.3 требует для `null` текста «не указана», поэтому
либо тип становится `priceFrom?: number` плюс ветка в `formatPrice`, либо маппер
канона не создаёт группу без цены. Проверять после того, как `cardToActivity`
начнёт читать `groups[]`.

**НАЙДЕНО: при пустых группах деталь показывает «Infinity–-Infinity руб. ПМР».**

`web/src/components/activity/ActivityDetail.tsx:216-217`:

```ts
const minPrice = Math.min(...activity.groups.map((group) => group.priceFrom));
const maxPrice = Math.max(...activity.groups.map((group) => group.priceFrom));
```

`Math.min()` без аргументов возвращает `Infinity`, `Math.max()` — `-Infinity`.
При `groups: []` (а именно это производит `api-server.ts:33`) `activeGroup` на
`:106-107` (`groups.find(...) ?? groups[0]`) становится `undefined`, поэтому
срабатывает запасная ветка на `:593`:

```
{activeGroup ? formatPrice(activeGroup) : `${minPrice}–${maxPrice} руб. ПМР`}
```

и пользователь видит буквально **«Infinity–-Infinity руб. ПМР»**. Проверено:

```bash
node -e "const g=[];console.log('min=',Math.min(...g),'max=',Math.max(...g));console.log(\`\${Math.min(...[])}–\${Math.max(...[])} руб. ПМР\`)"
grep -n "minPrice\|maxPrice\|activeGroup =" web/src/components/activity/ActivityDetail.tsx
```

Сегодня маршрут не поражён: `/activities/[slug]` обслуживается моками
(`getActivityBySlug`), где группы непустые. Дефект проявится в момент, когда §6
переведёт деталь на канон через `cardToActivity`. Вторая запасная ветка, `:737`
(`activeGroup ? formatPrice(activeGroup) : "Цена уточняется"``), безопасна.

**Ожидание:** `minPrice`/`maxPrice` считаются только по непустому массиву, а при
пустых группах используется текстовая заглушка, а не арифметика по `Infinity`.

**НАЙДЕНО: проверка «не Бесплатно» в тесте бессмысленна — литерал перекодирован.**

`web/src/lib/filters.test.ts:178`:

```ts
expect(out).not.toBe("Р‘РµСЃРїР»Р°С‚РЅРѕ");
```

Это не «Бесплатно», а 18 символов двойной перекодировки (UTF-8 байты слова
«Бесплатно», прочитанные как cp1251). Доказательство — чтение файла, а не консоль;
в той же функции на `:171` кириллица корректная (`"Цена не указана"`), значит
дело в самом файле:

```bash
node -e "
const src=require('fs').readFileSync('web/src/lib/filters.test.ts','utf8').split(/\r?\n/);
const lit=src[177].match(/not\.toBe\(\"([^\"]*)\"\)/)[1];
console.log('длина:',lit.length,'| равен «Бесплатно»:',lit==='Бесплатно');
console.log('кодпойнты:',[...lit].map(c=>'U+'+c.codePointAt(0).toString(16).toUpperCase()).join(' '));
const ok=src[170].match(/toBe\(\"([^\"]*)\"\)/)[1];
console.log('сверка :171 — корректная кириллица:',ok==='Цена не указана');"
```

Факт 18:04: длина 18, `=== 'Бесплатно'` → `false`, кодпойнты
`U+420 U+2018 U+420 U+B5 U+421 U+403 U+420 U+457 U+420 U+BB U+420 U+B0 U+421 U+201A U+420 U+405 U+420 U+455`;
строка `:171` при этом корректна.

Следствие: `not.toBe(<мусор>)` проходит всегда — в том числе если `formatPrice`
вернёт настоящее «Бесплатно». Тест не проверяет то, что заявляет. `vitest run`
поэтому зелёный (59/59) и не сигнализирует о проблеме. Правка: заменить литерал
на корректное `"Бесплатно"`, а лучше — на позитивное утверждение
`expect(formatPrice({priceFrom: 0, ...} as AgeGroup)).toBe("Бесплатно")`.

---

## Базовый замер B и C (17:24–17:30, HEAD `b9b34c5` + незакоммиченные правки)

Все команды разделов B и C прогнаны и работают. Результаты — точка отсчёта «до»,
а не вердикт: §6 не реализован, auth-среза на каноне нет.

| Проверка | Ожидание | Факт |
|---|---|---|
| B2 `/api/cards` (`:8080`) | 6 анкет, у всех заполнены `price`, `category`, `district`, `org_id` | 6 анкет; **id 6** — пусты `price` и `district`, **id 2** — пуст `price`. Остальные 4 ok |
| B2 `price` | `0` = «бесплатно», `null` = «не указана» (§10.3) | у id 6 `price` равен `0` — по §10.3 это **«бесплатно», полноценное значение, не дефект**. `formatPrice` (`filters.ts:448-456`) уже возвращает «Бесплатно» при `priceFrom === 0`, поэтому «0 ₽» на экране не появляется. Прежняя оценка отозвана 18:00; что реально стоит проверить — в C6 |
| B3 `/api/cards/1` | `locations[]` + `organization` | `200`; 2 точки, обе в рамке Приднестровья (`46.843/29.642`, `46.8401/29.6471`); `organization = {id:1, slug:"dom-tvorchestva-palitra", name:"Дом творчества «Палитра»"}` |
| B4 `/api/cards/{7,8,999,abc}` | 404, 404, 404, 400 | `404`, `404`, `404`, `400` — совпадает |
| C1 `web` и канонические поля | деталь берёт возраст/цену из `groups[]`, ничего не выдумано | плоско-карточные `age`/`price` — канонические (агрегат), **не нарушение**. Нарушение в `api-server.ts:14-35`: `groups: []` (`:33`), `locations: []` (`:32`), `photos: []` (`:25`), `organizationSlug: ""` (`:20`), выдуманный `superSlug: "other"` (`:22`), `slug: card.id` (`:18`) |
| C2 legacy-алиасы на каноне | четыре `200` | `/api/cards` → `200` (8); `/api/cards/10`, `/api/categories`, `/api/cities` → **`404`**. Назначено Агенту 2, фиксируется как **ожидающее**, не как дефект канона |
| C2 формы ответов | идентичны | `/api/cards` и `/api/v1/activities.items` — **идентичны** (39 полей) |
| C5 `/api/v1/districts` | `400` без `city` by design, `200` с `city` | `400` / `200`; 4 района Тирасполя (`centr`, `balka`, `naselenka`, `tarnovka`), ключи `id, slug, name, city_id` |
| Транзитивные моки | импортов нет | `lib/utils.ts:1`, `lib/filters.ts:1`, `lib/api-server.ts:1` — все три импортируют `@/lib/data` |
| §6 `view-mode` | `resolveViewMode` существует | grep по `web/src` на `view-mode`, `resolveViewMode`, `next/headers` — **0 совпадений** |

### Перепроверка 17:36–17:37 (HEAD `b9b34c5`, 31 незакоммиченный файл)

Стенд пересобирается на ходу, поэтому ключевые факты пересняты перед отправкой
находок. Всё подтвердилось, изменений нет:

```bash
for u in "POST http://localhost:8081/api/auth/tester" "POST http://localhost:8080/api/auth/tester" \
         "GET http://localhost:8081/api/auth/me" "GET http://localhost:8081/api/cards" \
         "GET http://localhost:8081/api/cards/10" "GET http://localhost:8081/api/categories" \
         "GET http://localhost:8081/api/cities" "GET http://localhost:8080/api/categories" \
         "GET http://localhost:8080/api/cities"; do
  m=${u%% *}; p=${u#* }; printf "%s  %s %s\n" "$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X "$m" "$p")" "$m" "$p"; done
```

| Маршрут | 17:36 |
|---|---|
| `POST :8081/api/auth/tester` | `404` |
| `POST :8080/api/auth/tester` | `404` |
| `GET :8081/api/auth/me` | `404` |
| `GET :8081/api/cards` | `200` (8) |
| `GET :8081/api/cards/10` | `404` |
| `GET :8081/api/categories` | `404` |
| `GET :8081/api/cities` | `404` |
| `GET :8080/api/categories`, `/api/cities` | `200`, `200` |

Маршруты фронта на `:3010` (17:37): `/organizations/studiya-palitra` → `200`,
`/organizations/dom-tvorchestva-palitra` → `404`, `/activities/tiraspol-studiya-palitra`
→ `404`, `/activities/studiya-palitra` → `404`, `/activities/palitra` → `404`.

Замер 17:37, `GET :8081/api/v1/activities/1`: плоские `age = {5,7}` и `price = 300`
— значения первой группы; группа 2 той же анкеты `8–12 лет`, `price_from 350`,
`price_to 400`, 10 мест. **Поправка координатора 17:47:** плоский агрегат —
каноническое поле, он ничего не «теряет», так задумано. Нарушение не в нём, а в
том, что `web` не читает `groups[]` вовсе (`api-server.ts:33`) — см. C1.

Про `price = 0` у канонических **id 6 и id 2** прежняя оценка («бесплатно и не
указано неразличимы, это дефект») **отозвана** решением координатора 18:00:
по §10.3 ТЗ `0` — это «бесплатно», `null` — «не указана». Дефектом БД не пишется;
проверять нужно маппинг UI — см. C6.

### Находка: слаги — решено координатором 18:00

Расхождение слагов между источниками зафиксировано и **разрешено**. Приёмочные
цели — канонические слаги, проверены на `:8081` в 18:00:

| Цель | Слаг | Факт `:8081` |
|---|---|---|
| Организация id 1 | `studiya-palitra` | эндпоинта `/api/v1/organizations/{slug}` пока нет → `404` |
| Занятие id 1 | `tiraspol-studiya-palitra` | `GET /api/v1/activities/tiraspol-studiya-palitra` → `200` |

Полная картина источников — для истории, синхронизировать их **не требуется**:

| Источник | Слаг организации id 1 | Слаг занятия id 1 | Статус |
|---|---|---|---|
| Спека §6 и §7 п.5 | `studiya-palitra` | — | совпадает с каноном |
| Канон `:8081` | `studiya-palitra` | `tiraspol-studiya-palitra` | **приёмочная цель** |
| Моки `web/src/lib/data.ts:118` | `studiya-palitra` | `hudozhestvennaya-studiya-palitra` | **не цель**: после §6 аноним должен получать на моковых слагах `404` |
| `database/init.sql:238` (схема №15) | `dom-tvorchestva-palitra` | **колонки `slug` у `cards` нет вовсе** (`init.sql:266-267`) | **легаси**: умирает вместе с сидом №15, в каноническом `init.sql` его нет |

Полный набор канонических `org_slug` на 8 анкет (замер 17:37):
`dmsh-veselye-noty`, `master-matematiki`, `shakhmatnyj-klub`,
`centr-rannego-razvitiya`, `klub-samokindal`, `dom-tvorchestva-bendery`,
`dnestr-futbol`, `studiya-palitra` — ни одного из них, кроме последнего, в моках нет.

Маршруты фронта, замер 17:37 на `:3010` (прод-сборка в mock-режиме):

```bash
for s in studiya-palitra dom-tvorchestva-palitra dmsh-veselye-noty; do
  printf "  /organizations/%-28s " "$s"; curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:3010/organizations/$s"; done
for s in tiraspol-studiya-palitra dubossary-shakhmaty hudozhestvennaya-studiya-palitra; do
  printf "  /activities/%-34s " "$s"; curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:3010/activities/$s"; done
```

| Маршрут | Факт 17:37 | Ожидание после §6 |
|---|---|---|
| `/activities/tiraspol-studiya-palitra` | `404` | **`200`** — приёмочная цель (§7 п.5) |
| `/activities/dubossary-shakhmaty` | `404` | `200` — канонический слаг |
| `/activities/bendery-balnye-tancy` | `404` | `200` — канонический слаг |
| `/activities/hudozhestvennaya-studiya-palitra` | `200` | **`404`** — моковый слаг, не цель |
| `/activities/futbolnaya-sekciya-chempion` | `200` | **`404`** — моковый слаг, не цель |
| `/organizations/studiya-palitra` | `200` (обслуживается моками) | **заблокировано**: нет `/api/v1/organizations/{slug}` |
| `/organizations/dom-tvorchestva-palitra` | `404` | `404` — легаси, так и должно остаться |
| `/organizations/dmsh-veselye-noty` | `404` | заблокировано, как и все `/organizations/*` |

**Почему `/organizations/*` — блок, а не провал (замер 18:00):**

```bash
for p in "/api/v1/organizations/studiya-palitra" "/api/organizations/studiya-palitra" \
         "/api/v1/activities?org=studiya-palitra" "/api/v1/activities?org_slug=studiya-palitra"; do
  printf "  %-46s " "$p"
  curl -s -o .audit-tmp/probe.json -w "HTTP %{http_code} " -m 5 "http://localhost:8081$p"
  node -e "try{const d=JSON.parse(require('fs').readFileSync('.audit-tmp/probe.json','utf8'));console.log('total='+(d.total??(Array.isArray(d)?d.length:'-')))}catch{console.log('(не JSON)')}"
done
```

Факт: `/api/v1/organizations/studiya-palitra` → `404`, legacy
`/api/organizations/studiya-palitra` → `404`, а `?org=` и `?org_slug=`
**игнорируются** — оба возвращают `total=8`, то есть весь список. Фильтра по
организации в каноне сейчас нет ни в каком виде.

Агенту 2 назначено добавить `/api/v1/organizations/{slug}` и legacy
`/api/organizations/{slug}` с `organization` + `activities[]` (только
`published`). **До появления эндпоинта часть §7 п.5 про `/organizations/*`
помечается «заблокировано», а не «провал»** — данные для страницы организации
брать неоткуда, независимо от качества реализации §6.

Проверка после появления эндпоинта: `activities[]` должен содержать только
`published` и не должен включать ни одной анкеты со `status != 'published'`.

### Находка: `dynamicParams = false` заблокирует §6 на `/activities/[slug]`

`web/src/app/activities/[slug]/page.tsx:8-12`:

```tsx
export function generateStaticParams() {
  return activities.map((activity) => ({ slug: activity.slug }));
}

export const dynamicParams = false;
```

`generateStaticParams` перечисляет слаги **из моков**, а `dynamicParams = false`
превращает любой другой слаг в жёсткий `404`. Поэтому даже после перевода
страницы на `GET /api/v1/activities/{slug}` канонические слаги продолжат давать
`404` — правка источника данных без правки этих двух строк результата не даст.
Это уже отмечено в `web/COORDINATION.md` (раздел «Что по-прежнему не подключено
к бэкенду») как «клик по API-карточке упрётся в мок-роут и даст 404».

Дополнительно: в схеме №15 у `cards` нет колонки `slug`, поэтому
`web/src/lib/api-server.ts:19` подставляет вместо слага числовой `id`
(`slug: card.id`). В каноне `slug` есть у каждой анкеты.

Тот же паттерн проверить на остальных динамических маршрутах:

```bash
grep -rn "generateStaticParams\|dynamicParams" web/src/app/ | grep -v node_modules
```

---

## Раздел D. Базовый замер «до реализации §6»

Прогон `.audit-tmp/acceptance-clean.mjs http://localhost:3010` в 17:17, аноним,
прод-сборка в **mock-режиме** (без `NEXT_PUBLIC_API_URL`). Это точка отсчёта, а не
вердикт: §6 ещё не реализован (`web/src/lib/view-mode.ts` отсутствует, grep по
`web/src` не находит ни `view-mode`, ни `resolveViewMode`, ни одного вызова
`cookies()` из `next/headers`).

| Маршрут | HTTP | Байт | visible | flight |
|---|---|---|---|---|
| `/` | 200 | 253 306 | 38 | 15 |
| `/map` | 200 | 70 023 | 4 | 8 |
| `/favorites` | 200 | 27 518 | 4 | 4 |
| `/account` | 200 | 27 345 | 4 | 4 |
| `/moderation` | 200 | 27 272 | 4 | 4 |
| `/about` | 200 | 116 033 | 16 | 16 |
| `/activities/hudozhestvennaya-studiya-palitra` | 200 | 92 680 | 20 | 22 |
| `/organizations/studiya-palitra` | 200 | 52 601 | 17 | 15 |
| **Итого** | | | | **195 вхождений** |

Отдельные находки этого замера:

1. **`/map` — утечка только в RSC-поток.** «Палитра» и «Киберход» дают
   `visible=0`, `flight=2`. Визуально страница чистая, но моки уходят клиенту в
   flight-данных. Именно этот класс дефекта §6 требует ловить.
2. **`/account` и `/moderation` отдают `200`, а §6 требует 404-экран**
   «Раздел доступен по тестовому входу». Коллекции из ответа уже убраны
   (`app/account/page.tsx:19`, `app/moderation/page.tsx:18` не передают пропсов,
   моки грузит клиент) — утечка осталась только в общей обвязке (футер, шапка).
3. **`+373 777` на `/` даёт `flight=8`** при `visible=1`: фейковый телефон
   тиражируется в flight-потоке. Источник — `components/layout/Footer.tsx:17-18`.
4. **Общая обвязка загрязняет каждый маршрут**, включая `/favorites`, `/account`,
   `/moderation`: футер (`Footer.tsx:17-18` телефон, `:20-21` и `:50` почта) и
   шапка (`Header.tsx:127-144` два фейковых уведомления, `:35` `useState(2)`
   счётчик непрочитанных, `:96-104` фейковые «Сообщения»). Эти компоненты
   рендерятся из `app/layout.tsx:88-97` и не gated ничем.
5. **Фейковая статистика «О проекте»** — `app/about/page.tsx:222-225`, четыре
   `LegalStat` с выдуманными процентами; `hello@talentro.md` на этом маршруте
   встречается 11 раз (дубль источника — `components/legal/LegalLayout.tsx:18`).

### Транзитивная зависимость от моков (блокирует C1/C4 даже после правки страниц)

Три общих модуля импортируют `@/lib/data`, поэтому **любой** их потребитель
тянет весь mock-модуль, включая API-ветку:

| Модуль | Строка | Что импортирует | Кто зависит |
|---|---|---|---|
| `web/src/lib/utils.ts` | 1 | `activities, applications, categories, organizations` | `cn` (:105), `plural` (:4), `initials` (:128) — почти все клиентские компоненты |
| `web/src/lib/filters.ts` | 1 | `activities, categories, cities, districts` | `parseFilters`, `defaultFilters`, `cityCenters`, `distanceKm` |
| `web/src/lib/api-server.ts` | 1 | `cities` | используется в `toCardQuery` (`:39`) — это сам API-путь |

Следствие: убрать моки из пропсов страниц недостаточно, пока `cn()` и
`parseFilters()` живут в файлах с импортом `@/lib/data`. Проверять так:

```bash
grep -n "from \"@/lib/data\"" web/src/lib/utils.ts web/src/lib/filters.ts web/src/lib/api-server.ts
```

**Ожидание после реализации §6:** вывод пустой, либо чистые функции
(`cn`, `plural`, `initials`, `parseFilters`, `defaultFilters`) вынесены в модули
без импорта моков.

### Утечка справочников в API-режиме

`web/src/app/page.tsx:109-112` передаёт `categories`, `superCategories`, `cities`,
`districts` в `CatalogClient` **безусловно** — ветвление `useApi` (`:34`) их не
касается. То есть даже когда каталог честно читается из API, четыре mock-справочника
уезжают клиенту в пропсах. Проверять после реализации:

```bash
sed -n '95,120p' web/src/app/page.tsx
```

**Ожидание:** справочники приходят из `GET /api/v1/categories` и
`GET /api/v1/cities` (оба на каноне отвечают `200`), а не из `@/lib/data`.

### Полный перечень импортёров моков

22 файла импортируют `@/lib/data`. Серверные компоненты (`app/**`):
`page.tsx:4`, `map/page.tsx:3`, `activities/[slug]/page.tsx:4`,
`activities/[slug]/reviews/page.tsx:6`, `organizations/[slug]/page.tsx:6`,
`request/page.tsx:5`, `account/activities/new/page.tsx:3`,
`account/activities/[id]/page.tsx:4`.

Клиентские (`components/**`): `catalog/Hero.tsx:6` (`popularQueries`),
`favorites/FavoritesClient.tsx:7`, `account/OwnerCabinet.tsx:20`,
`moderation/ModerationClient.tsx:7-16`, `moderation/ReportQueue.tsx:7`,
`moderation/QuickEditForm.tsx:6`, `moderation/DecisionForm.tsx:6`,
`activity/ReviewsBlock.tsx:19`.

---

## Раздел E. Заблокировано и чего не хватает

Статусы приведены по решениям координатора от 18:00 и перепроверены в 19:04–19:20
на `HEAD` `03d854e`. «Заблокировано» означает «пункт не исполним сейчас по
внешней причине», а **не** «провален»: в вердикте приёмки такие пункты не идут ни
в зачёт, ни в незачёт.

| Что | Статус | Почему |
|---|---|---|
| §7 п.6 (тестер видит моки) | **частично разблокировано** | auth-срез ожил на `:8080`. Отпечаток 19:19 только `GET`: `/api/auth/tester` → `405`, `/api/auth/me` → `200` с `{"authenticated":false,"tester":false}`, `/api/auth/logout` → `405`; `405` означает «маршрут зарегистрирован, метод другой». В исходниках — `route.go:20-23`. Но **фронт их не вызывает**: `web/src/lib/view-mode.ts` отсутствует, `resolveViewMode` не встречается ни в одном файле `web/src`. Итог: куку тестера получить можно, а предъявить сайту нечем. Приёмку куки координатор 18:00 отложил до переноса auth-среза на канон |
| §7 п.5, часть про `/organizations/*` | **заблокировано** | на каноне нет `/api/v1/organizations/{slug}` (`404`, замер 18:00, перепроверено 19:04 — `404` у `/api/v1/organizations/{slug}`, legacy `/api/organizations/{slug}` и `/api/v1/organizations`), а `?org=` игнорируется — `/api/v1/activities?org=studiya-palitra` возвращает все 8. Агенту 2 назначено добавить `/api/v1/organizations/{slug}` и legacy `/api/organizations/{slug}` с `organization` + `activities[]` (только `published`). До появления эндпоинта — блок, не провал |
| §7 п.5, часть про `/activities/*` | исполнима по данным, но упёрлась в `dynamicParams` | канонические слаги-цели известны и отвечают `200`: `tiraspol-studiya-palitra` (и `1`). `dynamicParams = false` по-прежнему стоит на всех четырёх динамических маршрутах (замер 19:19): `activities/[slug]/page.tsx:12`, `activities/[slug]/reviews/page.tsx:14`, `organizations/[slug]/page.tsx:18`, `account/activities/[id]/page.tsx:10` |
| §7 п.5 и C4 на каноне целиком | **заблокировано** | прод-сборка `:3010` в mock-режиме; пересборка с `NEXT_PUBLIC_API_URL=:8081` упирается в правило 3 (общий `web/.next`) |
| Замер утечек §6 на `:3010` | **недействителен для текущего кода** | стенд держит устаревшую прод-сборку. Доказательство: снимок `/` в 19:16 байт-в-байт совпал со снимком 17:16 (md5 `54d965741b74a84d2d887d679573989b`, 271 839 байт), хотя в 19:03–19:07 легли четыре коммита, включая `ea2eb99` с правкой веба; `web/.next/BUILD_ID` датирован 15:24. Прогон `.audit-tmp/acceptance-clean.mjs` в 19:17 дал те же **195 вхождений**, что и базовый замер 17:17. Пересборку делать нельзя (правило 3), поэтому Раздел D остаётся точкой отсчёта, а не измерением прогресса |
| C3 (auth-срез на каноне) | **заблокировано** | на `:8081` все три auth-маршрута → `404` (перепроверено 19:19). На `:8080` теперь есть все четыре, но это стенд схемы №15, не канон |
| §7 п.1 (идемпотентность `init.sql`) | **согласовано с условиями** | разрешение получено 18:00, но не на БД Агента 1 и только после чекпоинта Агента 2. Порядок — в B1 |
| §7 п.8, гейт A6 (`next build`) | **заблокировано** | координатор 18:00: сейчас не запускать. После интеграции либо согласует окно с Агентом 1 (остановка `:3000`/`:3010`), либо прогонит сам и передаст результат. Серверы Агента 1 не останавливать. Дополнительный факт 19:16: `:3000` не отвечает вовсе, жив только `:3010` |
| C4 (чистота на каноническом стенде) | **заблокировано** | требует A6 |
| Тесты `internal/auth` | **закрыто** | файл из Раздела F лёг в дерево коммитом `7518f10`, A2 даёт `ok talento/internal/auth`. Проверен мутациями на новой реализации — см. «Дефект гейта Go: flaky-подтест подписи» |
| `SESSION_SECRET` и `TESTER_TOKEN` в `.env.example` | **закрыто** | добавлены: `GOOGLE_CLIENT_ID` (`:7`), `SESSION_SECRET=CHANGE_ME` (`:9`), `TESTER_TOKEN=CHANGE_ME` (`:11`). `config.go:43` требует `SESSION_SECRET`, а `config.go:45` документирует правильное поведение — пустой `TESTER_TOKEN` отключает тестовый вход, а не открывает его всем |
| Промежуточные чекпоинты как точки отката | **риск** | `b9b34c5` не собирается (`go build ./...` → exit 1). Откат на него даёт нерабочий бэкенд; подробности — в «Дефект гейта Go: чекпоинт `b9b34c5` не собирался» |
| `web/src/lib/view-mode.test.ts` | отложено | `view-mode.ts` по-прежнему отсутствует (замер 19:19). Писать только когда появится, иначе конфликт с Агентом 1 |
| Сообщение Агенту 1 с отзывом Приоритета 3 | **доставлено** | координатор доставил его сам, вместе с уточнением по Приоритету 5, снятием Приоритета 7 и дефектом `HEAD`. Мой прямой вызов в делегированном ходе отклонялся политикой пересылки; попытка в неделегированном ходе не прошла валидацию параметров — фактически доставил координатор, не я |

---

## Раздел F. Проверенные Go-тесты `internal/auth` (передаются Агенту 1)

Указание координатора: Go-тесты auth в основном дереве не создавать — передать
Агенту 1 текстом или патчем. Ниже — патч, прогнанный в изолированной копии вне
дерева репозитория, чтобы Агент 1 получил не предположение, а проверенный файл.

**Статус на 19:20, HEAD `03d854e`: раздел стал историческим.** Файл передан,
Агент 1 положил его в дерево коммитом `7518f10` — теперь это
`backend/Talentro/internal/auth/session_test.go`, 334 строки (было 320: добавлен
`TestStoreDecodeRejectsTokenPastItsLife`, поправлены комментарии). Коммит
`03d854e` изменил саму реализацию, поэтому таблица мутаций ниже описывает
`session.go` **до** `03d854e`; актуальные мутации новой реализации — в подразделе
«Дефект гейта Go: flaky-подтест подписи» Раздела A. Копии в `.audit-tmp/authtest`
освежены и сверены `diff -q` с деревом: `session.go` и `session_test.go`
идентичны, рабочее дерево по `internal/auth/` чистое относительно `HEAD`.

| Параметр | Значение |
|---|---|
| Черновик | `.audit-tmp/authtest/session_test.go` (320 строк, каталог в `.gitignore:52`) |
| Куда положить | `backend/Talentro/internal/auth/session_test.go` |
| Копия реализации | `.audit-tmp/authtest/session.go` — `diff -q` с `internal/auth/session.go` **идентичен** |
| Прогоны 17:40–17:42 | `gofmt -l .` — пусто; `go vet ./...` — 0; `go test ./... -count=1` — `ok`, **10 тестов верхнего уровня, 23 подтеста** |

Команды (из `D:\CyberSprint`):

```bash
cd .audit-tmp/authtest && gofmt -l . && go vet ./... && go test ./... -count=1 -v
```

### Проверка мутациями

Тест, который не краснеет на сломанной реализации, ничего не стоит. Прогнаны две
мутации в копии `session.go`, после каждой файл восстановлен и `diff -q` подтвердил
идентичность оригиналу:

| Мутация | Правка | Покраснело |
|---|---|---|
| Отключена проверка срока | `session.go:90` → `if false {` | `TestStoreDecodeRejectsExpired` + все 4 подтеста |
| Отключена сверка подписи | `session.go:78` → `if len(wantBytes) == 0 && subtle.ConstantTimeCompare(...) != 1 {` | `TestStoreDecodeRejectsForeignSecret`, `TestStoreDecodeRejectsMalformedToken/изменён_последний_байт_подписи`, `TestStoreDecodeRejectsCrossTokenSignature` |

### Что покрыто

| Тест | Требование §7 / §5 |
|---|---|
| `TestNewStoreRejectsEmptySecret` | §5: без `SESSION_SECRET` запуск падает, а не подписывает пустотой |
| `TestStoreRoundTrip` | §5: формат `base64(json).hmac_sha256` читается обратно |
| `TestStoreDecodeRejectsExpired` | §5: истёкший `exp` отклоняется; `now` подменяется через поле `Store.now` |
| `TestStoreDecodeRejectsForeignSecret` | §7: чужой секрет не открывает сессию |
| `TestStoreDecodeRejectsMalformedToken` | §7: битая подпись, мусор вместо base64, пустые части |
| `TestStoreDecodeRejectsCrossTokenSignature` | подпись от одной анкеты не открывает другую |
| `TestStoreSetCookieAttributes` | §5: `HttpOnly`, `Path=/`, `SameSite=Lax`, `MaxAge=2592000`, `Secure` по аргументу |
| `TestStoreClearExpiresCookie` | §4 `POST /api/auth/logout`: кука гасится, а не перезаписывается |
| `TestClaimsFromRequest` | §6: аноним — это состояние, а не ошибка; чужое имя куки игнорируется |
| `TestSecureRequest` | §5: `X-Forwarded-Proto` определяет флаг `Secure` |

### Что этими тестами НЕ покрыто и почему

| Требование §7 | Почему не здесь |
|---|---|
| Сверка `TESTER_TOKEN` | живёт в `handlers`, а не в `auth`; маршрута `POST /api/auth/tester` ещё нет (Раздел E) |
| Обязательность `aud` | требует сначала вынести верификатор ID-токена за интерфейс — сейчас `handlers/auth.go:66` при пустом `GOOGLE_CLIENT_ID` проверку **пропускает** вместо `503` по §4 |
| Форма `/api/cards/{id}` | нужен живой Postgres; покрывается приёмкой B3/B4, а не юнит-тестом |
| Список CORS | уже покрыт `internal/delivery/http/cors_test.go` — единственный существующий Go-тест в дереве |

### Замечание по API `auth.Store`

`Encode` не проставляет `Exp`, а `Decode` отклоняет `Exp <= now`. Значит
`Encode(Claims{...})` без явного `Exp` всегда возвращает токен, который сам же
`Store` не прочитает. В тестах это обойдено заполнением `Exp` вручную; но если
`Encode` останется экспортированным, вызывающий код наступит на то же. Варианты:
заполнять `Exp` в `Encode`, либо сделать его неэкспортированным (используется
только из `Set`).

---

## Раздел G. Приёмка живого стенда `26.52.103.163` (§7), прогон 21:52–22:10

Стенд, объявленный координатором: веб `http://26.52.103.163:3000`, API
`http://26.52.103.163:8080`, ветка `feat/15-16-integration`, коммит `64ff363`
(«15-16: прокси входа отдаёт заголовки ответа, а не запроса — Set-Cookie доходит
до браузера»). Это **другой хост**, а не локальные `:3000`/`:8080` Агента 1:
поэтому правило «ничего не перезапускать, только GET» действовало для локальных
стендов, а `POST /api/auth/tester` и `POST /api/auth/logout` на новом стенде
выполнены как явно разрешённые координатором.

Ревизия стенда есть локально (`git cat-file -t 64ff363` → `commit`, ветка
`feat/15-16-integration`), поэтому каждое чёрноящичное наблюдение сверено с кодом
именно этой ревизии, а не текущего `HEAD` (`9f6e715`).

**Поправка о сборке (внесена 23:05).** Все замеры раздела G сняты со сборки Next
с build ID `V6yuY2BIoA-J66bW_EwJP`. Стенд с тех пор пересобран дважды: сначала на
`f2d2843`/`9f10e6b` (карта иконок), затем на HEAD integration-worktree `371738d`
(build ID `16vM8sVQvPyQBYZGrgMcr`). Повторный прогон 23:00–23:10 (раздел I)
показал, что пересборка **не отменила ни одной находки G**: 9 из 10 маршрутов
отличаются от снимков 21:52–22:10 только build ID, а `/` — build ID и правкой
иконок. Поэтому G.4, G.5, G.6, G.7, G.10, G.11 остаются в силе на актуальной
сборке; ссылки на «стенд держит `64ff363`» ниже надо читать как «стенд держал
`64ff363` на момент прогона G».

Одно наблюдение раздела H (H.4) показывает, что web-сборка, обслуживавшая `:3000`
в 21:58, не совпадала по `web/src/components/ui/Icon.tsx` с деревом `64ff363`.
На выводы G это не влияет: фикс прокси входа (`64ff363:web/src/app/api/auth/[...action]/route.ts`)
на том же стенде работал, что проверено заголовком `set-cookie` (G.2, I.2).

База стенда — `talentro_accept_1516` на `127.0.0.1:55432`. Выполнялись **только
`SELECT`**; ни одного перезапуска, ни одной записи. Таблицы канона:
`cards, categories, cities, districts, groups, locations, media, messengers,
organizations, schedules, users`. Таблицы `card_locations` **нет** — это имя
схемы ветки №15, не канона, поэтому §7 п.7 в формулировке спеки читается как
«строки `locations`, на которые ссылаются группы опубликованных анкет».

### G.0. Факты базы (только `SELECT`)

| Замер | Значение |
|---|---|
| `cards` всего / `status='published'` | 10 / **8** |
| непубликованные | `kamenka-kulinariya-podrostki` (`on_moderation`), `slobodzeja-legkaya-atletika` (`rejected`) |
| `locations` всего / активных / с координатами | 12 / 12 / **11** |
| `groups` всего / у опубликованных анкет | 16 / 14 |
| **различных `location_id` у групп опубликованных анкет** | **9** — это ожидаемое число меток §7 п.7 |
| `organizations` / `cities` / `districts` / `categories` | 10 / 8 / **4** / 63 |

```bash
PSQL="C:/Program Files/PostgreSQL/18/bin/psql.exe"
"$PSQL" -h 127.0.0.1 -p 55432 -U user7 -d talentro_accept_1516 -At -F'|' -c \
"select 'cards_published',count(*) from cards where status='published'
 union all select 'distinct_locations_of_published_cards',count(distinct g.location_id)
   from groups g join cards c on c.id=g.card_id where c.status='published';"
```

### G.1. Проверки, запрошенные координатором

| # | Проверка | Ожидание | Факт | Итог |
|---|---|---|---|---|
| 1 | `GET /api/v1/activities` | 8 карточек | `total=8`, `items=8`, `page=1`, `limit=20` | **принято** |
| 2 | `GET /activities/tiraspol-studiya-palitra` | 200 | 200 (фронт и API) | **принято** |
| 3 | мок-слаг | 404 | все 6 слагов из `web/src/app/page.tsx:130-137` → 404 | **принято** |
| 4 | `?q=палитра` | отбор | API `total=1`; фронт рисует 1 карточку | **принято** |
| 5 | `?city=bendery` | отбор | API `total=2`; фронт рисует 2 (`bendery-balnye-tancy`, `bendery-robototekhnika`) | **принято** |
| 6 | `?free=1` | бесплатные | API `total=2`, обе `price=0`; фронт рисует те же 2 | **принято** |
| 7 | вход тестировщика | кука доходит | 200 + `set-cookie: talentro_session=…; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax` | **принято** |
| 8 | `GET /api/auth/me` с кукой | `authenticated:true,tester:true` | `{"authenticated":true,"tester":true,"role":"tester","name":"Тестировщик","email":"tester@localhost","provider":"token"}` | **принято** |
| 9 | витрина в demo-режиме | моки появляются | `/`: мок-слагов аноним **0** → тестер **20**; размер 119 642 → 161 199 **символов** (126 181 → 172 936 байт, Δ 41 557 символов) | **принято для `/`**; для остальных маршрутов см. G.3 |
| 10 | `POST /api/auth/logout` | кука снимается | 204 + `set-cookie: talentro_session=; Expires=Thu, 01 Jan 1970…; Max-Age=0`; `/me` → `authenticated:false`; кука пропала из jar | **принято** |

Кириллица в query передавалась percent-encoded (`%D0%BF%D0%B0%D0%BB%D0%B8%D1%82%D1%80%D0%B0`)
по правилу 8: консоль Git Bash не UTF-8, и сырая кириллица дала бы ложный 400.

```bash
curl -s -i -X POST "http://26.52.103.163:3000/api/auth/tester" \
  -H 'content-type: application/json' -d '{"token":"stand-tester-token"}' | head -8
curl -s -b jar.txt "http://26.52.103.163:3000/api/auth/me"
curl -s -i -b jar.txt -c jar.txt -X POST "http://26.52.103.163:3000/api/auth/logout" | head -6
```

### G.2. Дефект `64ff363` подтверждён исправленным, плюс две проверки подписи

**Исправленный дефект.** До правки `relay()` собирал заголовки в переменную
`response`, а `new Response(…)` получал `{ headers }` — заголовки **запроса**
(`web/src/app/api/auth/[...action]/route.ts:53-60`), то есть посетителю
возвращались его же `cookie` и `x-forwarded-proto`, а `set-cookie` с сессией
терялся. После правки (`:73-82`) прокси отдаёт `responseHeaders`. Замер на
стенде: `set-cookie` с `talentro_session` присутствует в ответе `:3000`, кука
сохраняется в jar и принимается как `:3000`, так и `:8080`.

**Отклонение подделанной куки.** Проверены четыре случая, все → `authenticated:false`:

| Случай | Ответ `:8080/api/auth/me` |
|---|---|
| последний символ подписи `8` → `9` | `{"authenticated":false,"tester":false}` |
| payload с `role:"owner"` и чужой подписью | `{"authenticated":false,"tester":false}` |
| `talentro_session=not-a-token` | `{"authenticated":false,"tester":false}` |
| куки нет | `{"authenticated":false,"tester":false}` |

Первый случай — не косметика, а **живое подтверждение фикса из Раздела A**.
`RawURLEncoding` отбрасывает младшие 2 бита последнего символа: индексы `8`=60 и
`9`=61 декодируются в **идентичные** 32 байта (`22f9d451069c9b9d…`), но строки
различаются. Прежняя побайтовая сверка такую куку приняла бы; `hmac.Equal` по
строкам (коммит `03d854e`) отклоняет. Проверено вычислением, а не на глаз:

```bash
python -c "import base64;a='…tI8';b='…tI9';d=lambda s:base64.urlsafe_b64decode(s+'='*(-len(s)%4));print(d(a)==d(b), a==b)"
# True False   <- байты те же, строка другая
```

**Google-вход.** `POST /api/auth/google` с телом `{"credential":"fake.token.value"}`
→ **503** `вход через Google не настроен: не задан GOOGLE_CLIENT_ID`. Пустое тело
→ 400. Это ровно то, что требовал план: без `GOOGLE_CLIENT_ID` проверка `aud` не
«пропускается молча», а вход закрыт.

**Отпечаток маршрутов стенда** (GET; chi отдаёт 405, если путь есть, но метод не
тот, и 404, если пути нет):

| Путь | Код | Вывод |
|---|---|---|
| `/api/v1/activities`, `/api/v1/activities/{slug}`, `/api/v1/categories`, `/api/v1/cities` | 200 | канон Агента 2 жив |
| `/api/auth/me` | 200 | есть |
| `/api/auth/tester`, `/api/auth/logout` | 405 | есть, только POST |
| `/api/cards`, `/api/categories`, `/api/cities` | 200 | legacy-алиасы живы |
| `/api/v1/locations`, `/api/v1/groups`, `/api/v1/organizations`, `/api/v1/filters`, `/api/v1/dictionaries` | 404 | отсутствуют |

### G.3. Главная находка: граница §6 реализована только на `/`

`readView()` — единственная серверная точка, которая читает куку и зовёт
`/api/auth/me` — вызывается **ровно из одного места**:

```bash
git grep -n "readView\|resolveViewMode" 64ff363 -- web/src | grep -v "lib/session.ts\|lib/view-mode"
# 64ff363:web/src/app/page.tsx:13  import { readView } from "@/lib/session";
# 64ff363:web/src/app/page.tsx:39  const { mode } = await readView();
```

`fetchSession` (`web/src/lib/api.ts:351`) вызывается только из
`web/src/lib/session.ts:25`. Клиентских обращений к `/api/auth/me` нет вовсе.

Чёрноящичное подтверждение: 12 маршрутов сняты дважды, анонимом и с кукой
тестера, и **11 из 12 совпадают побайтово** (`cmp -s`):

| Маршрут | аноним ≡ тестер | мок-слагов аноним / тестер |
|---|---|---|
| `/` | **различаются** | **0 / 20** |
| `/map` | идентичны | 0 / 0 |
| `/favorites` | идентичны | 0 / 0 |
| `/organizations/studiya-palitra` | идентичны | **4 / 4** |
| `/activities/tiraspol-studiya-palitra` | идентичны | 0 / 0 |
| `/activities/tiraspol-studiya-palitra/reviews` | идентичны | 0 / 0 |
| `/account` | идентичны | 0 / 0 |
| `/moderation` | идентичны | 0 / 0 |
| `/login`, `/about`, `/register`, `/request` | идентичны | 0 / 0 |

Коды ответов тоже не различаются: `/account`, `/moderation`, `/favorites`,
`/map`, `/organizations/studiya-palitra`, `/activities/tiraspol-studiya-palitra`
— по **200** и анониму, и тестеру.

Что это значит для §7: **п.5 на маршрутах `/`, `/map`, `/favorites` — принят**
(моков у анонима нет), **п.6 принят только для `/`** (на остальных маршрутах
тестер не получает ничего сверх анонима, потому что режим там не читается).
Таблица §6 перечисляет `/map`, `/activities/[slug]`, `/organizations/[slug]`,
`/favorites`, `/account`, `/moderation` как разделы с ролевым поведением — фактически
роль там не учитывается.

### G.4. Находка: `/organizations/[slug]` отдаёт анониму моки и битую ссылку

`web/src/app/organizations/[slug]/page.tsx` на `64ff363` не обращается ни к
бэкенду, ни к сессии:

| Строка | Что делает |
|---|---|
| `:6` | `import { categories, organizations } from "@/lib/data"` — моки |
| `:14-16` | `generateStaticParams()` возвращает **моковые** слаги организаций |
| `:18` | `export const dynamicParams = false` — любой немoковый слаг даёт 404 |
| `:55` | организация ищется в массиве моков |
| `:58` | `getOrganizationActivities(organization.slug)` — моковые анкеты |

Страница существует **только потому**, что мок-слаг `studiya-palitra` случайно
совпал с каноническим. Содержание — тоже мок:

| Маркер | аноним | тестер | Источник |
|---|---|---|---|
| «Художественная студия» | 14 | 14 | мок (`lib/data.ts`) |
| «Студия рисования» | **0** | **0** | БД (`organizations.name`) |
| `hudozhestvennaya-studiya-palitra` | 4 | 4 | мок-слаг |
| `tiraspol-studiya-palitra` | **0** | **0** | канонический слаг из БД |

Аноним видит одну карточку `class="activityCard"` со ссылкой
`/activities/hudozhestvennaya-studiya-palitra`, которая отвечает **404** (проверено
в G.1 п.3). То есть страница организации ведёт посетителя в тупик.

Нарушено: §6 «`/organizations/[slug]` | организация из БД + её анкеты».
Отдельно — это тот самый случай, из-за которого §7 п.5 в спеке назван
заблокированным: канонического `GET /api/v1/organizations/{slug}` на стенде нет
(404 в G.2), поэтому брать организацию из БД фронтенду сегодня неоткуда.
Ответственный — Агент 2 (контракт) и Агент 1 (страница); не исправлял.

```bash
curl -s "http://26.52.103.163:3000/organizations/studiya-palitra" | grep -o "hudozhestvennaya-studiya-palitra" | wc -l   # 4
curl -s -o /dev/null -w "%{http_code}\n" "http://26.52.103.163:3000/activities/hudozhestvennaya-studiya-palitra"          # 404
```

### G.5. Находка: `/map` передаёт анониму моковые справочники

`web/src/app/map/page.tsx:3` импортирует `activities, categories, cities,
districts, superCategories` из `@/lib/data`, а `:68-71` передаёт их в
`<MapClient>` **безусловно** — в отличие от `web/src/app/page.tsx:50-56`, где при
`useApi` справочники подменяются настоящими. Замер на анонимном `/map`:

| Слаг | Происхождение | Вхождений в ответе анонима |
|---|---|---|
| `kompyuternye-igry`, `nastolnye-igry`, `3d-dizain`, `skorochtenie`, `uhod-za-zhivotnymi`, `kinologiya` | мок (`lib/data.ts`) | **по 1, все шесть** |
| `chess`, `drawing`, `football`, `robotics`, `school-prep`, `tutoring` | БД (`/api/v1/activities`) | **0** |

Совпадения `dance`=1 и `music`=2 проверены по контексту и оказались **именами
иконок**, а не слагами БД: `"slug":"sport-dance"` и `"icon":"music"` из мокового
справочника категорий. В отчёт они как доказательства не идут.

Нарушено: §6 «счётчики … не передаются клиентом» и общий принцип «обычному
посетителю — только данные бэкенда». Фильтровая панель карты построена на моках,
поэтому анониму предлагаются направления, которых в БД нет.

### G.6. Находка: карта теряет настоящие координаты и объясняет это неверно

`web/src/app/map/page.tsx:35-42` (ветка `isApiEnabled()`) оставляет
`markers = []` и задаёт `emptyReason`:

> «Бэкенд пока не отдаёт координаты точек, поэтому на карте нет ни одной метки.»

Это утверждение **неверно для канона**. `GET /api/v1/activities` отдаёт `lat` и
`lng` на каждой из 8 анкет, а `web/src/lib/api-server.ts:128-129`
(`locationFromListItem`) и `:191-192` (`toLocationFromDetail`) уже раскладывают их
в `Location.lat` / `Location.lng`. Доказательство, что данные доходят до браузера:
в RSC-потоке анонимного `/` лежат **8 уникальных пар координат** —
`46.8089/29.5743`, `46.8117/29.5807`, `46.8407/29.6344`, `46.8435/29.6392`,
`46.8487/29.6471`, `46.8501/29.6299`, `47.2647/29.3264`, `47.833/29.6837`.

Причина, по которой метки всё равно не строятся, — сигнатура
`catalogMarkers(filters: FilterState)` (`web/src/lib/filters.ts:414`): она
вызывает `filterCatalog(filters)` внутри, то есть работает **только по мокам** и
не принимает готовый список анкет. Поэтому `map/page.tsx` зовёт её лишь в
моковой ветке `:49-50`.

Итог по §7 п.7: **не принят**. Ожидалось 9 меток (различные `location_id` групп
опубликованных анкет, G.0), фактически 0. В ответе `/map` нет ни одной пары
координат; найденные 6 вхождений подстроки `lat` — это `templateStyles` и
`notFound` в служебном payload Next, а не данные.

Дополнительно: `web/src/lib/api-server.test.ts:288` закрепляет
`expect(activity.locations[0]).toMatchObject({ lat: 0, lng: 0 })` на фикстуре с
`lat: null, lng: null` (`:108-109`). §7 требует «отсутствие в маппинге выдуманных
значений там, где сервер отдал `null`» — тест фиксирует ровно обратное. Сегодня
последствий нет (метки не строятся), но если их подключат, точка без координат
уедет в `(0,0)` — Гвинейский залив.

### G.7. Находка: `/account` и `/moderation` — 200 и клиентский гейт вместо 404-экрана §6

§6 требует для анонима «404-экран «Раздел доступен по тестовому входу» без
каких-либо коллекций в ответе». Факт:

| Проверка | Результат |
|---|---|
| `GET /account` анонимом | **200**, `<h1>Кабинет владельца</h1>` |
| `GET /moderation` анонимом | **200**, `<h1>Кабинет модератора</h1>` |
| строка «Раздел доступен по тестовому входу» в `web/src` | **0 совпадений** (`git grep` на `64ff363`) |
| коллекции в RSC-потоке | 0 мок-слагов — здесь §6 выполнен |

Коллекций в серверном ответе действительно нет: `web/src/app/account/page.tsx:16-18`
и `web/src/app/moderation/page.tsx:16-18` возвращают голый клиентский компонент,
и комментарии в обоих файлах прямо объясняют это решение. Провал в другом — гейт
клиентский и подделываемый:

- `web/src/components/moderation/ModerationClient.tsx:73` —
  `if (!user || user.role !== "moderator")`, и `user` приходит из `useApp()`;
- `web/src/components/providers/AppProviders.tsx:119-120` —
  `const isModerator = email.toLowerCase().includes("moder");` /
  `const isOwner = email.toLowerCase().includes("owner");`
- моковые очереди импортируются на уровне модуля
  (`ModerationClient.tsx:20-32` → `pendingQueue` и др. из `@/lib/moderation`),
  то есть уходят в клиентский бандл всем посетителям.

Значит любой посетитель, введя на `/login` почту с подстрокой `moder` и пароль от
6 символов, получает `role:"moderator"` и полный кабинет модерации с моковыми
очередями — без куки и без единого запроса к бэкенду.

**Оценка честно:** это не эскалация привилегий на сервере. Серверная сессия от
этого не появляется (`/api/auth/me` без куки → `authenticated:false`, G.2), все
действия кабинета — над моками в памяти браузера. Нарушены §6 (требуемый
404-экран отсутствует, роль выводится из подстроки почты) и §8 («публичный токен
тестировщика … доступ к мокам — не привилегия» — но здесь доступ к мокам
открывается вообще без токена).

### G.8. Находка: `AppProviders` не переведён на `/api/auth/me`

§6: «`AppProviders` перестаёт выводить роль из подстроки e-mail (`moder`/`owner`):
источник — `/api/auth/me`. `loginWithGoogle` вызывает `POST /api/auth/google` …
`demoUser` «Анна Морозова» из `AppProviders` убирается». Замер по
`web/src/components/providers/AppProviders.tsx` на `64ff363` (321 строка):

| Требование §6 | Факт | Строки |
|---|---|---|
| роль из `/api/auth/me` | `api/auth/me` — **0** вхождений; роль из подстроки почты | `:119-126` |
| `demoUser` «Анна Морозова» убран | присутствует и используется как основа пользователя | `:55-58`, `:122`, `:176` |
| `loginWithGoogle` зовёт `POST /api/auth/google` | `api/auth/google` — **0** вхождений | `:163-176` |
| фиктивная задержка 300 мс убрана | `await new Promise((r) => window.setTimeout(r, 300))` на месте | `:165` |
| `jwtDecode` только для мгновенной отрисовки аватара | из него берётся профиль целиком (`payload.email` обязателен, иначе отказ) | `:168-174` |

Практическое следствие: настоящий вход через Google на стенде невозможен —
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` не задан (кнопка на `/login` показывает
«Вход через Google недоступен»), а даже если бы был задан, клиент не обращается к
`POST /api/auth/google` и куки бы не получил. Бэкенд при этом готов и отвечает
503 ровно по плану (G.2).

### G.9. Находка: на `/login` нет формы «Вход для проверки»

§6: «рядом — отдельная форма «Вход для проверки» с полем токена; она не
притворяется основным способом аутентификации и не показывает подсказок с самим
токеном». Замер по HTML анонимного `/login` (35 545 байт):

| Маркер | Вхождений |
|---|---|
| `Google` | 1 |
| «Вход для проверки» | **0** |
| `токен` / `Токен` | **0** |
| `stand-tester-token`, `TESTER_TOKEN`, `CHANGE_ME` | **0** — сам токен не раскрыт, это правильно |

В `web/src/components/auth/AuthForm.tsx` (308 строк) ветки для токена нет: только
почта/пароль и `GoogleLogin` (`:260-292`). Кнопка Google видна всем — при
отсутствии `NEXT_PUBLIC_GOOGLE_CLIENT_ID` рисуется запасная кнопка
(`AuthForm.tsx:283-292`), что требованиям §6 соответствует.

Следствие, уже проявленное в этом прогоне: войти тестировщиком можно только
вручную через конс DevTools, потому что формы для токена в UI нет.

### G.10. Находка: два выставочных блока видны анониму

§6 относит к нерендерящимся для обычного посетителя: ««Выбор редакции», «часто
ищут», счётчики, уведомления в шапке, **контакты в подвале**, статистика «О
проекте», баннер «черновик»». §7 п.5 прямо требует, чтобы греп
`Палитра|Киберход|часто ищут|Выбор редакции|+373 777` дал **0 совпадений**
(кроме того, что реально лежит в БД). Замер на анониме:

| Маркер | Где | Аноним | Тестер | Оценка |
|---|---|---|---|---|
| `Киберход` | `/` | **0** | 4 | принято |
| `Выбор редакции` | `/` | **0** | 1 | принято |
| `Рекомендуем` | `/` | **0** | 1 | принято |
| `Грация` | `/` | **0** | 4 | принято |
| **«Часто ищут»** | `/` | **1** | 1 | **нарушение §6 и §7 п.5** |
| **`+373 777 00 000`** | все 12 маршрутов | **2 на каждом** | 2 | **нарушение §6 (контакты в подвале)** |
| `Палитра` | `/`, карточка, организация | 6 / 25 / 16 | 12 / 25 / 16 | в БД лежит настоящая «Студия рисования «Палитра»» — исключение §7 п.5; на `/` разница 6→12 объясняется моками |

**«Часто ищут»** отрисовано в DOM анонима, а не только лежит в потоке:
`<span>Часто ищут:</span><button>танцы</button><button>футбол</button><button>робототехника</button>…`
(блок `heroQuick`). Регистр важен: §7 п.5 грепает `часто ищут` строчными, и
строчных вхождений 0 — но это не отменяет нарушения, так как §6 запрещает сам
блок.

**Контакты в подвале** — `+373 777 00 000` и `hello@talentro.md` — присутствуют на
всех маршрутах, включая `/login` и `/register`, где карточек нет вовсе. Это
именно выставочный номер: телефон карточки в БД — `+373 777 12345`, другой. То
есть маркер §7 п.5 `+373 777` на этом стенде ловит подвал, а не базу, и
«исключение для того, что лежит в БД» здесь не применимо.

### G.11. Находка: карточка занятия показывает анониму отзывы и голоса

§6: «`/activities/[slug]` | `GET /api/cards/{id}`; **блока отзывов, «похожих» и
голосов нет**». Замер на анонимном `/activities/tiraspol-studiya-palitra`:

| Блок | Вхождений | Оценка |
|---|---|---|
| «Похожие» | **0** | принято |
| блок отзывов | «Отзывы (0)», «Написать отзыв», «Отзывов пока нет», «Написать первый отзыв», `reviewDisclaimer` | **нарушение §6** |
| голоса | `voteButtons`, «Голосов нет», «Не подошло **0**», `voteSideNote` | **нарушение §6** |

Отдельно и важно: **это не утечка моков**. Данные в потоке настоящие —
`"votesPlus":0,"votesMinus":0,"reviews":[]` при `"updatedAt":"2026-11-04T19:24:50.135484+02:00"`,
то есть из БД стенда. Нарушено не «аноним не получает моки», а «аноним не
получает эти блоки вообще». `web/src/app/activities/[slug]/page.tsx` не вызывает
`readView()` (G.3), поэтому `ActivityDetail` рисуется одинаково для всех.

### G.12. Принятые пункты §7 на стенде

| Пункт §7 | Статус | Основание |
|---|---|---|
| п.1 идемпотентность `init.sql` | **не выполнялся мной** | требует записи на `:55432`, а правило координатора — только GET/`SELECT`. Нужен Агент 1 или координатор |
| п.2 полнота полей | **принято частично** | `price`, `category`, `org_id`, `city` заполнены у всех 8; `district` = `null` у 4 из 8 — см. ниже |
| п.3 карточка целиком | **принято** | `/api/v1/activities/tiraspol-studiya-palitra`: `locations[]` (1), `groups[]` (2, со `schedules`), `organization` (объект, 11 ключей) |
| п.4 404 на непубликованное | **принято** | `kamenka-kulinariya-podrostki` (on_moderation), `slobodzeja-legkaya-atletika` (rejected), несуществующий слаг — по 404 и на API, и на фронте; legacy `/api/cards/7` и `/api/cards/999` — 404 |
| п.5 аноним без моков | **принято частично** | `/`, `/map`, `/favorites` — 0 мок-слагов; провалы на `/organizations/*` (G.4), справочниках `/map` (G.5), «Часто ищут» и подвале (G.10) |
| п.6 тестер с моками | **принято частично** | `/` — 20 мок-вхождений против 0; остальные 11 маршрутов побайтово равны анониму (G.3) |
| п.7 метки карты | **не принят** | 0 меток при ожидаемых 9 (G.6) |
| п.8 статические гейты | **не измерялся на ревизии стенда** | гейты в Разделе A прогнаны на `b9b34c5`/`03d854e`, а стенд держит `64ff363` из другой ветки; `next build` по-прежнему ждёт окна |

**По п.2, `district`.** Разрыв в сиде, а не в API. В `districts` 4 строки, все с
`city_id=1` (Тирасполь): `Центр`, `Балка`, `Населёнка`, `Тарновка`. У точек
Бендер (`city_id=2`), Рыбницы (3) и Дубоссар (4) `district_id IS NULL`, поэтому
API честно отдаёт `null`:

```
tiraspol-studiya-palitra      loc 1  city 1  district 1   -> «Центр»
tiraspol-futbol-detyam        loc 2  city 1  district 3   -> «Населёнка»
bendery-robototekhnika        loc 4  city 2  district NULL
rybnitsa-podgotovka-k-shkole  loc 6  city 3  district NULL
dubossary-shakhmaty           loc 7  city 4  district NULL
```

`price=0` у `dubossary-shakhmaty` и `tiraspol-futbol-detyam` незаполненным не
считается: по §10.3 это «бесплатно», и `?free=1` отбирает именно их (G.1 п.6).

**Пустой результат (§3.1.8).** `?q=палитра&city=bendery` даёт 0 карточек, и
состояние чистое: мок-слагов 0, `activityCard` 0, блока «Рядом по теме» нет,
текст «…ничего не нашл…» с действиями «Сбросить фильтры» / «Оставить заявку».
Неизвестный параметр `?nomatch=zzz` игнорируется и отдаёт все 8 карточек.

### G.13. Что в этом прогоне не проверено

| Не проверено | Почему |
|---|---|
| §7 п.1 (два прогона `init.sql`) | запись в БД запрещена правилом «только GET» |
| §7 п.8 на ревизии `64ff363` | гейты требуют рабочего дерева стендовой ветки и окна на `next build` |
| §7 п.7 в браузере (видимая область не сбрасывается при смене фильтра) | нужен живой браузер; серверных меток нет вовсе (G.6), так что проверять пока нечего |
| клиентское состояние `/favorites`, `/account`, `/moderation` после гидратации | HTML снят без выполнения JS; гейты этих страниц клиентские (G.7) |
| CORS с куками (§4, точный Origin вместо звёздочки) | в этом прогоне не запрашивался; остаётся в C3 |
| `?org=` / `?org_slug=` | решено координатором 18:00 как игнорируемые |

### G.14. Сводка для Агента 1 и координатора

Принято без замечаний: вход тестировщика, `set-cookie` через прокси (дефект
`64ff363` закрыт), `/api/auth/me`, logout, отклонение битой и подделанной куки,
503 на Google без `GOOGLE_CLIENT_ID`, канонический список из 8 анкет, все три
фильтра на API и на фронте, 404 на непубликованное и несуществующее, карточка
целиком с `locations[]`/`groups[]`/`organization`, чистое пустое состояние.

Открыто, с распределением ответственности:

| # | Находка | Ответственный |
|---|---|---|
| G.3 | `readView()` вызывается только из `page.tsx:39` — 11 из 12 маршрутов не знают о сессии | Агент 1 |
| G.4 | `/organizations/[slug]` целиком на моках, ссылка ведёт в 404 | Агент 2 (нет `/api/v1/organizations/{slug}`) + Агент 1 (страница) |
| G.5 | `/map` передаёт анониму моковые справочники | Агент 1 |
| G.6 | карта теряет настоящие координаты; `catalogMarkers` работает только по мокам; `api-server.test.ts:288` закрепляет `null` → `0` | Агент 1 |
| G.7 | `/account`, `/moderation` — 200 и клиентский гейт по подстроке почты вместо 404-экрана §6 | Агент 1 |
| G.8 | `AppProviders` не переведён на `/api/auth/me`, `demoUser` и 300 мс на месте | Агент 1 |
| G.9 | на `/login` нет формы «Вход для проверки» | Агент 1 |
| G.10 | «Часто ищут» и контакты в подвале видны анониму | Агент 1 |
| G.11 | отзывы и голоса на карточке видны анониму | Агент 1 |
| G.12 | §7 п.7 — 0 меток; п.1 и п.8 не выполнены; `district` не засеян вне Тирасполя | Агент 1 / Агент 2 (сид) / координатор (окна) |

Реализацию не правил — только измерял. Артефакты прогона лежат в
`.audit-tmp/stand/` (каталог в `.gitignore`): снятые HTML по каждому маршруту
в `pages/`, JSON канонического API, `leak-all-routes.txt`, `filters-summary.txt`,
`map-coords.txt`, `org-discriminator.txt`, `detail-markers.txt`, `p2-fields.txt`.

---

## Раздел H. Иконки категорий (дефект «одинаковые заглушки»), приёмка 22:10–23:10

Дефект заявил пользователь: у многих категорий на витрине одинаковые иконки-заглушки
вместо плана дизайнера. Заявленная причина — `web/src/components/ui/Icon.tsx` не
знал канонические имена (`run`, `book`, `paw`, `map`, `hands`, `dots`, `dance`,
`yarn`, `chef` и т.д.) и падал в `Shapes`. Правка готовилась в worktree
`D:\CyberSprint\.worktrees\integration`, затем стенд `:3000` пересобран.

**Статус: правка влита и пересобрана, все три проверки координатора приняты.**
Пометка «ожидает пересборку» не требуется.

### H.1. Проверка 1 — у каждой категории `/api/v1/categories` непустой `icon`

```bash
curl -s "http://26.52.103.163:8080/api/v1/categories" -o .audit-tmp/stand2/categories.json
```

Замер 23:02, ответ 7 058 байт, HTTP 200. Ответ — **список из 9** узлов верхнего
уровня, у каждого есть `children`. Ключи элемента:
`children, icon, id, kind, name, order_num, slug`.

| Показатель | Значение |
|---|---|
| узлов верхнего уровня | 9 |
| категорий всего (все уровни) | **63** |
| с пустым или отсутствующим `icon` | **0** |
| уникальных значений `icon` | 53 |

**Принято.** Полный разбор по уровням — в `.audit-tmp/stand/icons-api.txt`.

Сравнение со снимком 22:02 (`.audit-tmp/stand-gaps/_api_v1_categories.json`,
3 686 байт): тогда было 33 категории, и у всех 9 верхних узлов `children` пуст.
Сейчас 63 категории, `children` заполнены (5–6 у каждого узла). Значения `icon`
у 33 общих слагов **не изменились ни у одного** — то есть рост дерева не
подменял иконки, а добавлял уровни.

### H.2. Проверка 2 — верхний уровень соответствует плану дизайнера

План дизайнера, переданный координатором:
`palette, dumbbell, cpu, graduation-cap, paw-print, mountain, wrench, users, layout-grid`.

| Узел | `slug` | `icon` из API |
|---|---|---|
| Творчество и искусство | `creative-arts` | `palette` |
| Спорт и физическая активность | `sport-fitness` | `dumbbell` |
| Технологии и игры | `tech-games` | `cpu` |
| Обучение и занятия для детей | `learning-kids` | `graduation-cap` |
| Животные и природа | `animals-nature` | `paw-print` |
| Путешествия и активный отдых | `travel-outdoor` | `mountain` |
| Практические навыки | `practical-skills` | `wrench` |
| Социальная деятельность | `social-activity` | `users` |
| Другое | `other` | `layout-grid` |

Сверка списком в Python: `tops == plan` → **`True`**, то есть совпадают **и
значения, и порядок**. **Принято.**

### H.3. Проверка 3 — в SSR `:3000` разные классы `lucide-*` и нет `lucide-shapes`

Снято анонимно 23:00, артефакты в `.audit-tmp/stand2/new_*.html`.

| Маршрут | Байт | `lucide-shapes` | Уникальных `lucide-*` |
|---|---|---|---|
| `/` | 130 133 | **0** | 44 |
| `/map` | 61 250 | **0** | 37 |
| `/activities/tiraspol-studiya-palitra` | 53 034 | **0** | 26 |
| `/organizations/studiya-palitra` | 57 819 | **0** | 22 |

На `/` всего 127 вхождений `lucide-*`. Ровно **20 слотов `CategoryIcon`**
(признак — `stroke-width="1.7"`, значение по умолчанию в `CategoryIcon`,
`371738d:web/src/components/ui/Icon.tsx:154-166`), по два на каждый из 10 пунктов ряда категорий
(9 направлений + «Все направления»): один в `.filterCategoryIco` (16 px), второй
в `.categoryTile` (27 px). Распределение:

`palette 2, dumbbell 2, cpu 2, graduation-cap 2, paw-print 2, mountain 2,
wrench 2, users 2, layout-grid 4`

Все 9 иконок плана присутствуют. `layout-grid` даёт 4, потому что этим же именем
отрисован пункт «Все направления». В общей странице `users` встречается 11 раз и
`layout-grid` 4 раза — лишние вхождения приходятся на другие элементы интерфейса,
а не на категории; среди 20 слотов `CategoryIcon` каждое имя учтено выше.

**Принято.** Ни одной заглушки `Shapes` в SSR четырёх маршрутов.

### H.4. Baseline дефекта: сколько категорий падало в заглушку до правки

Сравнение источников (не живых замеров — стенд к моменту замера уже пересобран):

| Ревизия | Файл | Ключей в `iconMap` |
|---|---|---|
| `64ff363` | `web/src/components/ui/Icon.tsx` (119 строк) | **49** |
| `371738d` (= `f2d2843`, файл идентичен побайтово) | тот же (167 строк) | **79** |

Добавлено 30 ключей:
`backpack, ball, basketball, book, chef, chess, cube, dance, dots, fist, flower,
globe, gym, hands, landmark, logic, map, nail, paw, robot, run, saw, speech, tool,
truck, user, volleyball, water, yarn, yoga`.

Фолбэк в обеих ревизиях одинаков — `const Icon = iconMap[name] ?? Shapes;`
(`64ff363`:117-118, `371738d`:165-166). Прогон 63 канонических значений `icon`
через оба словаря:

| Показатель | До правки | После |
|---|---|---|
| категорий, падающих в `Shapes` | **29 из 63** | **0 из 63** |
| уникальных неразрешающихся имён | 27 | 0 |

27 имён, которые не знала старая карта:
`backpack, ball, basketball, book, chef, chess, cube, dance, fist, flower, globe,
gym, hands, landmark, logic, nail, robot, run, saw, speech, tool, truck, user,
volleyball, water, yarn, yoga`.

Кросс-проверки на актуальной карте (79 ключей):

- 53 уникальных значения `icon` из `/api/v1/categories` — **0** неразрешающихся;
- моки `web/src/lib/data.ts`: 58 вхождений `icon:`, 47 уникальных имён — **0**
  неразрешающихся (`data.ts` между `64ff363` и `371738d` не менялся,
  `git diff --stat` по этому пути пуст);
- 26 ключей карты каноном API не используются — они обслуживают моковый словарь
  витрины, это ожидаемо и defect-ом не является.

**Единственное наблюдаемое отличие SSR до/после на `/`.** Сравнение снимка 21:58
(`home-anon.html`, build `V6yuY2BIoA-J66bW_EwJP`) со снимком 23:00
(`new_.html`, build `16vM8sVQvPyQBYZGrgMcr`):

- `lucide-map`: **4 → 2**; `lucide-mountain`: **0 → 2**; больше не изменился ни
  один счётчик;
- исчезнувшие два `lucide-map` — это слоты `CategoryIcon` (16 px и 27 px,
  `stroke-width="1.7"`) категории **«Путешествия и активный отдых»**, на их месте
  теперь `lucide-mountain` (контекст в `.audit-tmp/stand2/icons-slot-context.txt`);
- оставшиеся два `lucide-map` (`stroke-width="2"`, 27 px и 20 px) — ссылка
  `.categoryTile--map` на `/map` и вкладка `.mobileTab` «Карта»; они к категориям
  не относятся и остались без изменений, так что падение счётчика не регрессия.

Важная оговорка о provenance. API отдавал `icon: "mountain"` для `travel-outdoor`
**и в 22:02, и в 23:02**, а `64ff363:web/src/components/ui/Icon.tsx` содержит
`mountain: Mountain` (:86) и ключа `map` не содержит вовсе. Значит сборка,
обслуживавшая `:3000` в 21:58, отрисовала `Map` на имени `mountain`, чего дерево
`64ff363` дать не может. Вывод: **web-сборка стенда в 21:58 не совпадала по
`Icon.tsx` с `64ff363`**; точная ревизия не восстанавливается, известен только
build ID. Фикс прокси входа из `64ff363` при этом на стенде работал (G.2, I.2),
так что расхождение касается именно `Icon.tsx`. На выводы разделов G и H это не
влияет, но утверждать «стенд держал `64ff363` целиком» я не могу. Косвенное
подтверждение — в `docs/acceptance/stand-gaps-2026-11-04.md` (прогон 22:02–22:15)
зафиксировано, что наблюдаемое поведение стенда совпадает с `a81745b`, а не с
`64ff363`, и что подтвердить ревизию сборки метаданными нельзя.

### H.5. Доказательство, что стенд пересобран

- build ID в RSC-потоке сменился: `V6yuY2BIoA-J66bW_EwJP` → `16vM8sVQvPyQBYZGrgMcr`;
- размер `/` вырос: 126 181 → 130 133 байт (119 642 → 123 205 символов);
- в отданном чанке `.audit-tmp/stand/js/42nxh8fr4v5dr.js` (скачан 22:18, 31 958
  байт) лежит развёрнутый объект карты, и все 30 новых ключей в нём есть —
  проверено поиском `mountain:eS`, `map:eA.f`, `run:ec`, `book:A`, `paw:e$`.

HEAD integration-worktree на момент приёмки — `371738d` («15: приёмка иконок
категорий — скрипт и отчёт»), между `64ff363` и ним также `a81745b`, `9f10e6b`,
`f2d2843`, `733ea1e`, `095ebd1`.

### H.6. Что по иконкам не проверено

- Отрисовка **после гидратации** в браузере: все замеры — по SSR-разметке. Клиентский
  `CategoryIcon` берёт тот же `iconMap`, но живой снимок DOM не делался.
- Визуальное соответствие плану дизайнера для **всех 63** категорий: сверены
  программно 9 верхних (H.2) и разрешимость 53 уникальных имён (H.4). Соответствие
  конкретной иконки конкретному подобразделу (например `reading` → `book` и
  `speed-reading` → `book`, то есть две разные категории с одной иконкой) дизайнером
  не подтверждалось — это вопрос к плану дизайнера, а не к коду.
- `/map`, `/organizations/[slug]` и карточка занятия: `lucide-shapes` = 0 (H.3), но
  эти страницы построены на моках (G.4, G.5), поэтому их иконки не являются
  каноническими категориями.

---

## Раздел I. Повторный прогон на пересобранном стенде, 23:00–23:15

Цель — убедиться, что пересборка (H.5) не отменила находки раздела G и не сломала
цикл сессии. Прогон выполнен параллельно двумя подагентами: маршруты и организации,
сессия и роли. Артефакты в `.audit-tmp/stand2/`, `.audit-tmp/stand3/`,
`.audit-tmp/stand4/`. Ограничения соблюдены: к `:8080` только GET, `:55432` и
`:8081` не тронуты, ничего не перезапускалось, POST только к `:3000/api/auth/*`.

### I.1. Маршруты: отличия от снимков 21:52–22:10

| Маршрут | Код | Байт 21:59 | Байт 23:0x | Различающихся регионов | Что различается |
|---|---|---|---|---|---|
| `/about` | 200 | 129 916 | 129 916 | 2 | только build ID |
| `/account` | 200 | 29 242 | 29 242 | 2 | только build ID |
| `/favorites` | 200 | 29 261 | 29 261 | 2 | только build ID |
| `/login` | 200 | 38 425 | 38 425 | 2 | только build ID |
| `/register` | 200 | 40 011 | 40 011 | 2 | только build ID |
| `/request` | 200 | 39 623 | 39 623 | 2 | только build ID |
| `/moderation` | 200 | 29 049 | 29 049 | 2 | только build ID |
| `/activities/tiraspol-studiya-palitra/reviews` | 200 | 37 130 | 37 130 | 2 | только build ID |
| `/organizations/studiya-palitra` | 200 | 57 819 | 57 819 | 2 | только build ID |
| `/map` | 200 | 61 250 | 61 250 | 2 | только build ID |
| `/activities/tiraspol-studiya-palitra` | 200 | 53 034 | 53 034 | 2 | только build ID |
| `/` | 200 | 126 181 | 130 133 | — | build ID + иконки (H.4) |

«2 региона» — это одно логическое изменение: старый и новый build ID равны по
длине и совпадают в одном символе, поэтому побайтовый diff раскалывает поле
`"b":"…"` на два региона. Иных отличий нет.

Следствие: **G.4, G.5, G.6, G.7, G.10, G.11 подтверждены на актуальной сборке**,
а не только на снимках 21:52–22:10. Точечно перепроверено:

- G.5: на новом `/map` те же 6 мок-слагов справочника по 1 вхождению
  (`kompyuternye-igry`, `nastolnye-igry`, `3d-dizain`, `skorochtenie`,
  `uhod-za-zhivotnymi`, `kinologiya`) и 0 слага БД (`chess`, `drawing`, `football`,
  `robotics`, `school-prep`, `tutoring`);
- G.6: на новом `/map` по-прежнему 0 пар координат и 2 вхождения строки
  «Бэкенд пока не отдаёт координаты точек…»;
- G.4: на новом `/organizations/studiya-palitra` по-прежнему 4 вхождения
  `hudozhestvennaya-studiya-palitra`.

Мок-слаги занятий (28 имён из `web/src/lib/data.ts`) на новых снимках:
**0** на всех маршрутах, кроме `/organizations/studiya-palitra` — **4** (G.4).

### I.2. Цикл сессии тестировщика — принят полностью (7/7)

| Шаг | Ожидание | Факт | Статус |
|---|---|---|---|
| `POST :3000/api/auth/tester` `{"token":"stand-tester-token"}` | 200 + `set-cookie` | 200, `talentro_session=eyJ1aWQiOj…; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`; тело `{"authenticated":true,"tester":true,"role":"tester","name":"Тестировщик","email":"tester@localhost","provider":"token"}` | **принято** |
| `GET :3000/api/auth/me` с кукой | `authenticated:true,tester:true` | 200, тот же JSON | **принято** |
| `GET :3000/` тестер vs аноним | тестер больше | 176 888 vs 130 133 байт (164 762 vs 123 205 символов), Δ 41 557 символов | **принято** |
| Мок-слаги на `/` (критерий §6) | аноним 0, тестер >0 | аноним **0**, тестер **20** | **принято** |
| `POST :3000/api/auth/logout` | 204 + гашение куки | 204, `talentro_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`; затем `/me` → `{"authenticated":false,"tester":false}` | **принято** |
| `POST tester` с неверным токеном | 401/403, куки нет | **401**, тело `неверный токен` (text/plain), в jar записей нет | **принято** |
| `GET :3000/api/auth/anything-else` | 404 | **404**, `{"error":"Неизвестный метод авторизации"}` | **принято** |

`Secure` в куке отсутствует — ожидаемо для HTTP-стенда; для публичного выпуска за
TLS это надо пересмотреть (отдельная находка, не §7).

20 мок-слагов у тестера раскладываются так: `palitra 3, lapki 3, chempion 3,
kiberhod 3, massag-spa-ritual 4, tancevalnaya-graciya 4`, остальные 22 слага — 0
(на главной не рендерятся). Число 20 совпадает с замером 21:58, то есть
пересборка поведение границы §6 на `/` не изменила.

### I.3. Организация и канонические фильтры

`GET :8080/api/v1/organizations/studiya-palitra` → **200**, реальные данные:
`organization.id=1`, `name` = **«Студия рисования «Палитра»»**, Тирасполь,
тел. `+373 777 12345`, одно занятие `tiraspol-studiya-palitra`, `total=1`.

Страница `:3000/organizations/studiya-palitra` при этом построена **на моках**:
моковое название «Художественная студия «Палитра»» — 14 вхождений, бэкендовое
«Студия рисования «Палитра»» — **0**, бэкендовый телефон — **0**, три ссылки на
мок-слаг `/activities/hudozhestvennaya-studiya-palitra`. Это усиление G.4:
расхождение не только в ссылках, а в самом содержании организации — API по тому
же слагу отдаёт другую организацию.

`GET :3000/activities/hudozhestvennaya-studiya-palitra` → **404** (19 385 байт).
Слаг встречается в ответе 2 раза — это эхо запрошенного URL в тексте not-found,
а не мок-контент.

Канонические фильтры (только GET, кириллица percent-encoded):

| Фильтр | Код | Элементов |
|---|---|---|
| `/api/v1/activities?q=%D0%BF%D0%B0%D0%BB%D0%B8%D1%82%D1%80%D0%B0` | 200 | **1** |
| `/api/v1/activities?city=bendery` | 200 | **2** |
| `/api/v1/activities?free=1` | 200 | **2** |

Все три совпадают с G.1 (строки 4–6). **Принято.**

### I.4. Место под повторную приёмку после мержа `feat/15` → `integration`

Координатор предупредил, что после мержа стенд будут пересобирать. Раздел
заполняется в следующем прогоне; до заполнения считается **не проверенным**, а не
проваленным.

| № | Что проверить | Команда / признак | Ожидание | Факт | Статус |
|---|---|---|---|---|---|
| R1 | HEAD integration-worktree и build ID стенда | `git -C .worktrees/integration log --oneline -3`; build ID в RSC-потоке `/` | новый build ID ≠ `16vM8sVQvPyQBYZGrgMcr` | _ | _ |
| R2 | Иконки не деградировали | H.1–H.3 целиком | 63 категории, 0 пустых `icon`, `tops == plan`, `lucide-shapes` = 0 на 4 маршрутах | _ | _ |
| R3 | Цикл сессии | I.2 целиком | 7/7 | _ | _ |
| R4 | Граница §6 на `/` | I.2, строка про мок-слаги | аноним 0, тестер ≥ 20 | _ | _ |
| R5 | G.4 `/organizations/[slug]` | мок-слаги и название организации в HTML | решение по находке применено или находка подтверждена повторно | _ | _ |
| R6 | G.5 `/map` моковые справочники | 6 мок-слагов / 6 слага БД | решение применено или находка подтверждена | _ | _ |
| R7 | G.6 метки на карте (§7 п.7) | число пар координат в ответе `/map` | 9 меток после подключения `catalogMarkers` к API | _ | _ |
| R8 | §7 п.8 статические гейты на новой ревизии | `go vet ./...`, `go test ./...`, `npx tsc --noEmit`, `npx vitest run`, `npx eslint src`, `npx next build` | все 0/ok | _ | _ |

R8 требует окна на `next build` (правило 3) — сам не запускаю.

---

## Куда отправлять находки

Находку оформлять так, чтобы её можно было применить без дополнительных вопросов:

1. Путь и номер строки (`web/src/app/page.tsx:109-112`).
2. Что измерено, с числом и временем замера.
3. Какой пункт спеки или канона нарушен (`§6`, `§7 п.5`, `C2`).
4. Команда, которой воспроизводится.

Получатели: Агент 1 (реализация) и координатор (сессия «Координатор»,
`ef5b4412`). Реализацию не править.
