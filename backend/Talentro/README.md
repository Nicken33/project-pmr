# Talentro Backend API

Документация составлена по текущим маршрутам, обработчикам и моделям Go-сервера Talentro. Это контракт для фронтенда и краткое руководство по устройству backend. Если поведение кода поменялось, сначала обнови эту документацию вместе с кодом.

> Важно: этот документ описывает то, что зарегистрировано в текущем backend-коде. Он не гарантирует, что все маршруты проверены на конкретной БД или доступны через текущую публикацию фронтенда. Не подменяй фактический контракт названиями из интерфейса.

## 1. Коротко: правила, на которых чаще всего ломается интеграция

1. Регистрация принимает `account_type`, не `role`. Ответ пользователя также содержит `account_type`. `role` встречается внутри JWT claims и не является полем регистрационного JSON.
2. Для фильтра категории поиска используется `category`. Параметра `super` в Go API нет. Если он нужен в URL фронтенда для восстановления визуального состояния, фронтенд должен преобразовать выбранную категорию в API-параметр `category`.
3. День недели — число `1..7`: понедельник `1`, воскресенье `7`. Текст `Вт` API не принимает.
4. ID из JSON-ответов обычно являются строками. Входные JSON ID нужно передавать типом, заданным для каждого поля ниже: некоторые — строки, некоторые — числа.
5. `district_id` района не взаимозаменяем с `direction_id` направления. Район фильтрует географию, направление — тип занятия.
6. JSON-декодер запрещает неизвестные поля. Не отправляй одновременно старые и новые имена полей «на всякий случай».
7. Google-вход: `POST /api/auth/google`. Для новой почты сначала возвращается `202 needs_account_type`, создание происходит после повторного запроса с выбранным типом. Отдельных маршрутов удаления аккаунта, карты, списка всех медиа, комментариев к отзывам и голосования за отзывы нет.

## 2. Схема соединения фронтенда с backend

Backend по умолчанию слушает `http://localhost:8080`. Для внешнего доступа используется публичный адрес туннеля/развёрнутого API. На фронтенде должен быть один настраиваемый API base URL, а не адреса, разбросанные по компонентам.

Пример прямого backend-запроса:

```text
POST {API_BASE_URL}/api/v1/auth/login
```

Если браузер вызывает Vercel-маршрут, например `/api/auth/login`, это уже маршрут фронтенд-приложения или его proxy. Он должен переслать запрос на backend `/api/v1/auth/login`. Имя Vercel route не меняет контракт Go API.

Локальный `.env` backend загружается через `godotenv`; секреты в репозиторий и документацию не копировать. Для браузерных запросов backend выдаёт CORS-заголовки только origin-ам, перечисленным в `ALLOWED_ORIGINS`. Разрешённые request headers сейчас: `Authorization`, `Content-Type`, `X-Request-ID`.

### Форматы запросов

- JSON: `Content-Type: application/json`.
- Upload: `multipart/form-data`; при `FormData` не задавать `Content-Type` вручную — boundary выставляет браузер.
- Все API-ошибки используют envelope:

```json
{"error":{"code":"invalid_query","message":"Описание ошибки"}}
```

- Успешные ответы могут быть JSON, пустыми (`204 No Content`) или простым статическим файлом `/media/...`.
- Входящий JSON ограничен 1 MiB, должен содержать ровно одно JSON-значение и не может включать неизвестные поля.

## 3. ID и типы данных

В Go-моделях `json:",string"` означает, что числовой ID в JSON кодируется/декодируется как строка.

### ID в ответах

Практически все ID моделей карточек, пользователей, направлений, отзывов, организаций и медиа сериализуются строками, например `"id":"42"`. UI должен хранить их без потери точности и не использовать как массивный индекс.

### ID в query и URL

В URL и query ID являются десятичными цифрами без кавычек:

```text
/api/v1/activities/42
?city=1&category=5
```

### ID в JSON request bodies

