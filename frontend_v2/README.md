# Talentro — frontend_v2

Новый веб-фронт каталога Talentro: React 19 + TypeScript + Vite, сборка — статичные файлы.
Работает с текущим Go-API из `backend/Talentro` без изменений в бэке.
Контракт сверен с `API.md` бэкенда (состояние `bd085fc`)
(проверено на `vma8759072.s-vps.cloud`, только запросы на чтение).

Сделан по макетам из Figma / `design/` и по ТЗ (`design/tz_text.txt`), с мобильной версией.
Старый `web/` (Next.js) не тронут — эта папка живёт рядом.

---

## 1. Быстрый старт

Нужен Node.js 22+.

```bash
cd frontend_v2
npm ci
```

### Демо без бэка (тестовые данные)

```bash
npm run demo          # тестовый API на :8099 + сайт на :5173, браузер откроется сам
```

`mock/server.mjs` повторяет контракт Go-API и хранит данные в памяти (сбрасываются при перезапуске).
В демо включены все заготовки (раздел 4). Тестовые аккаунты, пароль у всех `password123`:

| Почта | Роль |
|---|---|
| `user@test.md` | пользователь |
| `owner@test.md` | владелец секций (анкеты во всех статусах) |
| `service@test.md` | владелец услуг |
| `moderator@test.md` | модератор |

Фото для демо в репозиторий не кладутся (≈24 МБ). Скачать их один раз: `npm run demo:photos`
(Wikimedia Commons, свободные лицензии, авторы — в `mock/media/demo/CREDITS.txt`).
Без фото демо тоже работает — вместо картинок заглушки.

### Разработка с настоящим бэком

```bash
cp .env.example .env.local
# в .env.local: DEV_API_PROXY=http://localhost:8080   (или адрес сервера)
npm run dev
```

Vite проксирует `/api` и `/media` на бэк — CORS при разработке не нужен.

---

## 2. Подключение к бэку на сервере

### 2.1 Переменные сборки (`.env.production`)

| Переменная | Значение |
|---|---|
| `VITE_API_URL` | адрес API без `/` в конце. Пусто — `https://vma8759072.s-vps.cloud` (в `npm run dev` — прокси Vite). Для сайта на одном домене с API укажите его адрес |
| `VITE_GOOGLE_CLIENT_ID` | тот же, что `GOOGLE_CLIENT_ID` у бэка. Пусто — кнопка Google показывает «пока не настроен» |
| `VITE_CONTACT_EMAIL` | почта команды для страниц «О проекте» / «Обработка данных» |
| `VITE_FEATURES` | заготовки через запятую (раздел 4). Пусто — всё, чего нет в API, скрыто |

```bash
npm run build         # результат — dist/
```

### 2.2 Раздача через текущий Caddy (`infra/Caddyfile`)

Сейчас блок `handle { respond "Talentro API Server Online…" }` отдаёт текст. Чтобы на том же домене был сайт:

1. В `docker-compose.yml` у сервиса `caddy` добавить том с собранным фронтом:
   ```yaml
   volumes:
     - ./frontend_v2/dist:/srv/web:ro
   ```
2. В `infra/Caddyfile` заменить последний блок `handle`:
   ```caddy
   handle {
       root * /srv/web
       try_files {path} /index.html
       file_server
   }
   ```
   Блоки `handle /api/*`, `/health`, `/ready`, `handle_path /media/*` остаются как есть.
3. `docker compose up -d caddy` — бэк и база не перезапускаются.

Если фронт будет на другом домене — добавить его в `ALLOWED_ORIGINS` бэка и указать `VITE_API_URL`.

### 2.3 Что ещё настроить в бэке

- `FRONTEND_URL` = адрес этого сайта. Письма ведут на `{FRONTEND_URL}/reset-password?token=…` и `{FRONTEND_URL}/verify-email?token=…` — обе страницы есть.
- Vercel: `vercel.json` в этой папке отдаёт `index.html` на любой адрес (иначе обновление страницы `/activity/…` давало 404) и ставит `Referrer-Policy: no-referrer` на `/verify-email`.
- Подтверждение почты (миграция 009) поддержано: регистрация → «Проверьте почту» (`/check-email`, повтор письма с таймером 60 с) → `/verify-email` по кнопке → вход. Данные организации из формы регистрации хранятся в браузере и сохраняются `PUT /me/organization` после первого входа.
- Google: в Google Cloud Console добавить домен сайта в «Authorized JavaScript origins».
- Вход: фронт шлёт `Authorization: Bearer <token>` из ответа `login/register/google` (cookie не нужна).

---

## 3. Где что лежит

| Путь | Что |
|---|---|
| `src/config.ts` | адрес API, Google Client ID, почта команды |
| `src/api/client.ts` | `fetch` + токен, разбор `{"error":{code,message}}`, понятные тексты ошибок по `code` |
| `src/api/endpoints.ts` | **все существующие** маршруты `/api/v1/...` (1:1 с `route.go`) |
| `src/api/planned.ts` | **заготовки** маршрутов, которых в бэке нет (раздел 4) |
| `src/api/types.ts` | типы ответов (ID — строки, как `json:",string"`) |
| `src/features.ts` | флаги заготовок (`VITE_FEATURES`) |
| `src/lib/filters.ts` | фильтры ⇄ URL ⇄ параметры API |
| `mock/server.mjs` | тестовый API (контракт Go) |

Подключены все маршруты из `route.go`, включая жалобы (`/reports`, `/moderation/reports`)
и фото/видео отзывов (`/reviews/{id}/photos|videos`).

