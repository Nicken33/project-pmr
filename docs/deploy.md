# Развёртывание Talentro на VDS

Комплект: `docker-compose.yml` (база, Go-API, витрина, Caddy), `backend/Talentro/Dockerfile`,
`infra/Caddyfile`, `.env.example`, `infra/setup-server.sh`. Сервисы поднимаются одним
`docker compose up -d`; наружу торчат только 80 и 443 — база и API сидят во внутренней
сети compose и в интернет не публикуются.

Проверено без Docker-демона (на машине его нет): синтаксис `docker-compose.yml` разобран
парсером YAML, команда сборки из `backend/Talentro/Dockerfile` реально прогнана
кросс-компиляцией `linux/amd64`, маршрутизация Caddyfile сведена вручную. Само поведение
контейнеров (healthcheck-ы, порядок старта, монтирования) на стенде не проверялось —
первый запуск делать на VDS и сверяться с §6.

| Сервис | Образ | Порт внутри сети | Наружу |
| --- | --- | --- | --- |
| `db` | `postgres:16` | 5432 | нет |
| `api` | `backend/Talentro/Dockerfile` | 8080 | нет |
| `web` | `web/Dockerfile` | 3000 | нет |
| `caddy` | `caddy:2-alpine` | 80, 443 | 80, 443, 443/udp |

## 1. Подготовка сервера (CYB-303)

Ubuntu 22.04 / 24.04 LTS, 2 ГБ RAM минимум (сборка Next ест память — см. §4.3).

```bash
scp infra/setup-server.sh root@<IP>:/root/
ssh root@<IP>
sh /root/setup-server.sh
```

Скрипт создаёт пользователя `deploy` (SSH по ed25519, root-вход и пароли отключены),
ставит UFW (разрешены 22, 80, 443), fail2ban, NTP, unattended-upgrades, 2 ГБ swap,
Docker Engine с Compose v2 и каталоги `/srv/app`, `/srv/media`, `/srv/backups`.

Проверка: `ssh deploy@<IP> && docker compose version && df -h /srv`.

## 2. Домен и HTTPS (CYB-304)

1. `A`-запись на `<IP>`: имя `@` или поддомен (например `talentro.example`). Дождитесь
   распространения: `dig +short talentro.example` должен вернуть IP сервера.
2. На сервере проверьте, что порт не занят чем-то ещё: `sudo ss -ltnp | grep -E ':80|:443'`.
3. Caddy стартует вместе со всем стендом (§6). Он сам получает и продлевает сертификат
   Let's Encrypt/ZeroSSL, HTTP→HTTPS включает автоматически.
4. Домен в конфигурацию приходит одной переменной `DOMAIN` (см. §3); `infra/Caddyfile`
   читает её как `{$DOMAIN:localhost}`, поэтому тот же файл годится для локальной
   проверки без домена.
5. `/health` наружу не проброшен: это служебный эндпоинт (§9.1), его проверяют внутри
   сети — `docker compose exec api wget -qO- http://127.0.0.1:8080/health`. Снаружи
   проверяйте каталог: `curl -s https://<домен>/api/v1/activities?limit=1`.

## 3. `.env`

Все настройки стенда — имена переменных из `.env.example`; значения только в `.env`,
который лежит в `.gitignore` и в репозиторий не попадает ни при каких обстоятельствах.

```bash
cd /srv/app && git pull
cp .env.example .env && chmod 600 .env
```