| Поле | Тип JSON |
|---|---|
| `account_type` | строка enum |
| `direction_id` в создании/обновлении секции | строка с числом |
| `locations[].id`, `city_id`, `district_id` | строка с числом; `id` можно опустить для нового места |
| `card_id` при добавлении избранного | строка с числом |
| `city_id`, `district_id` в профиле организации | число JSON, не строка |
| `activity_id` при загрузке фото | текстовое поле multipart |
| `weekday`, возраст, цена, seats, координаты, page/limit | JSON/query числа |

## 4. Конфигурация backend

Backend читает следующие переменные окружения; `.env` не следует публиковать:

| Переменная | Назначение |
|---|---|
| `PORT` | HTTP-порт; по умолчанию `8080` |
| `DATABASE_URL` | строка подключения PostgreSQL; обязательна |
| `ALLOWED_ORIGINS` | список browser origins через запятую, например frontend origin без завершающего `/` |
| `JWT_SECRET` | отдельный обязательный секрет подписи токенов, минимум 32 символа; запасной ключ `MODERATOR_TOKEN` не используется. Смена ключа завершает текущие сессии |
| `TRUSTED_PROXIES` | IP-подсети доверенных reverse proxy через запятую (CIDR). По умолчанию список пуст: заголовки IP игнорируются. Указывайте только свои proxy, не `0.0.0.0/0` и не сети всех клиентов |
| `GOOGLE_CLIENT_ID` | Client ID Google; включает Google-вход |
| `MEDIA_DIR` | каталог файлов; по умолчанию `./media` |
| `SMTP_HOST` | SMTP сервер для сброса пароля |
| `SMTP_PORT` | SMTP порт, по умолчанию `587` |
| `SMTP_USERNAME` | SMTP логин |
| `SMTP_PASSWORD` | SMTP пароль/пароль приложения |
| `SMTP_FROM` | адрес отправителя |
| `FRONTEND_URL` | база ссылки, которую backend кладёт в письмо сброса пароля |

Сброс пароля по почте доступен только если заполнены все SMTP-переменные и `FRONTEND_URL`.

## 5. Запуск и структура проекта

Главная команда запускается из папки с `go.mod`:

```bash
go run ./cmd/app
```

В проекте также есть Makefile: `make help`, `make run`, `make build`, `make test`, `make lint`, `make fmt`, `make vet`, `make tidy`, `make db-up`, `make db-down`, `make db-shell`, `make db-tables`. Значение имени контейнера и базы в Makefile по умолчанию — `pg` и `main_db`; для другой локальной настройки задаются переменные make.

Основные каталоги:

- `cmd/app` — старт приложения, конфигурация, подключение БД, middleware и graceful shutdown.
- `internal/config` — чтение переменных окружения.
- `internal/delivery/http` — роутер, CORS, request ID и HTTP middleware.
- `internal/delivery/http/handlers` — разбор HTTP и JSON, валидация, статус-коды.
- `internal/models` — JSON DTO и внутренние модели.
- `internal/repository` — SQL-запросы к PostgreSQL.
- `media` — локальное файловое хранилище, путь управляется `MEDIA_DIR`.

Каждый запрос логируется JSON-строкой с методом, путём, статусом, длительностью и request ID. `GET /health` проверяет HTTP-процесс; `GET /ready` дополнительно проверяет PostgreSQL.

## 6. Полный список зарегистрированных маршрутов

