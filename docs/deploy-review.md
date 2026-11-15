# Ревью деплой-комплекта Talentro

- Дерево: `D:\CyberSprint\.worktrees\integration`
- Ветка: `feat/15-16-integration`
- Проверяемый коммит: `d00e928` (на момент проверки; `+` локальный docs-коммит `59b3ed5`)
- Дата: 2026-11-05
- Режим: **только статическая проверка**. Docker-демона на машине нет, контейнеры
  не запускались, серверы не трогались, продукт не менялся.
- Что реально выполнялось: чтение файлов, разбор `docker-compose.yml` парсером
  `js-yaml` из `web/node_modules`, сверка путей и переменных по коду, ручная
  трассировка маршрутов Caddy. Сборка образов и `docker compose up` **не**
  выполнялись, поэтому статус PASS ниже означает «файл согласован», а не «стек
  поднимется».

Сводка: **31 PASS, 14 FAIL, 12 РИСК** (всего 57 проверок).

## 1. `docker-compose.yml`

| № | Проверка | Ожидание | Факт | Статус |
| --- | --- | --- | --- | --- |
| 1 | YAML-синтаксис | Разбирается без ошибок | `js-yaml` разобрал; сервисы `db`, `api`, `web`, `caddy` | PASS |
| 2 | Публикация портов | Наружу только 80/443 | `db`, `api`, `web` — `ports` нет; `caddy` — `80:80`, `443:443`, `443:443/udp` | PASS |
| 3 | Секреты через `${VAR:?}` | Критичные переменные без значения останавливают compose | `POSTGRES_USER/PASSWORD/DB`, `MODERATOR_TOKEN`, `SESSION_SECRET`, `NEXT_PUBLIC_API_URL`, `DOMAIN` — с `:?`; необязательные — с `:-` | PASS |
| 4 | Healthcheck `db` | `pg_isready`, старт 20 с | `docker-compose.yml:58-66`, `CMD-SHELL` с экранированием `$$` | PASS |
| 5 | Healthcheck `api` | `/health`, порт из `PORT` | В compose своего блока нет, но в образе есть `HEALTHCHECK` (`backend/Talentro/Dockerfile:42-43`), поэтому статус контейнера считается | PASS |
| 6 | Healthcheck `web` | Быстрый эндпоинт, не зависящий от БД | `/sw.js`, файл `web/public/sw.js` существует | PASS |
| 7 | Healthcheck `caddy` | Живость прокси | Блока нет; в образе `caddy:2-alpine` тоже нет. `depends_on` использует `service_started`, `docker compose ps` покажет `running`, а не `healthy` | РИСК |
| 8 | `depends_on` | API ждёт здоровую БД, витрина — стартовавший API | `api → db: service_healthy`; `web → api: service_started`; `caddy → api/web: service_started`. Старт витрины до её готовности даёт короткое окно 502 от Caddy | PASS |
| 9 | Тома и медиа | `pgdata`, данные Caddy, медиа только на чтение | `pgdata`, `caddy_data`, `caddy_config`; `${MEDIA_HOST_DIR:-/srv/media}:/srv/media:ro` | PASS |
| 10 | Комментарий о витрине | Не утверждать, что `web/` нет | В шапке `docker-compose.yml:14-19` написано «в этой ветке каталога web нет» и «build web упадёт». Это ложь: `web/Dockerfile` и `web/.dockerignore` есть (коммит `095ebd1`) | FAIL |
| 11 | Комментарий о четырёх healthy | Все четыре сервиса healthy | `docker-compose.yml:9` обещает «все четыре healthy», но у `caddy` healthcheck нет (п. 7) | FAIL |
| 12 | `NEXT_PUBLIC_AUTH_URL` в сборке | Переменная из `.env.example` доходит до витрины | Не передаётся ни в `build.args` (`docker-compose.yml:104-106`), ни в `environment` (`:119-123`), ни в `web/Dockerfile:19-21`. При отдельном auth-сервисе настроить нельзя; при общем — работает fallback на `API_URL` | FAIL |
| 13 | Каталог медиа на хосте | Существует до запуска | `infra/setup-server.sh:128-130` создаёт `/srv/media`; если пропустить скрипт, Docker создаст пустой каталог от root | РИСК |

## 2. `backend/Talentro/Dockerfile`