| Переменная | Кто читает | Примечание |
| --- | --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | контейнер `db` | `DATABASE_URL` для API compose собирает сам из этих трёх |
| `MODERATOR_TOKEN` | `api` | без него `internal/config` отказывает в старте; модераторские эндпоинты ещё не написаны, но старт без токена заблокирован намеренно |
| `SESSION_SECRET` | `api` | ключ HMAC-подписи куки `talentro_session`; без него `internal/config` отказывает в старте (§3.7). Смена секрета гасит все активные сессии — менять только осознанно |
| `TESTER_TOKEN` | `api` | токен демо-входа `POST /api/auth/tester`; пустой = вход отключён. На публичном контуре держать пустым |
| `GOOGLE_CLIENT_ID` | `api` | серверная проверка ID-токена Google; без неё вход через Google отвечает 400 даже при рабочей кнопке на витрине |
| `ALLOWED_ORIGINS` | `api` | пустой = междоменные запросы запрещены; при одном домене и Caddy не нужен |
| `DOMAIN` | `caddy` | домен из §2 |
| `APP_VERSION` | имена образов + `/health` | тег релиза, попадает в бинарник через `-ldflags` |
| `NEXT_PUBLIC_API_URL` | сборка и рантайм `web` | публичный origin, **без** `/api` на конце — например `https://talentro.example` (§4.1) |
| `NEXT_PUBLIC_SITE_URL` | сборка `web` | базовый URL для метатегов Open Graph |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | сборка `web` | Google OAuth; без него кнопка входа не рисуется |
| `TZ` | все контейнеры | `Europe/Chisinau`: «проверено за 90 дней» (§7.11) считается по `current_date` |
| `MEDIA_HOST_DIR` | `caddy` | каталог с фото на хосте, по умолчанию `/srv/media` |

Пароль базы и токен генерируйте на сервере, а не в редакторе: `openssl rand -hex 24`.
После правки `.env` полезно дать compose проверить сам: `docker compose config -q`
(сообщит о незаполненных переменных, потому что критичные помечены в compose как `:?`).

## 4. `web/Dockerfile` и публикация витрины

`docker-compose.yml` собирает витрину из `./web/Dockerfile`; оба файла (`Dockerfile`,
`.dockerignore`) лежат в каноническом дереве integration, ниже продиктовано их содержимое —
оно же служит спецификацией, если файл придётся пересоздавать. Проверку на реальном
Docker-демоне никто не выполнял: демона на машине разработки нет (§10.7).

Витрину можно вынести и отдельно от стека — на Vercel. Там живёт только `web/`, а
`NEXT_PUBLIC_API_URL` обязан указывать на этот же стек, публично и по HTTPS:
порядок и подводные камни — `docs/vercel.md`.

`web/.dockerignore`:

```
node_modules
.next
out
.env
.env.*
coverage
*.log
.git
Dockerfile
.dockerignore
```

`web/Dockerfile`:

```dockerfile
# Витрина Talentro (Next 16, App Router). Контекст — папка web.
#   docker build -t talentro-web web        # из корня репозитория
# NEXT_PUBLIC_* встраиваются в клиентский бандл на этапе build, поэтому адрес API
# меняется только пересборкой (см. docs/deploy.md §4.1).

ARG NODE_VERSION=24

# Зависимости ставятся внутри Linux-слоя: на хосте (Windows/macOS) npm ставит
# glibc-сборки sharp и @next/swc-*, а в alpine нужен musl.
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
# node_modules целиком: без `output: "standalone"` в next.config.ts рантайму нужен
# весь установленный пак.
COPY --from=build --chown=nextjs:nextjs /app/.next ./.next
COPY --from=build --chown=nextjs:nextjs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nextjs /app/next.config.ts ./next.config.ts
USER nextjs
EXPOSE 3000
# next start читает PORT (по умолчанию 3000); в compose PORT=3000 выставлен явно.
CMD ["npm", "run", "start"]

# Проверка живости не трогает главную: та тянет каталог из API и зависит от состояния
# базы, а /sw.js — статики из public.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/sw.js').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
```

### 4.1 `NEXT_PUBLIC_API_URL` печатается в бандле

`web/src/lib/api.ts:226` читает `NEXT_PUBLIC_API_URL`, а `:249` собирает из неё
абсолютный URL. Дальше расходятся два мира:

- **браузер** получает значение, вшитое в JS во время `next build` (это и значит
  «встраивается на этапе build») — менять его можно только пересборкой образа,
  поэтому адрес надо передать в `build.args` до `docker compose build`;