| Метод | Путь | Доступ |
|---|---|---|
| `GET` | `/health` | публичный |
| `GET` | `/ready` | публичный |
| `GET` | `/media/*` | публичная статика |
| `GET` | `/api/v1/activities` | публичный поиск |
| `GET` | `/api/cards` | старый alias поиска |
| `GET` | `/api/v1/activities/{identifier}` | публичная карточка по ID или slug |
| `GET` | `/api/v1/activities/{id}/reviews` | публичный список отзывов |
| `GET` | `/api/v1/cities` | публичный справочник |
| `GET` | `/api/v1/districts` | публичный справочник |
| `GET` | `/api/v1/categories` | публичный справочник направлений |
| `GET` | `/api/v1/recommended` | публичный список рекомендаций |
| `GET` | `/api/v1/organizations/{id}` | публичный профиль организации |
| `POST` | `/api/v1/auth/register` | публичная регистрация |
| `POST` | `/api/v1/auth/email-verification/confirm` | подтверждение почты по токену письма |
| `POST` | `/api/v1/auth/email-verification/resend` | повторная отправка письма регистрации |
| `POST` | `/api/v1/auth/login` | публичный вход |
| `POST` | `/api/v1/auth/password-reset/request` | публичный запрос сброса пароля |
| `POST` | `/api/v1/auth/password-reset/confirm` | публичное подтверждение сброса |
| `GET` | `/api/v1/me` | авторизованный пользователь |
| `PUT` | `/api/v1/me` | авторизованный пользователь |
| `POST` | `/api/v1/me/password` | смена пароля с подтверждением текущим |
| `GET` | `/api/v1/me/favorites` | авторизованный пользователь |
| `POST` | `/api/v1/me/favorites` | авторизованный пользователь |
| `DELETE` | `/api/v1/me/favorites/{id}` | авторизованный пользователь |
| `POST` | `/api/v1/activities/{id}/vote` | авторизованный пользователь |
| `POST` | `/api/v1/activities/{id}/reviews` | авторизованный пользователь |
| `GET` | `/api/v1/moderation/activities` | moderator |
| `GET` | `/api/v1/moderation/activities/{id}` | moderator |
| `POST` | `/api/v1/moderation/activities/{id}/approve` | moderator |
| `POST` | `/api/v1/moderation/activities/{id}/reject` | moderator |
| `GET` | `/api/v1/me/organization` | владелец секций/услуг |
| `PUT` | `/api/v1/me/organization` | владелец секций/услуг |
| `POST` | `/api/v1/me/organization/cover` | владелец секций/услуг, загрузка обложки |
| `POST` | `/api/v1/me/activities` | владелец секций/услуг |
| `GET` | `/api/v1/me/activities` | владелец секций/услуг |
| `GET` | `/api/v1/me/activities/{id}` | владелец секций/услуг |
| `PUT` | `/api/v1/me/activities/{id}` | владелец секций/услуг |
| `DELETE` | `/api/v1/me/activities/{id}` | владелец секций/услуг, только draft/rejected |
| `POST` | `/api/v1/me/activities/{id}/submit` | владелец секций/услуг |
| `POST` | `/api/v1/me/activities/{id}/unpublish` | владелец секций/услуг |
| `POST` | `/api/v1/upload` | владелец секций/услуг |
| `POST` | `/api/v1/me/activities/{id}/videos` | владелец секций/услуг |
| `DELETE` | `/api/v1/me/activities/{id}/media/{mediaID}` | владелец секций/услуг |

## 7. Каталог и поиск

### `GET /api/v1/activities`

Без параметров возвращает только публично доступные опубликованные активные карточки.

Ответ:

```json
{"items":[],"total":0,"page":1,"limit":20}
```

Поддерживаемые параметры — только перечисленные здесь:

| Параметр | Формат | Значение |
|---|---|---|
| `q` | текст | Поиск по названию/описанию карточки, организации и направления |
| `city` | положительный integer ID | Город; передавать ID, не текстовое имя |
| `district` | ID; можно `district=2,4` или повторять ключ | Один или несколько районов |
| `category` | положительный integer ID | Направление/категория; код запроса поддерживает дерево дочерних направлений |
| `age` | integer ≥ 0 | Возраст участника |
| `price_max` | integer ≥ 0 | Верхний порог цены |
| `free` | `true`/`false` | Бесплатность |
| `kind` | `activity`/`service` | Тип записи |
| `online` | `true`/`false` | Для `true` подходят online/both; для `false` — offline |
| `verified` | `true`/`false` | Проверенность контактов |
| `day` | `1..7` | День недели: Пн=1 … Вс=7 |
| `time` | `morning`, `day`, `evening`, `утро`, `день`, `вечер` | Часть дня |
| `near` | `lat,lon` | Центр геопоиска |
| `latitude` + `longitude` | десятичные координаты | Альтернатива `near`; оба нужны вместе |
| `radius` | `500..10000` | Метры; требует координаты. Если координата есть, default — 3000 м |
| `sort` | `relevance`, `near`, `rating`, `new`, `free`, `updated_week` | Сортировка; `near` требует координаты |
| `page` | `1..1000000` | Страница; default 1 |
| `limit` | `1..100` | Размер страницы; default 20 |

