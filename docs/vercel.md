# Публикация витрины на Vercel

Документ описывает публикацию **только витрины** (`web/`, Next 16.4.4). Go-API,
PostgreSQL и раздача `/srv/media` остаются на своём сервере: Vercel выполняет
Next-приложение, но не поднимает Go-процесс и не даёт ему базу. Витрина с Vercel
ходит к API по публичному HTTPS-адресу; VPN-адрес стенда (`26.52.103.163:8080`)
для Vercel недоступен — из serverless-функции в VPN не влезть.

Проверено по коду 2026-11-05 (ветка `feat/15-16-integration`, коммит `d00e928`).
Реального деплоя на Vercel в рамках этой проверки не было: шаги ниже — инструкция,
а не отчёт о том, что всё уже поднято. Там, где поведение зависит от хостинга, это
отмечено отдельно.

## 1. Кто куда ходит

| Запрос | Откуда | Куда | Куки |
| --- | --- | --- | --- |
| Страницы, RSC | браузер | Vercel (`web`) | `talentro_session` (first-party) |
| `/api/auth/login`, `/register`, `/google`, `/tester`, `/me`, `/logout` | браузер | Vercel BFF → API | BFF пересылает `cookie` и `Set-Cookie` |
| Каталог `/api/v1/*` | браузер | API напрямую (CORS) | не отправляются (`credentials: "same-origin"`) |
| Каталог `/api/v1/*`, `/api/auth/me` при SSR | сервер Vercel | API напрямую | `me` — с кукой из `cookies()` |
| `/media/*` | браузер | Vercel rewrite → API `/media/*` | нет |

Ключевое следствие: **публичный origin API должен закрывать и `/api/*`, и
`/media/*`**. Go-сервис `/media` не раздаёт (проверено на стенде: 404); файлы
отдаёт Caddy из `/srv/media`. Значит `NEXT_PUBLIC_API_URL` указывает на Caddy
перед API, а не на `api:8080` и не на голый Go-порт.

Вход устроен через same-origin BFF: браузер шлёт `POST /api/auth/<action>` на
свой же домен Vercel (`web/src/components/providers/AppProviders.tsx:79-92`), а
route handler пересылает запрос бэкенду (`web/src/app/api/auth/[...action]/route.ts`).
Поэтому кука сессии остаётся first-party и `SameSite=Lax` её не блокирует.
Прямые запросы браузера к API за авторизацией не предусмотрены и работать не
будут: кука не переедет между сайтами.

## 2. Импорт проекта

| Поле | Значение |
| --- | --- |
| Repository | `https://github.com/Nicken33/project-pmr` (из `git remote -v`) |
| Branch | `feat/15-16-integration` — пока работа идёт в ней; после merge переключить на `main` |
| Root Directory | `web` |
| Framework Preset | Next.js (определяется сам) |
| Install Command | `npm install` (в репозитории `web/package-lock.json`) |
| Build Command | `npm run build` |
| Output | `.next` (Next сам сообщает Vercel) |

`node_modules`, `.next` и `.env*` в git не попадают (`.gitignore`), сборка
начинается с чистой установки. Секретов в репозитории нет: из env-файлов
закоммичен только `.env.example` (имена и пустые значения). Версию Node выбирает
Vercel; в `web/package.json` поле `engines` не задано, поэтому отдельно её
фиксировать не нужно.

## 3. Переменные окружения

### 3.1 На Vercel (сервис `web`)

Все `NEXT_PUBLIC_*` **вшиваются в бандл на этапе сборки**: изменили значение —
нужен redeploy. «Перезапуск» в Vercel ничего не пересоберёт; если старое значение
осталось после redeploy, повторите его с выключенным Build Cache.