| № | Проверка | Ожидание | Факт | Статус |
| --- | --- | --- | --- | --- |
| 14 | Стадии и non-root | Сборка в `golang`, запуск в минимальном образе, непривилегированный uid | `golang:1.27.2-alpine` → `alpine:3.22`, `USER 10001:10001`, без тулчейна | PASS |
| 15 | Путь бинарника и ENTRYPOINT | Совпадают | Сборка в `/out/talentro`, копия в `/app/talentro`, `ENTRYPOINT ["/app/talentro"]` | PASS |
| 16 | Версия в `/health` | `-ldflags` попадает в `handlers.Version` | `-X talentro/internal/delivery/http/handlers.Version=${VERSION}`, модуль `talentro` | PASS |
| 17 | Версия Go | Не ниже `go.mod` | `ARG GO_VERSION=1.27.2`, `go.mod` — `go 1.27.2` | PASS |
| 18 | Healthcheck | `/health` на `PORT`, 503 при недоступной БД | `wget --spider "http://127.0.0.1:${PORT:-8080}/health"` | PASS |
| 19 | `.dockerignore` и `.env` | `.env` не попадает в контекст | `.env`, `.env.*`, `*.pem`, `*.key` исключены; `.env` в git нет | PASS |

## 3. `web/Dockerfile`