Не поддерживаются `super`, `weekday=Вт`, `city_name`, `district_name` и произвольные фильтры из URL интерфейса. URL сайта может хранить внутреннее состояние интерфейса, но API-запрос должен использовать контракт выше.

Все фильтры возраста/цены/расписания/места проверяются на одной возрастной группе вместе с её местом. Нельзя собрать совпадение, используя возраст одной группы и день другой.

### Карточка поиска

Каждая карточка содержит основные поля:

```json
{
  "id":"42","slug":"sektsiya-42","name":"Секция",
  "description":"Описание","record_type":"activity","status":"published",
  "city_id":"1","city":"Тирасполь","district_id":"2","district":"Центр",
  "direction_id":"5","direction":"Спорт и физическая активность",
  "organization_id":"7","organization":"Школа",
  "class_type":"group","class_format":"offline",
  "price_from":0,"age":{"min_age":8,"max_age":12},
  "rating":{"score":0,"votes_count":0,"likes":0,"dislikes":0},
  "groups":[],"photos":[],"videos":[]
}
```

Опциональные значения могут отсутствовать (`omitempty`) или быть `null` в зависимости от модели и запроса. В группе есть `id`, возраст, цена, `location`, `schedules`, `seats`. В `groups[].location` находятся `city_id`, `district_id`, `address`, `latitude`, `longitude`. Это данные для карты; отдельного API-маршрута карты нет.

### Другие публичные GET

- `GET /api/v1/activities/{identifier}`: `identifier` — ID или slug; публично доступная карточка. Ответ — карточка плюс `messengers` организации/карточки.
- `GET /api/v1/recommended` и `GET /api/v1/recommended?city=1`: формат списка поиска, максимум 10. Сначала рейтинг с минимум тремя голосами; если результатов нет — новые за последние 30 дней.
- `GET /api/v1/cities`: массив `{id,name,sort_order}`; ID — строки.
- `GET /api/v1/districts?city=1`: массив `{id,city_id,name,sort_order}`; `city` необязателен и должен быть положительным ID.
- `GET /api/v1/categories`: дерево `{id,name,record_type,sort_order,children?}`. Никаких кодов `super` API не возвращает.
- `GET /api/v1/organizations/{id}`: профиль, мессенджеры и опубликованные карточки организации.

## 8. Регистрация, вход, профиль и восстановление пароля

### Регистрация — `POST /api/v1/auth/register`

```json
{"email":"user@example.com","password":"password123","name":"Имя","account_type":"user"}
```

Обязательны корректный email, непустое имя до 120 байт UTF-8, пароль 8–256 байт UTF-8. `account_type` допустим: `user`, `section_owner`, `service_owner`; пропуск означает `user`. `role` — неправильное поле и будет отклонено. Moderator не выдаётся через публичную регистрацию. Успех — **202** с `{needs_email_verification:true,email,message}`, без сессии и токена. Аккаунт создаётся после подтверждения письма. Лимит — 3 попытки в час с IP. Email нормализуется к нижнему регистру.

Ссылка из письма открывает `FRONTEND_URL/verify-email?token=...`. Frontend по нажатию кнопки отправляет `POST /api/v1/auth/email-verification/confirm` с `{token}`. Ответ 200 означает, что аккаунт создан; после этого нужен обычный вход. Ссылка действует 15 минут, повторное использование — `400 invalid_token`. Повторная отправка — `POST /api/v1/auth/email-verification/resend` с `{email}`, не чаще минуты. Google и существующие аккаунты не требуют этого шага. До обновления API применить миграцию `009_email_registration_confirmation.sql` и подключить новый сценарий на сайте. Полная инструкция — [docs/email-verification-api.md](docs/email-verification-api.md).

### Вход — `POST /api/v1/auth/login`

```json
{"email":"user@example.com","password":"password123"}
```

Успех `200`, `{token,user}`. Неверная пара — `401`, code `invalid_credentials`. Лимит — 10 попыток в минуту с IP. Пароль хранится в виде Argon2id-хеша; frontend не должен ожидать его в ответе.

### Текущий пользователь