---

## 4. Что поправить / добавить на бэке

Подробные контракты с примерами — в [`BACKEND_INTEGRATION.md`](BACKEND_INTEGRATION.md).

### 4.1 Нужны новые маршруты (фронт уже готов и ждёт)

Каждая функция во фронте спрятана флагом. Сделали маршрут → добавили флаг в `VITE_FEATURES` → пересобрали фронт.
Формат ошибок — как везде, ID в JSON — строки. Таблицы для них уже есть в схеме.

| Флаг | Маршрут | Запрос → ответ |
|---|---|---|
| `review_votes` | `POST /api/v1/reviews/{id}/vote` (вход) | `{"value":1\|-1\|null}` → `{"plus":3,"minus":0}`; в каждом отзыве списка поле `votes:{plus,minus}` (таблица `review_votes`) |
| `review_comments` | `GET /api/v1/reviews/{id}/comments` | → `{"items":[{id,review_id,author_id,author_name,text,is_organization,created_at}]}` |
|  | `POST /api/v1/reviews/{id}/comments` (вход) | `{"text":"1–1000 знаков"}` → `201` комментарий; `is_organization=true`, если автор — владелец этой анкеты; в отзыве поле `comments_count` (таблица `review_comments`) |
| `not_found_requests` | `POST /api/v1/requests` (без входа, лимит по IP) | `{"query":"…","city_id":"1"\|null,"contact":"…"\|null}` → `201 {"id":"15"}` (таблица `requests`) |
| `popular_searches` | `GET /api/v1/search/popular` | → `{"items":["танцы","футбол",…]}` до 5 (таблица `search_queries`) |
| `republish` | `POST /api/v1/me/activities/{id}/republish` (владелец) | вернуть снятую анкету (`is_active=true`) → `{"id","status":"published"}`; `409 invalid_status`, если не снята. Сейчас `unpublish` есть, а вернуть нечем |

### 4.2 Уже сделано на бэке (миграция 010) и подключено во фронте

- голоса считаются (`activity_ratings` обновляется);
- адреса и филиалы организации — `locations[]` в `PUT /me/organization` (с меткой на карте в профиле организации и при регистрации);
- обложка организации — `POST /me/organization/cover`;
- смена пароля — `POST /me/password` (в профиле; «не помню» — письмо сброса).

### 4.3 Не хватает в API

1. **Удаление точки организации.** Пропущенные в `locations[]` точки не удаляются — убрать сохранённый филиал из профиля нельзя.
2. **Голос пользователя** (`my_vote`) — см. ниже, п. 2.

### 4.4 Расхождения с макетом и ТЗ

1. **Фильтры принимают одно значение**, а панель по макету — несколько. Фронт сейчас догружает
   до 1000 карточек и досеивает сам (счётчик «Найдено» при этом честный). Хорошо бы принимать:
   `day=1,3`, `time=morning,evening`, `category=5,7`, `price_min`, `age_min` + `age_max`, `has_photo=true`.
   После этого во фронте убрать досев в `toApi()` (`src/lib/filters.ts`).
2. **Нет моего голоса** в карточке — фронт хранит его в `localStorage`. Нужно поле `my_vote: 1|-1|null`
   в `GET /activities/{id}` для вошедшего.
3. **Адреса без групп не приходят** в `GET /me/activities/{id}` — фронт берёт их из `GET /me/organization`.
   **Название точки** (`name`) не приходит в `groups[].location` — при сохранении анкеты оно обнуляется.
   Нужно добавить `name` в `GroupLocation`.
4. **Очередь модерации без даты:** `GET /moderation/activities` не отдаёт, когда анкета отправлена.
   Фронт берёт `updated_at` из каждой карточки отдельным запросом (до 50). Нужно поле `submitted_at` в списке.
5. **Пагинация** «Показать ещё» использует `limit` до 100; для больших выдач лучше курсор.
6. **Превью ссылки в мессенджерах** (ТЗ §10.21): в SPA OG-теги не сделать. Нужен маршрут бэка
   `GET /share/activities/{slug}` → HTML с `og:title/description/image` и редирект на сайт.
7. **README бэка устарел:** в разделах 13 и 16 написано, что жалоб и фото/видео в отзывах нет, а маршруты есть.

### 4.5 Сервер (не код)

- В `docker-compose.yml` на сервере пароль базы записан прямо в `DATABASE_URL`. Вынести в `.env` (он в `.gitignore`).
- Вход на сервер под `root` по ключу без пароля — стоит закрыть вход по паролю и завести отдельного пользователя.

---

## 5. Страницы

| Адрес | Экран |
|---|---|
| `/`, `/catalog` | каталог: фильтры, баннер, категории, «Рекомендуемое», порции по 20 |
| `/activity/:slug` | секция: «Позвонить», группы, расписание, карта, отзывы с фото, жалоба |
| `/map` | карта: группировка меток, «Где я», радиус «Рядом со мной» (только телефон) |
| `/login`, `/register`, `/register/user`, `/register/org` | вход и регистрация |
| `/forgot-password`, `/reset-password?token=` | восстановление пароля |
| `/check-email`, `/verify-email?token=` | подтверждение почты после регистрации |
| `/favorites`, `/profile` | избранное, профиль |
| `/my`, `/my/new`, `/my/:id/edit`, `/my/organization` | кабинет владельца, анкета по шагам |
| `/moderation` | анкеты и жалобы (только `moderator`) |
| `/org/:id` | страница организации |
| `/about`, `/terms`, `/rules`, `/privacy`, `/request` | о проекте и правила |