- **серверный рендер** читает переменную в рантайме, но тем же значением, то есть
  ходит в публичный origin и попадает в Caddy на этом же сервере (hairpin-запрос).
  Работает, но требует, чтобы домен уже резолвился и сертификат уже был выпущен:
  при первом запуске заказывайте DNS и сертификат ДО сборки витрины.

Same-origin (оставить переменную пустой и ходить в `/api` этого же домена) текущий
клиент **не** поддерживает: `apiBaseUrl()` возвращает `""`, после чего
`new URL("/api/v1/activities")` бросает TypeError, а `isApiEnabled()` (`:235`)
откатывает витрину на моки. Если хочется убрать hairpin, правка нужна в web-зоне:
развести `INTERNAL_API_URL` для SSR (`http://api:8080`) и публичный origin для
браузера. До этой правки — одно значение `https://<домен>`.

Проверить, что вшито правильно: `curl -s https://<домен>/ | grep -o 'https://[^"]*api[^"]*' | head`.

### 4.2 Фото из базы не пройдут через `next/image`

В базе пути хранятся как `/media/cards/1/palitra.jpg` (§7.14), их отдаёт Caddy из тома.
Витрина сует их в `next/image` (`web/src/components/catalog/ActivityCard.tsx:107`), и
оптимизатор ищет файл в `web/public/media/…`, где его нет → 404 на всех фото из API.
Моки работают, потому что лежат в `web/public/images/…`. Нужна правка в web-зоне:
для путей, начинающихся с `/media/`, либо `<img>`, либо `images.unoptimized`, либо
кастомный loader. До правки — фото в real-режиме не видны, это не блокирует запуск
остального стенда.

### 4.3 Сборка на маленьком VDS

Если `next build` падает с «JavaScript heap out of memory» на 2 ГБ: собирать в CI и
загружать готовый образ, либо поднять `NODE_OPTIONS=--max-old-space-size=1536` и
убедиться, что swap из §1 активен (`free -h`).

## 5. Схема и данные

Точка входа Postgres выполняет `docker-entrypoint-initdb.d` **только на пустом томе**,
то есть при первой инициализации `pgdata`. Смонтирован ровно один файл и с префиксом
`01_`: рядом в `database/` лежит `checks.sql`, и если попадёт в тот же каталог,
алфавитный обход с `ON_ERROR_STOP=1` уронит инициализацию на пустой базе.

```bash
docker compose up -d db                  # первая инициализация
docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'
```

Схема идемпотентна (`CREATE … IF NOT EXISTS` + upsert в сидах), поэтому обновление на
живой базе — ручной прогон того же скрипта **предварительно сняв дамп**:

```bash
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > /srv/backups/pre-init-$(date +%F).sql.gz
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 < database/init.sql
```

Guard в начале `init.sql` падает внятной строкой, если база осталась в старой форме
`cards` — в этом случае дамп, `docker compose down && docker volume rm talentro_pgdata`
и повторная инициализация.

После накатки — проверки целостности §7.8 (13 проверок: 10 ошибок + 3 предупреждения):

```bash
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=0 -f - < database/checks.sql
```

Рядом лежит `database/checks.sh` — то же самое через `psql` на хосте, для локальной разработки.

## 6. Первый запуск

```bash
cd /srv/app && git pull
docker compose build
docker compose up -d
docker compose ps                       # db/api/caddy healthy, web running
```

Health-чек по слоям — каждый следующий имеет смысл только если прошёл предыдущий:

```bash
docker compose exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec api wget -qO- http://127.0.0.1:8080/health     # status ok, database connected
curl -s "https://<домен>/api/v1/activities?limit=1" | head -c 300  # каталог через Caddy
curl -sI "https://<домен>/" | head -1                              # 200 от витрины
curl -sI "https://<домен>/media/cards/1/palitra-oblozhka.jpg" | head -1  # если файл лежит в томе
```