- `GET /api/v1/me` — объект `{id,email,name,account_type}`.
- `PUT /api/v1/me` — изменение имени с передачей текущего email. Попытка заменить email отклоняется с `400 email_change_requires_verification`, чтобы нельзя было обойти подтверждение через профиль:

```json
{"email":"current@example.com","name":"Новое имя"}
```

Оба поля обязательны; email уникален, имя до 120 символов. Ответ — обновлённый пользователь.

### Сброс пароля

- `POST /api/v1/auth/password-reset/request`: `{"email":"user@example.com"}`.
- `POST /api/v1/auth/password-reset/confirm`: `{"token":"токен-из-письма","password":"newpassword123"}`.

Токен приходит в email-ссылке, действует 15 минут и используется один раз. После успешного сброса меняется пароль и аннулируются открытые reset tokens этого пользователя. Для запроса — 3 попытки/час с IP; подтверждение — 10 попыток/час. На несуществующий email request возвращает такое же сообщение успеха, чтобы не раскрывать наличие аккаунта. Нужен SMTP-конфиг.

### Google — `POST /api/auth/google`

Фронтенд передаёт `{"credential":"GOOGLE_ACCESS_TOKEN"}`. Backend обращается к Google UserInfo; проверяет подтверждение email и получает имя. Для существующей почты — `200 {token,user}` с сохранением текущего `account_type`. Для новой почты — `202 {needs_account_type:true,email,name}` без создания аккаунта и без выдачи сессии.

После выбора типа frontend повторяет запрос с тем же `credential` и `account_type`: `user`, `section_owner` либо `service_owner`. Google проверяется заново. Только затем аккаунт создаётся. Успех — `200 {token,user}` и HttpOnly-cookie `talentro_session` на 24 часа; frontend proxy передаёт cookie браузеру. При новой попытке с уже зарегистрированной почтой её тип не перезаписывается.

Ошибки: `400 invalid_body/invalid_credential/invalid_fields`, `401 invalid_google_token/unverified_google_account`, `429 rate_limited`, `502 google_unavailable`, `503 google_not_configured`, `500 internal_error`. Лимит: 10 запросов в минуту на IP, включая оба этапа. Нужен `GOOGLE_CLIENT_ID`; frontend использует тот же Client ID как `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. В текущем access-token сценарии Client ID включает функцию, но аудитория `aud` не проверяется. Аккаунты сопоставляются по подтверждённой почте; Google sub отдельно в базе не хранится.

Удаления аккаунта нет.

## 9. Организация владельца

Адреса, обложка, смена пароля и счётчики голосов описаны в [контракте для нового фронтенда](docs/organization-profile-api.md). Перед обновлением API примените миграцию `010_organization_profile_and_votes.sql`.

Все маршруты требуют `section_owner` или `service_owner`:

- `GET /api/v1/me/organization`: профиль владельца; `404`, если его ещё нет.
- `PUT /api/v1/me/organization`: создать/обновить.

Тело:

```json
{
  "name":"Студия","organization_type":"studio",
  "description":"Описание","phone":"+37300000000",
  "email":"studio@example.com","website":"https://example.com",
  "city_id":1,"district_id":2,
  "messengers":[{"channel":"telegram","contact":"@studio"}]
}
```

`city_id` и `district_id` здесь именно числа JSON. Типы организации: `school`, `studio`, `art_house`, `sports_school`, `private_master`. Каналы: `telegram`, `viber`, `whatsapp`, `instagram`, максимум четыре и не повторять канал. Сайт должен начинаться с `https://`. Backend проверяет имя, телефон и положительный `city_id`. `district_id` сохраняется и возвращается в профиле (в ответе ID — строка). Пропуск или 0 очищает район. Положительный ID должен принадлежать указанному городу, иначе `400 invalid_fields`. Перед обновлением сервера примените миграцию `database/migrations/004_organization_district.sql`.

## 10. Создание и изменение секций

Нужен Bearer-токен и `account_type` владельца (`section_owner` или `service_owner`). До создания должен существовать профиль организации.