| Переменная | Обязательна | Где читается | Пустое значение |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | да, для реального каталога | `web/src/lib/api.ts:225-227`; медиа — `web/next.config.ts:10` | главная показывает «Каталог недоступен: на сервере не задан адрес бэкенда» (`web/src/app/page.tsx:92-97`); rewrite `/media` выключен |
| `NEXT_PUBLIC_SITE_URL` | рекомендуется | `web/src/lib/site-url.ts:19-32` | берётся `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` → `NEXT_PUBLIC_VERCEL_URL` → `VERCEL_URL` → `http://localhost:3000` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | нет | `web/src/components/auth/AuthForm.tsx:192`; `AppProviders.tsx:318` | вместо кнопки Google рисуется обычная кнопка; клик пишет «Вход через Google недоступен: не задан NEXT_PUBLIC_GOOGLE_CLIENT_ID» |
| `NEXT_PUBLIC_AUTH_URL` | нет | `web/src/lib/api.ts:230-232` | пусто → берётся `NEXT_PUBLIC_API_URL`; 503 будет только если **оба** пусты (`route.ts:41-47`) |
| `NEXT_PUBLIC_DEMO_DATA` | нет, и на проде должно быть **пусто** | `web/src/lib/view-mode.ts:30-36` | `"1"` включает моки всем посетителям, а не только тестировщику |

Правила для `NEXT_PUBLIC_API_URL`:

- только абсолютный `https://…`, без `/api` на конце; хвостовые слэши
  срезаются (`api.ts:221-227`). Без схемы `mediaProxyTarget` вернёт `null`
  (`web/src/lib/media.ts:16-21`), и фото перестанут проксироваться;
- значение видно в клиентском бандле — это не секрет;
- смена значения = пересборка, а не правка рантайма.

`NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`, `NEXT_PUBLIC_VERCEL_URL`,
`VERCEL_URL` проставляет сам Vercel; вручную их задавать не нужно.

### 3.2 На сервере API (не на Vercel)

Эти переменные живут только у Go-процесса. В Vercel их класть нельзя: клиентская
сборка их не читает, а секреты в публичном окружении витрины не нужны.

| Переменная | Обязательна | Пустое значение | Источник |
| --- | --- | --- | --- |
| `DATABASE_URL` | да | процесс не стартует | `backend/Talentro/internal/config/config.go:34-36` |
| `MODERATOR_TOKEN` | да (так требует конфиг) | процесс не стартует | `config.go:37-39` |
| `SESSION_SECRET` | да | процесс не стартует | `config.go:42-44`; `internal/auth/session.go:39-43` |
| `TESTER_TOKEN` | нет | тестовый вход отвечает 503 | `handlers/auth.go:153-157` |
| `GOOGLE_CLIENT_ID` | нет | вход через Google отвечает 503 | `handlers/auth.go:106-109` |
| `ALLOWED_ORIGINS` | для браузерного каталога — да | междоменные ответы не читаются | `internal/delivery/http/cors.go:20-27` |
| `PORT` | нет | 8080 | `config.go:25` |
| `TZ` | нет | пояс контейнера; на расчёты «за 90 дней» влияет `current_date` | `docker-compose.yml` |

`GOOGLE_CLIENT_ID` на бэкенде и `NEXT_PUBLIC_GOOGLE_CLIENT_ID` на витрине — **две
разные переменные**: первая проверяет `aud` токена, вторая только рисует кнопку.
Значение client id у них одно и то же (OAuth Web Client), но менять надо обе.

### 3.3 Что увидит посетитель при пустых значениях

