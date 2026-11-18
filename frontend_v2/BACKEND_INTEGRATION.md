# Подключение фронта к бэку — для бэкенд-разработчика

Фронт уже работает с Go-API из `project-pmr/backend/Talentro` (проверено на `vma8759072.s-vps.cloud`, только чтение).
Всё, что ниже, можно делать **без правок во фронте**: либо настройкой `.env`, либо реализацией маршрута по контракту.

## 1. Где что лежит во фронте

| Файл | Что это |
|---|---|
| `src/config.ts` | адрес API (`VITE_API_URL`), Google Client ID, почта команды |
| `src/api/client.ts` | `fetch` + токен `Authorization: Bearer`, разбор ошибок `{"error":{code,message}}`, тексты ошибок по `code` |
| `src/api/endpoints.ts` | **все существующие** маршруты `/api/v1/...` (1:1 с `route.go`) |
| `src/api/planned.ts` | **заготовки** маршрутов, которых в бэке ещё нет (раздел 4) |
| `src/api/types.ts` | типы ответов (ID — строки, как `json:",string"` в Go) |
| `src/features.ts` | флаги заготовок: включаются через `VITE_FEATURES` |
| `mock/server.mjs` | тестовый API в памяти — повторяет контракт Go; удобно сверять поведение (`npm run demo`) |

## 2. Настройка (без кода)

```env
VITE_API_URL=                       # пусто = тот же домен (/api, /media) — рекомендуется
VITE_GOOGLE_CLIENT_ID=1077679788690-…  # тот же, что GOOGLE_CLIENT_ID у бэка
VITE_CONTACT_EMAIL=talentro.pmr@gmail.com
VITE_FEATURES=                      # см. раздел 4, через запятую
```

Сборка: `npm ci && npm run build` → статичные файлы в `dist/`.

### Раздача на текущем сервере (Caddy) — пример, сам сервер фронт не трогал

```caddy
{$DOMAIN} {
    encode gzip zstd
    handle /api/*   { reverse_proxy api:8080 }
    handle /media/* { … как сейчас … }
    handle {
        root * /srv/web          # сюда смонтировать dist/
        try_files {path} /index.html
        file_server
    }
}
```

Если сайт на том же домене, CORS не нужен. Если на другом — добавить домен в `ALLOWED_ORIGINS`.
`FRONTEND_URL` бэка = адрес сайта: страница `/reset-password?token=…` во фронте есть.

## 3. Уже подключено (маршруты есть в бэке)

Каталог и справочники, карточка, отзывы, голоса, избранное, вход/регистрация/сброс пароля, Google, профиль,
кабинет (организация, анкеты, фото, видео, submit/unpublish/delete), модерация анкет —
см. `src/api/endpoints.ts`.

Подключено из новых маршрутов `project-pmr`:

| Маршрут | Где во фронте |
|---|---|
| `POST /api/v1/reviews/{id}/photos`, `/videos` (multipart `file`, `caption`) | форма отзыва: до 5 фото и 1 видео, фото сжимаются до 1600 px |
| `DELETE /api/v1/reviews/{id}/media/{mediaID}` | `Api.deleteReviewMedia` |
| `POST /api/v1/reports` `{target_type: card\|review\|media, target_id: "строка", reason, detail}` | «Пожаловаться» у анкеты и отзыва |
| `GET /api/v1/moderation/reports?status=open&target_type=…` | модерация → вкладка «Жалобы» |
| `POST /api/v1/moderation/reports/{id}/decision` `{action: hide\|dismiss, reason}` | «Скрыть с причиной» / «Оставить» |

Ответ `GET /activities/{id}/reviews` должен содержать у отзыва `photos` и `videos` (в `models.Review` они уже есть).

## 4. Нужно сделать в бэке (заготовки уже во фронте)

Каждая заготовка спрятана флагом. Реализуйте маршрут → добавьте флаг в `VITE_FEATURES` → пересоберите фронт.
Формат ошибок — как везде: `{"error":{"code","message"}}`. ID в JSON — строки.

### 4.1 `review_votes` — голос за отзыв (таблица `review_votes`)
```
POST /api/v1/reviews/{id}/vote     (нужен вход)
→ {"value": 1 | -1 | null}         null = снять голос
← 200 {"plus": 3, "minus": 0}
```
И в каждом отзыве списка: `"votes": {"plus": 3, "minus": 0}`.

### 4.2 `review_comments` — ответы под отзывом (таблица `review_comments`)
```
GET  /api/v1/reviews/{id}/comments
← 200 {"items":[{"id":"1","review_id":"7","author_id":"3","author_name":"Ольга",
                 "text":"…","is_organization":false,"created_at":"2026-11-18T10:00:00Z"}]}
POST /api/v1/reviews/{id}/comments   (нужен вход)  → {"text":"…"}  (1–1000 знаков)
← 201 тот же объект комментария
```
`is_organization = true`, если автор — владелец организации этой анкеты («Ответ организации»).
В отзыве списка: `"comments_count": 2`.

### 4.3 `not_found_requests` — «Не нашли занятие?» (таблица `requests`)
```
POST /api/v1/requests   (вход не нужен, лимит по IP)
→ {"query":"шахматы для 7 лет","city_id":"1" | null,"contact":"почта или телефон" | null}
← 201 {"id":"15"}
```

### 4.4 `popular_searches` — частые запросы на пустом поиске (таблица `search_queries`)
```
GET /api/v1/search/popular
← 200 {"items":["танцы","футбол","английский","рисование","плавание"]}   (до 5)
```

### 4.5 `avatar` и `org_logo`
```
POST /api/v1/me/avatar               multipart file (jpg/png/webp, фронт сжимает до 512 px)
← 200 пользователь + "avatar_path":"avatars/3.jpg"     (и в GET /api/v1/me)
POST /api/v1/me/organization/logo    multipart file
← 200 {"logo_path":"logos/5.jpg"}     (и в GET /me/organization, /organizations/{id})
```

### 4.6 `republish` — вернуть снятую анкету
Сейчас `unpublish` ставит `is_active=false`, а вернуть обратно нечем.
```
POST /api/v1/me/activities/{id}/republish   (владелец)
← 200 {"id":"42","status":"published"}      409 invalid_status, если анкета не снята
```

## 5. Расхождения и пожелания к API

1. **Фильтры каталога принимают одно значение**, а панель по макету — несколько. Фронт сейчас догружает
   до 1000 карточек и досеивает сам. Хорошо бы принимать:
   `day=1,3`, `time=morning,evening`, `category=5,7`, `price_min`, `age_min`+`age_max`, `has_photo=true`.
   Как только бэк начнёт это понимать — во фронте достаточно убрать досев в `src/lib/filters.ts` (`toApi`).
2. **Нет текущего голоса пользователя** в карточке — фронт хранит его в `localStorage`.
   Предлагается поле `my_vote: 1 | -1 | null` в `GET /activities/{id}` для вошедшего.
3. **Адреса без групп не возвращаются** в `GET /me/activities/{id}` — фронт берёт их из `GET /me/organization`
   (`locations`). Название точки (`name`) в группах не приходит — при сохранении оно обнуляется.
4. **Пагинация «Показать ещё»** использует `limit` до 100 одним запросом; для больших выдач лучше курсор.
5. README бэка устарел: в нём нет Google-входа, `record_type=service`, жалоб и медиа отзывов.
6. OG-теги для превью ссылок в мессенджерах (ТЗ §10.21) в SPA сделать нельзя — нужен SSR или
   отдельный маршрут бэка `/share/activities/{slug}`, который отдаёт HTML с `og:*` и редиректит на сайт.