| Метод и маршрут | Результат |
|---|---|
| `POST /api/v1/me/activities` | Создаёт draft, возвращает `{id,slug,status}` |
| `GET /api/v1/me/activities` | Свои секции; текущий лимит — первые 100 без пагинации |
| `GET /api/v1/me/activities/{id}` | Полные данные секции владельца, в т.ч. группы и медиа |
| `PUT /api/v1/me/activities/{id}` | Полностью сохраняет данные секции, места, группы, расписания |
| `DELETE /api/v1/me/activities/{id}` | Удаляет только собственный черновик или отклонённую секцию; опубликованные и ожидающие решения записи недоступны |
| `POST /api/v1/me/activities/{id}/submit` | Отправляет draft/rejected на модерацию; тело не нужно |
| `POST /api/v1/me/activities/{id}/unpublish` | Снимает опубликованную активную секцию; тело не нужно |

Пример полного тела create/update:

```json
{
  "name":"Секция бокса",
  "description":"Тренировки для детей",
  "direction_id":"5",
  "class_type":"group",
  "class_format":"offline",
  "phone":"+37300000000",
  "locations":[{
    "key":"main-hall","name":"Основной зал",
    "city_id":"1","district_id":"2","address":"ул. Примерная, 10",
    "latitude":46.85,"longitude":29.64,"phone":"+37300000000",
    "source_type":"person","source_url":null
  }],
  "groups":[{
    "name":"Дети 8–12 лет","age_from":8,"age_to":12,
    "price_from":0,"price_to":null,"price_period":null,
    "location_key":"main-hall","seats":12,
    "schedules":[{
      "weekday":1,"start_time":"16:00","end_time":"17:00",
      "note":null,"seats":12
    }]
  }]
}
```

Правила:

- `name` обязателен, максимум 200 символов.
- `direction_id` положительный ID строкой. Выбирай из `GET /api/v1/categories`; направление должно иметь `record_type=activity` или `both`.
- `class_type`: `individual`, `group`, `both`.
- `class_format`: `online`, `offline`, `both`.
- Backend принудительно задаёт `record_type=activity`; присылать `record_type` не нужно.
- Вложенные `locations[].id`, `city_id`, `district_id` — строки. Если `id` нет, backend создаёт новое место организации. Если место уже существует, можно передать его ID только когда оно принадлежит организации владельца.
- `key` места связывает его с группой: `groups[].location_key` должен совпасть с `locations[].key`.
- `age_from`, `age_to`, `price_from`, `price_to`, `seats`, `weekday`, координаты — числовые JSON значения; поля цены/возраста могут быть `null` там, где они optional.
- `weekday`: `1..7`, Пн=1 … Вс=7. `start_time` и `end_time` — строки времени `HH:MM`.
- Создание возвращает `201`: `{"id":"42","slug":"sektsiya-42","status":"draft"}`.
- `PUT` ожидает актуальный полный объект. Он пересоздаёт группы и расписания из переданного тела: не отправляй только изменившееся поле.
- Изменение опубликованной секции отправляет её обратно на модерацию; отклонённая после изменения возвращается в draft.
- Для submit нужны заполненные группы, возраст, места, адрес с координатами и расписание. Ошибки: `422 not_ready`, `409 invalid_status`.
- Список владельца ограничен первыми 100 объектами.

## 11. Медиа: фото и видео

Физические файлы сохраняются под `MEDIA_DIR`; в базе/ответе хранится относительный `path`. Публичный URL: `{API_BASE_URL}/media/{path}`. Файл напрямую обслуживается `GET /media/*`.

### Фото — `POST /api/v1/upload`

Авторизация владельца обязательна. Multipart-поля:

- `activity_id`: ID секции текстом.
- `file`: JPG, PNG или WebP; максимум 10 MiB.
- необязательно `caption`, `source_url`, `license`.

Успех `201`, объект фото: `id`, `path`, `alt_text`, `position`, `is_cover`. Фото привязывается к секции владельца. Публичные карточки и кабинет владельца включают `photos`.

### Видео — `POST /api/v1/me/activities/{id}/videos`