`/health` отвечает 503, когда база недоступна, поэтому `unhealthy` у `api` — это
«процесс жив, каталога нет», а не только «контейнер упал».

## 7. Обновление и откат

```bash
cd /srv/app
git pull
export APP_VERSION=$(git rev-parse --short HEAD)   # тег попадает в /health
docker compose build api web
docker compose up -d db api web caddy
docker compose ps && docker compose logs --tail=50 api
```

Образы метятся `APP_VERSION`, поэтому откат — это повторный `up` с прежним тегом, если
тот образ ещё не удалён, и `git checkout <прежний commit>` + пересборка, если удалён:

```bash
APP_VERSION=<прежний-тег> docker compose up -d api web
```

Схему при откате кода не откатывают: ответы бэкенда исторически только дополняются
полями, поэтому старый код на новой схеме работает (контракт — `backend/Talentro/API.md`).
Если изменение всё же ломающее — восстанавливать дамп из §5 и только затем менять код.

`docker compose down` **не** трогает том `pgdata`; `down -v` удалит базу вместе с
данными — на боевом стенде его не использовать.

## 8. Медиа

Фото раздаёт Caddy из `${MEDIA_HOST_DIR:-/srv/media}` по пути `/media/*` (префикс
срезается `handle_path`, поэтому `/media/cards/1/x.jpg` → `/srv/media/cards/1/x.jpg`).
Том примонтирован `:ro`: писать в него бэкенду нечем — загрузки файлов в контракте §9
ещё нет, файлы кладёт координатор (например `rsync` в `/srv/media/cards/{id}/`).
Права: файлы только читаются — достаточно `chmod -R a+rX /srv/media`.

## 9. Логи, бэкапы, мониторинг

```bash
docker compose logs -f api          # chi middleware.Logger пишет в stdout
docker compose logs -f web caddy
sudo tail -f /var/log/caddy/access.log   # ротация настроена в Caddyfile
```

Бэкап базы — `pg_dump` в cron от имени `deploy`, например ежедневно в `/srv/backups` с
ротацией на 14 дней. Том `pgdata` резервной копией не является, и держать архив на том
же VDS бессмысленно: раз в сутки выгружайте `/srv/backups` вовне (`rsync` на второй
сервер или в облако).

## 10. Что не готово к публичному запуску

1. **Вход на сайте фейковый**: `POST /api/auth/login` и `/api/auth/register` не
   реализованы, ответ — 404 (перепроверено на стенде 2026-11-04). Роль сейчас определяется
   подстрокой почты в localStorage. Эндпоинты по §3.7 — приоритет в этой же ветке;
   маршрутизация `/api/auth/*` уже попадёт в `api:8080` через текущий `handle /api/*`,
   отдельный upstream не нужен.
2. Модерации нет: `MODERATOR_TOKEN` читается конфигурацией, но ни один эндпоинт его пока
   не использует — не передавать его клиентским сборкам.
3. Наполнение: в базе 8 занятий, у одной из них услуга, фотографий нет ни у кого. По
   решению владельца релиза это остаётся как есть — пустые поля честные, выдуманных
   описаний и рейтингов не добавляем (`docs/acceptance/stand-gaps-2026-11-04.md`, п.4).
4. Фото отдаёт Caddy из `/srv/media`, а не Go-сервис: `GET /media/…` на `api:8080` — 404.
   Поэтому `NEXT_PUBLIC_API_URL` обязан указывать на origin Caddy (и в docker-стеке, и при
   витрине на Vercel). Пока файлов нет, карточка показывает пустую обложку.
5. `NEXT_PUBLIC_API_URL` требует hairpin-запроса из SSR (§4.1).
6. Ограничений частоты запросов нет ни в Caddy, ни в бэкенде; `X-Forwarded-For` за
   docker-сетью не показывает реальный IP клиента, поэтому ограничивать по нему
   нельзя.
7. Проверка всего комплекта на реальном Docker-демоне не выполнена (его нет на машине
   разработки): §1–§9 надо прогнать на VDS и вернуть отчёт.