| № | Проверка | Ожидание | Факт | Статус |
| --- | --- | --- | --- | --- |
| 20 | Стадии, `npm ci`, non-root | Зависимости ставятся в Linux-слое, запуск от `nextjs` | `deps`/`build`/`runtime`, `npm ci`, `USER nextjs` | PASS |
| 21 | Команда запуска | Совпадает с `package.json` | `CMD ["npm","run","start"]`, в `package.json` `start: next start` | PASS |
| 22 | Healthcheck | Живой статический файл | `fetch('/sw.js')`, файл есть (п. 6) | PASS |
| 23 | Состав runtime | `.next`, `node_modules`, `public`, конфиг | Всё копируется; `output: "standalone"` нет, поэтому образ большой, но работоспособный | PASS |
| 24 | Build args | Все публичные переменные, которые читает код | Есть `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; `NEXT_PUBLIC_AUTH_URL` нет (п. 12) | FAIL |
| 25 | `sharp` в проде | Оптимизатор `next/image` работает в alpine | `npm ci` в alpine ставит musl-сборку, `node_modules` копируется целиком; на реальном Docker не проверялось | РИСК |
| 26 | `.dockerignore` | `.env` не утекает | `web/.dockerignore` исключает `.env`, `.env.*`, `.next`, `node_modules` | PASS |
| 27 | Демо-флаг | На проде не включается | `NEXT_PUBLIC_DEMO_DATA` не передаётся ни в args, ни в env — по умолчанию выключен; включить в контейнере без правки compose нельзя | PASS |

## 4. `infra/Caddyfile`

| № | Проверка | Ожидание | Факт | Статус |
| --- | --- | --- | --- | --- |
| 28 | Домен | Переменная с безопасным локальным значением | `{$DOMAIN:localhost}` (`infra/Caddyfile:16`) | PASS |
| 29 | Маршрутизация | `/api` → API, `/media` → том, `/` → витрина | `handle /api/*` → `api:8080`; `handle_path /media/*` → `/srv/media`; `handle` → `web:3000` (`:39-58`) | PASS |
| 30 | Заголовки | `nosniff`, `Referrer-Policy`, скрыть серверные | Есть (`:31-36`); CSP и rate limit сознательно отсутствуют, это записано в комментарии | PASS |
| 31 | Синтаксис | Сбалансированные скобки, валидные директивы | 10/10 скобок, маршруты в правильном порядке; в комментарии `:55` опечатка «контейнераoccupied» | PASS |
| 32 | `/health` наружу | Не проксируется в API | Caddy не имеет отдельного маршрута, запрос уходит в витрину и получает 404; API доступен только внутри сети | PASS |
| 33 | Лог Caddy | Доступен с хоста так, как написано в docs | В `Caddyfile:19-24` лог внутри контейнера `/var/log/caddy/access.log`; в compose этот каталог не смонтирован, а `docs/deploy.md:288` предлагает `sudo tail` по хостовому пути — файла там не будет | FAIL |
| 34 | Второй caddy-compose | Не вводит в заблуждение | `infra/docker-compose.caddy.yml` поднимает только Caddy и проксирует на `api`/`web`, которых в этом стеке нет; файл выглядит как рабочий, но даёт 502 | РИСК |

## 5. `.env.example`

| № | Проверка | Ожидание | Факт | Статус |
| --- | --- | --- | --- | --- |
| 35 | Только имена, без секретов | Пустые значения, никаких реальных ключей | `POSTGRES_PASSWORD=`, `MODERATOR_TOKEN=`, `SESSION_SECRET=`, `TESTER_TOKEN=`, `GOOGLE_CLIENT_ID=`; плейсхолдеры `DOMAIN=talentro.example`, `NEXT_PUBLIC_API_URL=https://talentro.example` | PASS |
| 36 | Полнота по `internal/config` | Каждая читаемая переменная либо в `.env`, либо собирается compose | `PORT` задан в compose; `DATABASE_URL` собирается из `POSTGRES_*`; остальные семь имён есть. Пробег `os.Getenv` по `config.go:24-32` не нашёл пропусков | PASS |
| 37 | Совет по паролю БД | Достаточная энтропия и безопасная для URL строка | В `.env.example:19` предложен `openssl rand -base64 24` — это 18 байт и символы `+`, `/`, `=`; в `DATABASE_URL` они допустимы, но при ручном копировании легко обрезать. Надёжнее `openssl rand -hex 32` | РИСК |
| 38 | `NEXT_PUBLIC_AUTH_URL` | Обещание подкреплено проводкой | Имя есть в `.env.example:62`, но compose/Dockerfile его не передают (п. 12) | FAIL |

## 6. `docs/deploy.md` и `infra/setup-server.sh`

| № | Проверка | Ожидание | Факт | Статус |
| --- | --- | --- | --- | --- |
| 39 | Запуск скрипта подготовки | Команда соответствует shebang/синтаксису | `docs/deploy.md:28` — `sh /root/setup-server.sh`; скрипт использует `set -euo pipefail` (`infra/setup-server.sh:8`) и `&>` (`:35`), то есть требует bash. На Ubuntu `/bin/sh` — dash, скрипт упадёт в начале | FAIL |
| 40 | Доступ по SSH после подготовки | Владелец не теряет доступ | `infra/setup-server.sh:50` содержит один захардкоженный ключ, `:41` даёт `deploy` полный `NOPASSWD:ALL`, root-вход и пароли отключаются. Если ключ не владельца — lockout | РИСК |
| 41 | Первый запуск: код на сервере | Есть шаг получения репозитория | `docs/deploy.md:57`, `:231`, `:247` начинают с `cd /srv/app && git pull`, но `git clone` нигде нет; `setup-server.sh:128` только создаёт пустой каталог. На чистом сервере `git pull` упадёт | FAIL |
| 42 | `psql`/`pg_dump` в документации | Переменные БД доступны оболочке | `$POSTGRES_USER`/`$POSTGRES_DB` берутся из `.env`, но `.env` не экспортируется: `docs/deploy.md:205`, `:212-213`, `:223`, `:240`. В интерактивной оболочке переменные пусты | FAIL |
| 43 | Проверки целостности как гейт | Ненулевой код возврата при ошибках | `docs/deploy.md:223` использует `ON_ERROR_STOP=0`; `database/checks.sql:240` в конце бросает `RAISE EXCEPTION`, но psql без `ON_ERROR_STOP=1` завершится успешно. Автоматика не увидит FAIL | FAIL |
| 44 | Комментарий после `docker compose ps` | Соответствует фактическим статусам | `docs/deploy.md:234` — «db/api/caddy healthy, web running»; на самом деле `caddy` без healthcheck, а `web` как раз healthy (п. 6-7) | FAIL |
| 45 | Хвост лога Caddy | Путь существует на хосте | `docs/deploy.md:288` — `/var/log/caddy/access.log`; см. п. 33, каталог не смонтирован | FAIL |
| 46 | Фото и `next/image` | Документ описывает текущий код | `docs/deploy.md:180-188` и `:314` утверждают, что `/media` не проходят через `next/image` и нужна правка. В коде уже есть rewrite `/media/:path*` → `${NEXT_PUBLIC_API_URL}/media/:path*` (`web/next.config.ts:10,20-24`, `web/src/lib/media.ts:16-21`). Документ устарел и толкает на лишнюю правку | FAIL |
| 47 | Форма входа на витрине | Документ не отрицает готовый код | `docs/deploy.md:298-305` говорит, что формы email/пароль на фронте нет; `web/src/components/auth/AuthForm.tsx` её содержит, а BFF пропускает `login`/`register` (`web/src/app/api/auth/[...action]/route.ts:17`) | FAIL |
| 48 | Поведение без `NEXT_PUBLIC_API_URL` | Описано точно | `docs/deploy.md:171-176` говорит, что витрина «откатывается на моки». На деле главная показывает ошибку (`web/src/app/page.tsx:92-97`), а моки включаются только тестировщику или при `NEXT_PUBLIC_DEMO_DATA=1` (`web/src/lib/view-mode.ts:30-36`) | РИСК |
| 49 | TZ на существующем `pgdata` | Есть точная команда | `docker-compose.yml:34-36` упоминает `command: postgres -c timezone=...`, но `docs/deploy.md` не даёт ни команды, ни `ALTER DATABASE … SET timezone`. После создания тома смена `TZ` в compose не меняет пояс кластера | РИСК |
| 50 | Повторный `init.sql` на живой БД | Не перезаписывает боевые данные | `database/init.sql` идемпотентен по DDL, но сиды вставляют демо-организации/карточки, а `:536-537` делают `UPDATE cards ... contacts_verified_at`. Транзакции верхнего уровня (`BEGIN`/`COMMIT`) нет. Дамп в `docs/deploy.md:212` обязателен, но эффект перезаписи в документе не описан | РИСК |
| 51 | Обновление и откат | Образы тегируются, тома не удаляются | `APP_VERSION` в именах образов; откат через `up -d` с прежним тегом; `down` не трогает `pgdata` (`docs/deploy.md:266-273`) | PASS |

## 7. Риски, не привязанные к одному файлу

| № | Проверка | Ожидание | Факт | Статус |
| --- | --- | --- | --- | --- |
| 52 | `NEXT_PUBLIC_*` в build | Оператор знает, что нужна пересборка | Значения вшиваются в бандл; в документации это сказано (`docs/deploy.md:158-169`), но проверка «что вшито» предлагает grep по HTML, а переменные лежат в JS-чанках | РИСК |
| 53 | SSR hairpin | Публичный origin доступен с самого сервера | SSR ходит в `NEXT_PUBLIC_API_URL`, то есть в Caddy на этом же хосте; при первом запуске нужны DNS и сертификат до сборки. В документе описано | РИСК |
| 54 | CORS при пустом `ALLOWED_ORIGINS` | Для одного домена безопасно | При `Caddy` и одном origin браузер ходит в `/api/*` same-origin, CORS не нужен; при витрине на Vercel пустое значение заблокирует чтение (`cors.go:20-27`) | PASS |
| 55 | `Secure`-кука за TLS | Caddy передаёт `X-Forwarded-Proto: https` | Caddy `reverse_proxy` делает это автоматически; бэкенд ставит `Secure` по заголовку (`session.go:139-141`). При прямом опубликованном `:8080` без прокси кука будет без `Secure` | PASS |
| 56 | Лимиты частоты | 10/мин вход, 3/час регистрация | Работают в памяти процесса (`auth_local.go:20-23`); Caddy rate limit отсутствует; при рестарте счётчики обнуляются, при нескольких копиях API не общие. Для одного VDS приемлемо | РИСК |
| 57 | `MODERATOR_TOKEN` | Не утекает клиенту | Передаётся только в `api`; публичных модераторских маршрутов нет. Обязательность в конфиге выше фактической необходимости — это осознанное решение | PASS |

## 8. Проверка фикса `SESSION_SECRET` (коммит `f11487c`)

Фикс закрыт полностью:

| Переменная | `internal/config/config.go` | `docker-compose.yml` | `.env.example` | `docs/deploy.md` §3 |
| --- | --- | --- | --- | --- |
| `SESSION_SECRET` | читается `:30`, обязательна `:42-44` | `api.environment`, `${SESSION_SECRET:?...}` | есть, `:33` | есть, `:65` |
| `TESTER_TOKEN` | читается `:31`, пусто = 503 | `api.environment`, `${TESTER_TOKEN:-}` | есть, `:36` | есть, `:66` |
| `GOOGLE_CLIENT_ID` | читается `:29`, пусто = 503 | `api.environment`, `${GOOGLE_CLIENT_ID:-}` | есть, `:39` | есть, `:67` |

Пробег всех `os.Getenv` в `internal/config` (единственное место чтения окружения
в Go-коде) не нашёл других переменных:

- `PORT` — compose задаёт `8080` явно;
- `DATABASE_URL` — compose собирает из `POSTGRES_*`, в `.env.example` есть
  комментарий про запуск вне контейнера;
- `ALLOWED_ORIGINS`, `MODERATOR_TOKEN`, `SESSION_SECRET`, `TESTER_TOKEN`,
  `GOOGLE_CLIENT_ID` — переданы.

Остались только два пограничных места, не связанных с этим фиксом:
`NEXT_PUBLIC_AUTH_URL` (web-переменная, не проводится через образ) и
`NEXT_PUBLIC_DEMO_DATA` (намеренно не передаётся, чтобы демо не включилось на
проде).

## 9. Исправления по приоритету

### P0 — без этого первый запуск не состоится

1. **`docs/deploy.md:28`** — заменить `sh /root/setup-server.sh` на
   `bash /root/setup-server.sh`. Скрипт не POSIX: `set -euo pipefail`
   (`infra/setup-server.sh:8`) и `&>` (`:35`).
2. **`infra/setup-server.sh:50` и `:41`** — не отключать root/пароли, пока не
   проверен вход по ключу владельца. Захардкоженный ключ заменить на ключ
   владельца (или параметр скрипта), `NOPASSWD:ALL` сузить до нужных команд.
3. **`docs/deploy.md:57`, `:231`, `:247`** — добавить шаг получения кода:
   `git clone <repo> /srv/app` (или `rsync`/`scp`), и только потом `git pull`.
   Сейчас на чистом сервере `git pull` в пустом `/srv/app` падает.

### P1 — команды из документа не работают или дают ложный результат

4. **`docs/deploy.md:205`, `:212-213`, `:223`, `:240`** — не полагаться на
   переменные хостовой оболочки. Либо `set -a; . /srv/app/.env; set +a` перед
   командами, либо выполнять внутри контейнера:
   `docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"'`.
5. **`docs/deploy.md:223`** — заменить `ON_ERROR_STOP=0` на `ON_ERROR_STOP=1`.
   `database/checks.sql:240` бросает исключение, и только этот режим даёт
   ненулевой код возврата; иначе проверки не являются гейтом.
6. **`docs/deploy.md:180-188` и `:314`** — переписать под текущий код: rewrite
   `/media` уже есть (`web/next.config.ts:20-24`), фото работают, если
   `NEXT_PUBLIC_API_URL` абсолютный и указывает на Caddy. Убрать совет менять
   `<img>`/`unoptimized`.
7. **`docs/deploy.md:298-305`** — обновить статус формы email/пароль: она есть
   (`web/src/components/auth/AuthForm.tsx`), эндпоинты и BFF работают.
8. **`docs/deploy.md:234`** — исправить ожидаемые статусы: `db/api/web healthy`,
   `caddy running` (healthcheck нет).
9. **`docs/deploy.md:288`** — заменить хостовый `tail` на
   `docker compose exec caddy tail -f /var/log/caddy/access.log` или смонтировать
   `/var/log/caddy` в compose.

### P2 — функциональные пробелы и вводящие в заблуждение файлы

10. **`web/Dockerfile:19-21` + `docker-compose.yml:104-106,119-123`** — добавить
    `NEXT_PUBLIC_AUTH_URL` в `ARG`/`ENV` и в args/environment, иначе переменная
    из `.env.example` ни на что не влияет. Если отдельный auth-origin не нужен —
    убрать её из `.env.example`, чтобы не обещать настройку.
11. **`docker-compose.yml:9,14-19`** — удалить устаревшие комментарии про
    отсутствие `web/` и «все четыре healthy».
12. **`infra/docker-compose.caddy.yml`** — либо удалить, либо пометить как
    «только заглушка», потому что `api`/`web` в этом стеке не определены и
    прокси даст 502.
13. **`docs/deploy.md:171-176`** — исправить описание пустого
    `NEXT_PUBLIC_API_URL`: это ошибка каталога, а не автоматические моки; моки
    только у тестировщика или при `NEXT_PUBLIC_DEMO_DATA=1`.
14. **`docs/deploy.md:74` / `docker-compose.yml:34-36`** — добавить точную
    команду смены пояса на существующем томе:
    `docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER DATABASE ... SET timezone TO 'Europe/Chisinau'"`,
    либо `command: postgres -c timezone=Europe/Chisinau` в compose.

### P3 — гигиена

15. **`.env.example:19`** — предложить `openssl rand -hex 32` вместо
    `-base64 24`: hex не содержит символов, требующих экранирования в URL.
16. **`infra/Caddyfile:55`** — исправить «контейнераoccupied».
17. **`docs/deploy.md:160-161`** — обновить ссылки на строки
    `web/src/lib/api.ts` (сейчас `apiBaseUrl` — `:225-227`, сборка URL — `:251`).
18. **`docs/deploy.md:178`** — проверку вшитого `NEXT_PUBLIC_API_URL` делать по
    JS-чанкам, а не по HTML: переменная лежит в бандле.

## 10. Отдельно: `init.sql` на живой базе

`docs/deploy.md:208-218` называет схему идемпотентной. Для DDL это верно, но
`database/init.sql` — не только DDL:

- `:443` вставляет демо-организации, `:505` — демо-карточки;
- `:536-537` делает `UPDATE cards SET contacts_verified_at = ...` для `id = 10`
  и `id = 5`, то есть меняет боевые строки;
- верхнего `BEGIN`/`COMMIT` нет, поэтому сбой посреди прогона оставит базу в
  частично обновлённом состоянии.

Дамп перед прогоном (`docs/deploy.md:212`) обязателен и должен быть проверен
(`gzip -t`, размер). Если на живой базе уже есть реальные данные, безопаснее
разделить `init.sql` на «схема» и «демо-сиды» либо прогонять только DDL-часть.
Пока этого нет, повторный прогон на боевой базе — риск перезаписи, а не
безобидная идемпотентность.

## 11. Чекпоинт

**Что проверено:** `docker-compose.yml` (YAML, сервисы, порты, healthcheck-и,
`depends_on`, тома), оба Dockerfile (стадии, non-root, healthcheck, пути, версия,
`.dockerignore`), `infra/Caddyfile` (домен, маршруты, заголовки, скобки),
`.env.example` (имена, полнота по `internal/config`), `docs/deploy.md` (команды
§1-§10), `infra/setup-server.sh`, `database/init.sql`/`checks.sql`, а также
фикс `SESSION_SECRET` (`f11487c`).

**Топ-5 рисков:**

1. `docs/deploy.md:28` + `infra/setup-server.sh:8,35,50` — `sh` вместо `bash` и
   захардкоженный SSH-ключ: скрипт либо не запустится, либо отрежет владельца.
2. `docs/deploy.md:57,231,247` — нет `git clone`, первый `git pull` в пустом
   `/srv/app` не работает.
3. `docs/deploy.md:205,212-213,240` — `$POSTGRES_USER`/`$POSTGRES_DB` не
   экспортированы, команды psql/pg_dump выполнятся с пустыми значениями.
4. `docs/deploy.md:223` + `database/checks.sql:240` — `ON_ERROR_STOP=0` не даёт
   упасть на ошибках целостности; проверки создают ложное «зелёное».
5. `database/init.sql:505-537` — повторный прогон на живой базе перезаписывает
   демо-данные и `cards` без транзакции.

Дополнительно: `NEXT_PUBLIC_AUTH_URL` не проводится через образ (P2), а
`docs/deploy.md` §4.2/§10 всё ещё описывает уже исправленные фото и форму входа
(P1).

**Что нужно от владельца:**

- VDS с публичным IP и SSH-доступом (для `setup-server.sh` и первого запуска);
- домен и A-запись на этот IP (для Caddy и TLS);
- решение по SSH-ключу: чей ключ остаётся в `authorized_keys`;
- право открыть 80/443 и подтверждение, что 8080/5432 не публикуются;
- куда выгружать бэкапы (`/srv/backups` на том же диске — не бэкап);
- файлы фото в `/srv/media` и пути, совпадающие с БД.

**Чего в этом отчёте нет:** фактического запуска контейнеров, проверки
healthcheck-ов в рантайме, сборки образов и проверки TLS. Docker-демона на
машине нет; всё выше — статическая сверка файлов. Первый запуск надо делать на
VDS и сверять с §6 `docs/deploy.md`, а не считать этот отчёт доказательством,
что стек поднимется.