Multipart-поле `file`, MP4, максимум 50 MiB. Backend проверяет MP4 `ftyp`, требует `ffprobe`, видеокодек H.264, если есть аудиопоток — AAC, длительность не больше 30 секунд (§9.13). Если `ffprobe` недоступен: `500 video_validation_unavailable`. Некорректный/неподдерживаемый файл: `415 invalid_video`. Успех `201`, объект `{id,path,position}`.

### Удаление медиа

`DELETE /api/v1/me/activities/{id}/media/{mediaID}`. `mediaID` — ID фото/видео строкой в URL. Успех `204`. Backend сверяет владельца и привязку к секции. После изменения опубликованная секция может вернуться на модерацию.

Ограничение: текущий маршрут гарантированно работает с медиа, напрямую привязанным к `activity_id`; для медиа, привязанного только к `location_id`, удаление этим маршрутом не гарантировано.

## 12. Избранное и голосование

Все маршруты требуют входа.

- `GET /api/v1/me/favorites?page=1&limit=20`: `{items,total,page,limit}`, как каталог.
- `POST /api/v1/me/favorites`: `{"card_id":"15"}` — card_id JSON-строка; успех `201` без тела. Дубликат `409 favorite_exists`; несуществующая/непубличная карточка `404`.
- `DELETE /api/v1/me/favorites/{id}`: успех `204`; удалить можно только своё избранное.
- `POST /api/v1/activities/{id}/vote`: `{"value":1}`, `{"value":-1}` либо `{"value":null}` для удаления голоса. `value` — number/null. Ответ `{plus,minus}`.

Голосование и избранное доступны только для опубликованной активной карточки.

## 13. Отзывы

- `GET /api/v1/activities/{id}/reviews?page=1&limit=20` — публичные отзывы опубликованной активной секции; default page=1, limit=20, limit 1–100.
- Ответ: `{items,total,page,limit}`. Отзыв содержит `id`, `activity_id`, `author_id` как строки, `author_name`, `text`, `created_at`.
- `POST /api/v1/activities/{id}/reviews` требует вход и принимает `{"text":"Текст отзыва"}`. Успех `201` и объект отзыва.
- Один пользователь может оставить один отзыв на секцию. Дубликат даёт `409 review_exists`; недоступная секция — `404`.
- **Известный баг backend:** repository распознаёт владельца секции, но в HTTP handler общая ветка `err != nil` стоит раньше специальной проверки `ErrCannotReviewOwnActivity`. Поэтому попытка владельца оставить отзыв сейчас фактически превращается в `500 internal_error`, хотя задуманный ответ — `403 own_review_forbidden`. Исправить порядок веток в backend; до исправления не показывать это как корректно работающий `403`-сценарий.

В текущих маршрутах нет редактирования/удаления отзывов, комментариев, ответа организации, жалоб на отзыв, фото/видео в отзыве или голосов за отзыв.

## 14. Модерация

Требуется аутентифицированный пользователь с `account_type=moderator`; обычная регистрация эту роль не выдаёт.

- `GET /api/v1/moderation/activities?status=pending` — массив записей очереди, default `pending`. Разрешены `pending`, `published`, `rejected`. Элемент содержит `id`, `slug`, `name`, `status`, `rejection_reason` если есть, `photos` с первой найденной фотографией.
- `GET /api/v1/moderation/activities/{id}` — открыть конкретную секцию для проверки.
- `POST /api/v1/moderation/activities/{id}/approve` — тело не нужно; pending становится published.
- `POST /api/v1/moderation/activities/{id}/reject` — `{ "comment":"Причина отказа" }`, комментарий 3–1000 символов; pending становится rejected.
- Повторное решение не-pending секции даёт `409 invalid_status`.

Очередь — это список. `{id}` нужен только для открытия/решения по конкретной записи.

## 15. Статусы и типовые ошибки