| Пусто | Что происходит |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | каталог не грузится, на главной честная ошибка; демо-моки только у тестировщика или при `NEXT_PUBLIC_DEMO_DATA=1` |
| `NEXT_PUBLIC_AUTH_URL` (при заданном `API_URL`) | авторизация идёт в `API_URL`; это нормальный режим «всё на одном API» |
| `NEXT_PUBLIC_API_URL` и `NEXT_PUBLIC_AUTH_URL` | BFF `/api/auth/*` отвечает 503 «Сервер авторизации не настроен» (`route.ts:41-47`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | кнопки Google нет, клик по заглушке объясняет причину |
| `GOOGLE_CLIENT_ID` на бэкенде | `POST /api/auth/google` → 503, даже если витрина кнопку показала |
| `TESTER_TOKEN` | `POST /api/auth/tester` → 503; демо-разделы закрыты |
| `SESSION_SECRET` | API не стартует; витрина получает 502 от BFF |
| `DATABASE_URL` / `MODERATOR_TOKEN` | API не стартует |
| `ALLOWED_ORIGINS` | SSR каталога работает, но браузерные запросы к API с Vercel не читаются; preflight получает 403 |
| `NEXT_PUBLIC_DEMO_DATA=1` | **все** посетители видят моки, включая закрытые разделы; на проде флаг обязан быть снят |

### 3.4 `SESSION_SECRET`: генерация и ротация

Код требует только непустую строку (`session.go:39-43`); минимальной длины в
коде нет. Практическое требование — не меньше 32 байт энтропии:

```bash
openssl rand -hex 32      # 64 шестнадцатеричных символа
```

Hex выбран, чтобы значение не содержало `+`, `/`, `=` и не ломалось при подстановке
в `.env`/compose. Секрет хранится только в окружении API (`.env` с `chmod 600`
или секреты хостинга), не в git и не в Vercel.

Ротация:

- подпись HMAC-SHA256 (`session.go:61-65`), поэтому смена секрета **сразу
  инвалидирует все выданные куки** — все посетители, тестировщик и модератор
  разлогиниваются;
- grace-периода нет: `Store` хранит один секрет;
- при нескольких экземплярах API секрет должен быть одинаковым, иначе сессии
  будут «прыгать» между инстансами;
- ротацию делать в окно обслуживания и сразу перезапускать все экземпляры.

## 4. Домен и SEO

`web/src/lib/site-url.ts` выбирает origin так:

`NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` →
`NEXT_PUBLIC_VERCEL_URL` → `VERCEL_URL` → `http://localhost:3000`.

`robots.txt` и `sitemap.xml` собираются статически, то есть origin запекается на
сборке. Для продакшена задайте `NEXT_PUBLIC_SITE_URL=https://<домен>` **до**
первого production-деплоя, иначе в индексе окажется превью-адрес. Если
пользуетесь только `*.vercel.app`, переменную можно не задавать — Vercel подставит
свой production-домен.

Превью-деплои получают собственный origin. Это важно для CORS (п. 6) и для
Google OAuth (п. 9).

## 5. Фото карточек

- В базе пути относительные: `/media/cards/1/palitra.jpg`.
- `web/next.config.ts:20-24` проксирует `/media/:path*` на
  `${NEXT_PUBLIC_API_URL}/media/:path*`; `mediaProxyTarget` строит destination
  только из абсолютного `http(s)://` (`web/src/lib/media.ts:16-21`).
- Поэтому для браузера фото становится same-origin, и `next/image` работает без
  `remotePatterns`.
- Go-сервис `/media/*` не отдаёт (404). Файлы отдаёт Caddy из `/srv/media`
  (`infra/Caddyfile:45-52`). Если `NEXT_PUBLIC_API_URL` указывает на голый
  `:8080`, каталог будет, а обложек не будет.
- Моки дизайнера лежат в `web/public/images/**` и rewrite не затрагивает: Next
  сначала отдаёт файлы из `public`.
- Пока файлы не залиты в `/srv/media`, карточка показывает «Фото нет» — это
  ожидаемо, а не ошибка прокси.

## 6. CORS, куки и вход

**Куки.** Бэкенд ставит `talentro_session`: `HttpOnly`, `Path=/`,
`SameSite=Lax`, `Max-Age` 30 дней, `Secure` — только если
`X-Forwarded-Proto: https` (`session.go:102-110,139-141`). BFF пересылает
`x-forwarded-proto` посетителя (`route.ts:50-60`), поэтому на Vercel кука
выходит с `Secure` и браузер её принимает. `Set-Cookie` BFF возвращает как есть
(`route.ts:75-85`).

**Почему не напрямую.** Если браузер пойдёт за авторизацией прямо на API-домен,
кука станет third-party: `SameSite=Lax` не отправит её в cross-site запросе, а
современные браузеры ещё и блокируют сторонние куки. Вход будет «успешным», а
`/me` — анонимным. Поэтому авторизация только через same-origin BFF.

**CORS.** Разрешены только точные origin'ы из `ALLOWED_ORIGINS`; звёздочки и
отражения нет (`cors.go:5-43`). Пустое значение = браузерные ответы API не
читаются, preflight получает 403. Для Vercel:

```dotenv
ALLOWED_ORIGINS=https://<production-домен>
```

Без слэша на конце, со схемой. Если реальный API нужен и в превью — добавьте
каждый превью-origin отдельно; шаблонов и wildcard там нет. Браузерные запросы
каталога идут без кук (`api.ts:260`, `credentials: "same-origin"`), но CORS для
чтения ответа всё равно обязателен. SSR-запросы CORS не подчиняются.

**Вход уже реализован.** Утверждение прежней версии этого документа, что
`/api/auth/login` и `/register` — 404, устарело: маршруты есть
(`backend/Talentro/internal/delivery/http/route.go:43-48`), BFF их пропускает
(`route.ts:17`). Ограничения частоты: 10 входов в минуту и 3 регистрации в час на
IP (`handlers/auth_local.go:20-23`) — но за Vercel «IP» пока один на всех, см.
`docs/vercel-backend-exposure.md`.

## 7. Требования к публичному API

1. **Публичный HTTPS-origin.** A-запись на реальный IP, TLS на 443, reverse
   proxy перед API. VPN-адрес не подходит: Vercel его не видит.
2. **Один origin для `/api/*` и `/media/*`.** Иначе фото 404 (п. 5).
3. **CORS** с точным origin витрины (п. 6).
4. **SSR-доступность.** Серверные компоненты Vercel ходят в тот же публичный
   origin, что и браузер (hairpin): origin должен отвечать из интернета, а не
   только изнутри VPN.
5. **Порт API не публиковать.** Наружу — только reverse proxy; `8080` и `5432`
   остаются приватными.
6. **Лимитер.** Пока BFF не передаёт IP посетителя, все пользователи Vercel
   делят одно окно 10/мин и 3/час. Это отдельная задача с точными правками:
   `docs/vercel-backend-exposure.md`.

## 8. Проверка после деплоя

Подставьте свои значения: `<site>` — адрес Vercel, `<api>` — публичный origin
API. Все команды выполняются с машины вне VPN.

1. **Витрина отвечает.**

   ```bash
   curl -sSI https://<site>/ | head -1
   ```

   Ожидается `HTTP/2 200`.

2. **Каталог через API.**

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' 'https://<api>/api/v1/activities?limit=1'
   ```

   Ожидается `200`; тело — JSON с данными, а не пустой массив, если база наполнена.

3. **CORS для домена витрины.**

   ```bash
   curl -sS -o /dev/null -D - -X OPTIONS https://<api>/api/v1/activities \
     -H 'Origin: https://<site>' \
     -H 'Access-Control-Request-Method: GET' \
     | grep -i 'access-control-allow-origin'
   ```

   Ожидается `access-control-allow-origin: https://<site>`. Чужой origin:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -X OPTIONS https://<api>/api/v1/activities \
     -H 'Origin: https://evil.example' \
     -H 'Access-Control-Request-Method: GET'
   ```

   Ожидается `403`.

4. **Медиа.** Возьмите путь из ответа каталога и запросите его через API:

   ```bash
   curl -sS 'https://<api>/api/v1/activities?limit=1' | grep -oE '/media/[^"]+' | head -1
   curl -sSI "https://<api><путь-из-вывода>" | head -1
   ```

   Ожидается `200` и `content-type: image/...`. Через витрину тот же путь должен
   отдаваться по `https://<site>/media/...` (rewrite).

5. **Пустые Google/Tester дают 503, а не «пропустили».**

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://<api>/api/auth/google \
     -H 'content-type: application/json' -d '{"credential":"x"}'
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://<api>/api/auth/tester \
     -H 'content-type: application/json' -d '{"token":"x"}'
   ```

   `503` — соответствующая переменная пуста; `401` — настроена и токен отвергнут.

6. **Вход через BFF и атрибуты куки.**

   ```bash
   curl -sS -i -c /tmp/talentro.jar -X POST https://<site>/api/auth/register \
     -H 'content-type: application/json' \
     -d '{"email":"check-<метка-времени>@example.com","password":"check-pass-123","name":"Check"}' \
     | grep -i '^set-cookie'
   ```

   Ожидается `talentro_session=…; Path=/; Max-Age=2592000; HttpOnly; Secure;
   SameSite=Lax`. Команда создаёт реального пользователя — используйте одноразовый
   адрес. Затем:

   ```bash
   curl -sS -b /tmp/talentro.jar https://<site>/api/auth/me
   ```

   Ожидается `"authenticated":true`.

7. **Неверный пароль и лимит.**

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://<site>/api/auth/login \
     -H 'content-type: application/json' \
     -d '{"email":"nobody@example.com","password":"wrong"}'
   ```

   Ожидается `401`. Одиннадцатый такой запрос за минуту — `429` с `Retry-After`.
   **Осторожно:** пока не внедрён `docs/vercel-backend-exposure.md`, окно общее
   для всех посетителей Vercel, и этот тест на минуту заблокирует вход всем.
   Не запускайте его в рабочие часы.

8. **SEO-файлы указывают на настоящий домен.**

   ```bash
   curl -sS https://<site>/robots.txt
   curl -sS https://<site>/sitemap.xml | head -c 300
   ```

   В `Host:`/`Sitemap:` и в `<loc>` не должно быть `localhost` и превью-адреса.

9. **В бандл вшит правильный API и не вшит VPN.**

   ```bash
   curl -sS https://<site>/ \
     | grep -oE '/_next/static/[^"]+\.js' | sort -u \
     | while read -r p; do curl -sS "https://<site>$p"; done \
     | grep -oE 'https?://[a-zA-Z0-9._:-]+' | sort -u
   ```

   В выводе должен быть хост `<api>` и не должно быть `26.52.103.163`,
   `localhost:8080` и старых превью-доменов. Команда — эвристика: она смотрит
   только чанки, на которые ссылается главная; окончательная проверка — вкладка
   Network в браузере.

10. **Полная приёмочная матрица.**

    ```bash
    node docs/acceptance/recheck-stand.mjs --web=https://<site> --api=https://<api>
    ```

    `recheck-stand.mjs` поддерживает эти флаги (строка 19 файла). Выход `1`
    означает FAIL. Без публичного API часть проверок уйдёт в SKIP, а каталог
    станет FAIL — это ожидаемо и описано в п. 1.

## 9. Чего нет у владельца

Ниже — то, что нельзя вывести из репозитория и что нужно получить до публикации.
Значений здесь нет намеренно: их нельзя выдумывать.

| Что нужно | Зачем | Кто даёт |
| --- | --- | --- |
| Доступ к Vercel и GitHub-репозиторию | создать проект, подключить ветку, задать env | владелец |
| Production-домен витрины (или согласие на `*.vercel.app`) | `NEXT_PUBLIC_SITE_URL`, CORS, Google OAuth | владелец + DNS |
| Публичный домен API и A/AAAA-запись | Vercel не видит VPN-адрес; TLS выпускается только на реальный домен | владелец + DNS |
| SSH/доступ к серверу API | поставить reverse proxy, открыть 443, положить медиа | владелец |
| TLS и выпуск сертификата (ACME) | HTTPS для API и `Secure`-куки | владелец сервера |
| Google OAuth Web Client ID и добавленный origin витрины | без authorized JavaScript origin Google-вход не работает даже с client id | владелец Google Cloud |
| Файлы в `/srv/media` и пути в БД | фото карточек | владелец/контент |
| Значения `SESSION_SECRET`, `TESTER_TOKEN`, пароля БД, `MODERATOR_TOKEN` | запуск API | генерируются на сервере, в репозиторий не попадают |
| Решение по IP-лимитеру: вариант A или B (`docs/vercel-backend-exposure.md`) | иначе все посетители Vercel делят один счётчик | владелец + разработка |
| Куда складывать бэкапы БД | `pg_dump` на том же сервере — не бэкап | владелец |

Отдельно: если реальный API нужен в превью-деплоях, для каждого превью-домена
понадобится свой origin в `ALLOWED_ORIGINS` и в Google OAuth. Проще держать
превью на моках, а реальные данные проверять только на production-домене.

## 10. Чего Vercel не закрывает

- Go-API, PostgreSQL, `database/init.sql`, сиды и миграции.
- Раздачу `/srv/media` и сами файлы.
- Публичный HTTPS-origin API, TLS, DNS и firewall.
- CORS и `ALLOWED_ORIGINS` — это настройка бэкенда.
- Лимиты входа и проблему общего IP за Vercel (см. `docs/vercel-backend-exposure.md`).
- Google Cloud Console: authorized JavaScript origins для домена витрины.
- Бэкапы базы и мониторинг.
- Модераторские эндпоинты: `MODERATOR_TOKEN` читается конфигом, но публичных
  маршрутов модерации в этой ветке нет.