| HTTP | Значение/частые коды | Как трактовать |
|---:|---|---|
| `200` | успешный GET/PUT/login; JSON-ответ | запрос выполнен |
| `201` | создан пользовательский объект, отзыв или медиа | объект создан |
| `204` | удаление избранного/медиа | успех без JSON тела |
| `400` | `invalid_body`, `invalid_fields`, `invalid_query`, `invalid_id` | неверный JSON, поле, ID или query |
| `401` | `unauthorized`, `invalid_credentials` | нет/истёк токен или неверная пара логина |
| `403` | `forbidden`, `account_blocked` | недостаточно прав или активная блокировка. Ошибка собственного отзыва описана отдельно выше: сейчас handler ошибочно возвращает `500` |
| `404` | `not_found` | объект отсутствует/недоступен/не опубликован |
| `409` | `email_taken`, `favorite_exists`, `review_exists`, `invalid_status` | конфликт состояния/уникальности |
| `413` | `file_too_large` | превышен лимит загрузки |
| `415` | `unsupported_file`, `invalid_video` | неподдерживаемый файл или кодек |
| `422` | `not_ready` | секция ещё не готова к модерации |
| `429` | `rate_limited` | временно превышен лимит запросов |
| `500` | `internal_error`, `create_failed`, `upload_failed` и т.п. | ошибка backend; детали смотреть в серверном логе по request ID |
| `502` | обычно frontend proxy/Vercel, не стандартная ошибка Go handler | проверить API URL/proxy и логи Go в тот же момент |
| `503` | `email_unavailable` или readiness | SMTP не настроен либо сервис/БД недоступны |

Все ответы API имеют заголовок `X-Request-ID`, он нужен для поиска соответствующей записи в логах.

## 16. Что не следует выдумывать или имитировать на фронтенде

Текущим Go API не реализованы:

- `role` в теле регистрации (правильно `account_type`);
- query `super` (для API-фильтра категории — `category`);
- текстовые дни недели в запросе (`day=Вт` неверно; нужно `day=2`);
- проверка аудитории Google ID token (текущий маршрут использует access token и Google UserInfo);
- удаление аккаунта;
- отдельный endpoint карты (координаты доступны в карточках и группах);
- список видео отдельным маршрутом;
- создание/редактирование/удаление комментариев и ответов к отзывам;
- жалобы на отзывы и голоса за отзывы;
- API управления/блокировки пользователями;
- API назначения роли moderator.

Если интерфейс показывает такие функции, не посылай выдуманные HTTP-запросы: либо временно отключи UI, либо согласуй и реализуй backend endpoint отдельно.

## 17. Чек-лист исправления фронтенда

- Найти по всему фронтенду отправку `role` при регистрации; заменить на `account_type`.
- Найти все URL/query builder использования `super`; отделить UI state от API query, API отправляет `category`.
- Найти `day`/`weekday`; преобразовывать дни к числам 1–7.
- Сверить каждый route и HTTP method из таблицы с вызовами API клиента.
- Сверить JSON key spelling и тип каждого ID; не менять строковые ID на `Number` без нужды.
- Убедиться, что Vercel proxy для `/api/auth/login` и регистрации проксирует на правильный API base и backend path с `/api/v1/...`.
- Проверить переменную API URL во всех Vercel environments и заново развернуть фронтенд после её изменения.
- Отличать сетевой/proxy `502` от backend `401 invalid_credentials`.
- Смотреть Network → Fetch/XHR → Request URL, Payload, Response и сопоставлять время с backend request log.
- Обновлять эту документацию при любом изменении route, DTO, query, типа ID, enum, error code или ограничения.


## Настройка IP за reverse proxy

Сначала определите адрес непосредственного proxy, который соединяется с API. В `TRUSTED_PROXIES` укажите его точный IPv4/IPv6 CIDR, например `127.0.0.1/32,::1/128` только для proxy на loopback. У Docker Caddy адрес другой: используйте его фактический адрес или выделенную сеть только доверенных proxy. Порт API должен быть доступен лишь через этот proxy. Caddy должен перезаписывать/дополнять X-Forwarded-For реальным IP соединения. Если перед Caddy есть Vercel/CDN, цепочку доверия и очистку входных IP-заголовков нужно настроить и там; backend сам не может проверить, как удалённый proxy получил заголовок.

Backend игнорирует IP-заголовки от недоверенного RemoteAddr. Для доверенного proxy X-Forwarded-For читается справа налево до первого недоверенного адреса. Некорректный адрес приводит к использованию IP соединения. Пустой TRUSTED_PROXIES безопасен от подмены, но объединит посетителей за одним proxy в общий лимит.
