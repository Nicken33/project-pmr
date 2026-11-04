# Talentro — контракт API

Актуальный контракт сервера каталога: маршруты, параметры, форма ответа, коды ошибок.
Источник истины по полям — код (`internal/models/`), этот файл описывает то, что
реально отдаёт сервер на ветке `feat/backend-activities-api`. Маршруты, параметры и
схемы дублированы в машиночитаемом виде в `../../docs/openapi.yaml` (§6.1) — для
генерации клиентов; набор путей в нём сверен с таблицей маршрутов тестом
`TestOpenAPICoversRoutes`, так что расходиться они могут только вместе с ошибкой
теста. Сюда идут пояснения, примеры и частота `null`, которых в YAML не бывает.

Базовый адрес dev-стенда: `http://localhost:8080` (канонический стенд на `:8081`).
Все ответы — `application/json; charset=utf-8`.

## Правила, которые действуют везде

- **Id.** В карточке `id`, `org_id` — строка для id карточки (`"10"`) и число для
  `org_id`, `location_id`, `group_id`, `category_id`. В справочниках (`cities`,
  `districts`, `categories`) id — число. Ссылаются на карточку и организацию могут
  и по slug, и по числу (см. ниже).
- **null отдаётся явно.** `omitempty` в моделях нет: поле присутствует всегда, просто
  с `null`. Никогда не опирайся на «поля нет в JSON». Исключения — два поля
  справочников, объявленных с `omitempty`: `children` у листового направления и
  `city_id` у города. Их в JSON нет вообще, и это не то же самое, что `null`.
- **Пустые списки — `[]`, не `null`.** `items`, `groups`, `locations`, `photos`,
  `videos`, `schedules`, `activities`. `children` — см. исключение выше.
- **Даты:** `updated_at` — RFC3339 с таймзоной (`2026-11-04T12:34:56+03:00`),
  `contacts_verified_at` — `ГГГГ-ММ-ДД` или `null`.
- **Время занятий** — строка `ЧЧ:ММ` локального времени, без даты и таймзоны
  (`"15:00"`). Дни недели: `1` — понедельник … `7` — воскресенье.
- **Цена.** `price` / `price_from` — целое в рублях ПМР. **`0` = бесплатно,
  `null` = цена не указана** — это разные смыслы (§7.4). `price_to` — верх
  диапазона, `null` = диапазон одноместный. `price_period` — `session`, `month`
  или `course` (других значений CHECK в схеме не допускает); у бесплатных групп
  может быть `null`.
- **Возраст.** `age.min` / `age.max` (в деталях — `age_from` / `age_to`),
  `null` = граница не задана. У услуг возраста нет по смыслу (§5.2).
- **Неизвестные параметры запроса игнорируются.** Например `?org=5` не сужает
  выдачу — список занятий организации отдаёт
  `GET /api/v1/organizations/{slug}`.
- **Пустое значение = фильтр снят.** `?city=` трактуется как «город не выбран», а
  не как «пустить пустую строку в SQL» (§5.8). Это держит рабочими кнопку «назад» и
  пересланную ссылку.

## Enum-значения

Зафиксированы CHECK-ами в схеме, за их пределы сервер не выходит:

| Поле | Значения |
|---|---|
| `kind` (карточка) | `activity`, `service` |
| `format` | `online`, `offline`, `both` |
| `lesson_type` | `individual`, `group`, `both`, `null` (у услуг всегда `null`) |
| `status` | `draft`, `on_moderation`, `rejected`, `published` (в публичной выдаче только `published`) |
| `price_period` | `session`, `month`, `course`, `null` |
| `org_type` (`organization.type`) | `школа`, `студия`, `дом творчества`, `спортшкола`, `частный мастер` |
| `categories.kind` | `activity`, `service`, `both` |
| `media.kind` | `photo`, `video` |
| `schedules.weekday` | `1`…`7`, где 1 — понедельник |
| `account_type` (в схеме, в выдаче ещё нет) | `user`, `owner_activity`, `owner_service`, `moderator` |

## Маршруты

| Метод | Путь | Ответ |
|---|---|---|
| `GET` | `/health` | `{status, database, version}` |
| `GET` | `/api/v1/activities` | `{items[], total, page, limit}` |
| `GET` | `/api/v1/activities/{slug}` | карточка целиком (плоские поля + `organization`, `locations[]`, `groups[]`, `photos[]`, `videos[]`) |
| `GET` | `/api/v1/organizations/{slug}` | `{organization, activities[], total}` |
| `GET` | `/api/v1/categories` | дерево направлений (2 уровня) |
| `GET` | `/api/v1/cities` | массив городов |
| `GET` | `/api/v1/districts?city=` | массив районов города |
| `GET` | `/api/cards` | **legacy**: голый массив карточек + заголовок `X-Total-Count` |
| `GET` | `/api/cards/{id}` | **legacy**: карточка целиком (то же, что v1 detail) |
| `GET` | `/api/categories` | **legacy**: тот же справочник, что v1 |
| `GET` | `/api/cities` | **legacy**: тот же справочник, что v1 |
| `GET` | `/api/organizations/{slug}` | **legacy**: тот же ответ, что v1 |

Legacy-пути — совместимость для клиента, который пишет на них с 2026-10. Они
обслуживаются **теми же обработчиками**, что и v1: поле не меняло ни имени, ни
типа, новые поля только добавились. Ломать их нечем, дубликата логики тоже нет.
Удалятся после миграции клиентов на `/api/v1`.

`{slug}` у карточки и организации принимает и slug, и числовое id:
`/api/v1/activities/tiraspol-studiya-palitra` и `/api/v1/activities/1` — один ответ.

## `GET /api/v1/activities`

### Параметры

| Параметр | Тип | Значение |
|---|---|---|
| `q` | строка | подстрока в названии, описании, организации и направлении. Регистр и `ё`/`е` не важны; опечатки не прощаются (§5.1) |
| `city` | id или slug | город по точке проведения (`tiraspol`, `1`) (§5.4) |
| `city_name` | строка | город по названию (`Тирасполь`) |
| `district` | строка, через запятую | район по имени или slug. **Только вместе с `city`** — иначе 400 (§5.4) |
| `category`, `direction` | id или slug | направление; родитель тянет все дочерние (§5.5). `direction` — прежнее имя, работает так же |
| `age` | целое 1–120 | возраст ребёнка. Группа без границы считается подходящей; услуги фильтр не берут (§5.2) |
| `price_max` | целое ≥ 0 | нижняя граница диапазона группы не больше этого числа (§5.3) |
| `free` | `1`/`0`/`true`/`false`/`yes`/`no` | `price_from = 0` (§7.4) |
| `online` | как `free` | `true` → формат `online` или `both`; `false` → строго `offline` (§5.7) |
| `verified` | как `free` | контакты подтверждены менее 90 дней назад (§11.3) |
| `kind` | `activity` / `service` | тип карточки |
| `day` | 1–7 | день недели занятия (§5.6) |
| `time` | `ЧЧ:ММ` | занятие идёт в этот момент (внутри `time_from…time_to`) (§5.6) |
| `near` | `широта,долгота` | точка в границах Приднестровья: `45.9–48.9` / `27.4–30.6` |
| `radius` | целое 100–50000 | метров от `near`. Без `near` — 400 |
| `sort` | `updated` / `price` / `name` / `verified` | по умолчанию — новые сверху. `rating` вернёт 400, пока нет таблицы голосов |
| `page` | целое ≥ 1 | страница (§9.4) |
| `limit` | целое 1–100, по умолчанию 20 | размер страницы (§9.4) |

Значения, которые не проходят проверку, дают **400 с именем поля** в
`error.fields` — см. «Ошибки».

### Форма ответа

```json
{
  "items": [
    {
      "id": "10",
      "slug": "tiraspol-veselye-noty",
      "name": "Детская музыкальная школа «Весёлые ноты»",
      "kind": "activity",
      "org_id": 10,
      "city": "Тирасполь",
      "age": { "min": 4, "max": 6 },
      "link": null,
      "description": "Фортепиано, скрипка и сольфеджио. Отчётные концерты дважды в год.",
      "district": "Центр",
      "price": 200,
      "category": "Музыка",
      "org_slug": "dmsh-veselye-noty",
      "org_name": "ДМШ «Весёлые ноты»",
      "org_type": "дом творчества",
      "phone": "+373 777 01234",
      "address": "ул. Еврейская, 42",
      "lat": 46.8407,
      "lng": 29.6344,
      "location_id": 12,
      "location_name": "Большой зал",
      "group_id": 15,
      "group_name": "4–6 лет",
      "price_to": null,
      "price_period": "month",
      "seats": 10,
      "category_id": 11,
      "category_slug": "music",
      "super_category": "Творчество и искусство",
      "super_category_slug": "creative-arts",
      "format": "offline",
      "lesson_type": "group",
      "status": "published",
      "verified": true,
      "photo": null,
      "groups_count": 2,
      "locations_count": 1,
      "updated_at": "2026-11-04T15:59:27.53583+02:00"
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 20
}
```

`total` — сколько карточек подходит под фильтр **всего**, а не на этой странице.
Одна карточка — ровно одна строка выдачи (§5.9): фильтры не размножают карточки,
они выбирают, какая группа и какая точка показаны в плоских полях.

**Какая группа и точка попадают в плоские поля.** Без `near` — самая дешёвая
подходящая группа (`price_from`), при равенстве — с меньшим id. С `near` — группа
ближайшей точки, внутри неё — самая дешёвая. Поэтому плоский `price` — это минимум
`price_from` по группам **только когда `near` не запрошен**; с `near` это цена
ближайшей точки. Полные данные — в `groups[]` на странице карточки.

Поля `city`, `district`, `address`, `lat`, `lng`, `location_*` — выбранной точки;
`age`, `price`, `price_to`, `price_period`, `seats`, `group_*` — выбранной группы.

`verified` — `contacts_verified_at` **самой карточки** не старше 90 дней (§11.3); у
организации и точки своё `contacts_verified_at`, они на этот флаг не влияют.
`photo` — первый фото-файл карточки или `null`.

### Примеры

```bash
curl 'http://localhost:8080/api/v1/activities?city=tiraspol&age=8&limit=5'
curl 'http://localhost:8080/api/v1/activities?q=%D1%84%D0%BE%D1%80%D1%82%D0%B5%D0%BF%D0%B8%D0%B0%D0%BD%D0%BE'
curl 'http://localhost:8080/api/v1/activities?day=2&time=17:30&sort=price'
curl 'http://localhost:8080/api/v1/activities?near=46.8407,29.6344&radius=3000'
```

Кириллицу в URL кодируй percent-encoding'ом (`q=фортепиано` →
`q=%D1%84%D0%BE%D1%80%D1%82%D0%B5%D0%BF%D0%B8%D0%B0%D0%BD%D0%BE`). Байты, которые не
являются UTF-8, сервер не отдаёт в базу, а отвечает 400 с именем поля.

## Карточка целиком: `GET /api/v1/activities/{slug}`

Те же плоские поля (см. выше) плюс полные объекты. Отдельных эндпоинтов на группу
и точку нет — раскрытие строится отсюда.

```json
{
  "id": "10",
  "slug": "tiraspol-veselye-noty",
  "…": "плоские поля карточки",
  "organization": {
    "id": 10, "slug": "dmsh-veselye-noty", "name": "ДМШ «Весёлые ноты»",
    "type": "дом творчества",
    "description": "Фортепиано, скрипка, аккордеон; хоровое и сольное пение.",
    "phone": "+373 777 01234", "email": null, "site": null,
    "address": "ул. Еврейская, 42", "city": "Тирасполь",
    "contacts_verified_at": null
  },
  "locations": [
    {
      "id": 12, "name": "Большой зал", "city": "Тирасполь", "district": "Центр",
      "address": "ул. Еврейская, 42", "lat": 46.8407, "lng": 29.6344,
      "phone": null, "contacts_verified_at": null, "groups_count": 2,
      "photos": []
    }
  ],
  "groups": [
    {
      "id": 15, "name": "4–6 лет",
      "age_from": 4, "age_to": 6,
      "price_from": 200, "price_to": null, "price_period": "month",
      "location_id": 12, "seats": 10,
      "schedules": [
        { "weekday": 2, "time_from": "15:00", "time_to": "16:00", "note": null, "seats": 10 },
        { "weekday": 4, "time_from": "15:00", "time_to": "16:00", "note": null, "seats": 10 }
      ]
    }
  ],
  "photos": [],
  "videos": []
}
```

- `locations[]` — все активные точки карточки, упорядочены по id. `groups_count` —
  сколько групп этой карточки ведутся в этой точке.
- `groups[]` — все группы; у группы возраст, цена с периодом, места, `location_id`
  и `schedules[]` (по строке на день, §8 таблица 6). `seats` на уровне группы и
  строки расписания — разные значения: строка может быть `null`, если места
  считаны по группе.
- `photos[]` / `videos[]` — медиа карточки, по `order_num`. Объект медиа выглядит
  так (`source_url` и `author` — требования §14 к источнику и правообладателю):

  ```json
  { "path": "/media/locations/1/studiya-palitra.jpg", "caption": null,
    "source_url": null, "author": null, "order_num": 1 }
  ```

  `path` — относительный путь, который отдаёт Caddy из `infra/`; полный адрес
  собирай сам (`https://<домен>${path}`). Абсолютных URL в базе нет.
- `locations[].photos` — фото именно этой точки, та же структура объекта. Точка без
  фото отдаёт `[]`.
- В detail-ответе плоские `group_*`/`location_*` показывают первую группу и первую
  точку (не «самую дешёвую»): полные данные лежат в `groups[]` и `locations[]`.

## Карточка организации: `GET /api/v1/organizations/{slug}`

```json
{
  "organization": {
    "id": 1, "slug": "studiya-palitra", "name": "Студия «Палитра»",
    "type": "дом творчества", "description": "…", "phone": "+373 777 01101",
    "email": null, "site": null, "address": "ул. 25 Октября, 62",
    "city": "Тирасполь", "contacts_verified_at": null
  },
  "activities": [ { "…": "карточка каталога, те же поля, что в items" } ],
  "total": 1
}
```

`activities` — только опубликованные карточки этой организации (§7.5), по названию,
не больше 100 штук. `total` — сколько их всего.

## Справочники

`GET /api/v1/categories` — дерево ровно двумя уровнями, порядок по `order_num`:

```json
[
  {
    "id": 1, "slug": "creative-arts", "name": "Творчество и искусство",
    "kind": "both", "icon": "palette", "order_num": 1,
    "children": [
      { "id": 10, "slug": "drawing", "name": "Рисование", "kind": "both",
        "icon": "palette", "order_num": 1 }
    ]
  }
]
```

`kind` — `activity` / `service` / `both`: какие типы карточек в направлении
разрешены (§7.2). У дочерних направлений `children` отсутствует (не `null`).

`GET /api/v1/cities` — `[{"id":1,"slug":"tiraspol","name":"Тирасполь"}, …]`, восемь
городов по `order_num`.

`GET /api/v1/districts?city=tiraspol` — `[{"id":1,"slug":"centr","name":"Центр","city_id":1}, …]`.
Без `city` — **400** с `fields.city` (§5.4): одноимённый район бывает в нескольких
городах, угадывать не будем.

Справочники непустые по построению (§7.12) — пустой массив здесь означает, что база
не загружена.

## Ошибки

Один конверт для всех ошибок (§9.3):

```json
{ "error": { "code": 400, "message": "проверь поля",
             "fields": { "district": "район передаётся только вместе с городом" } } }
```

| Статус | Когда | Что в ответе |
|---|---|---|
| `400` | значение параметра не проходит проверку (§5) | `message: "проверь поля"`, `fields` — поле → подсказка на русском |
| `404` | карточка/организация не найдена или снята с публикации; чужой slug | `message: "занятие не найдено или снято с публикации"` / `"организация не найдена или снята с публикации"` |
| `403` | preflight `OPTIONS` с origin вне `ALLOWED_ORIGINS` | пустое тело, заголовка `Access-Control-Allow-Origin` нет |
| `500` | внутренняя ошибка | `message: "серверная ошибка, попробуй позже"`; текст ошибки БД уходит только в лог |
| `503` | `/health`, когда база не отвечает | `{"status":"error","database":"disconnected",…}` |

Примеры 400:

```json
{ "error": { "code": 400, "message": "проверь поля", "fields": { "age": "age — целое число от 1 до 120, возраст ребёнка" } } }
{ "error": { "code": 400, "message": "проверь поля", "fields": { "radius": "radius работает только вместе с near" } } }
{ "error": { "code": 400, "message": "проверь поля", "fields": { "sort": "sort — updated, price, name или verified; rating ещё не считается" } } }
{ "error": { "code": 400, "message": "проверь поля", "fields": { "q": "значение должно быть корректной строкой в UTF-8" } } }
```

`fields` ключи совпадают с именами параметров; для параметров пути — `slug` или
`id` (то имя, которое стоит в вызванном пути).

## Кэш, ETag и междоменные запросы

- Все публичные GET: `Cache-Control: public, max-age=60` (§9).
- Список и карточка отдают слабый `ETag`; `If-None-Match` с совпавшим тегом → `304`
  без тела. Метка списка считается по составу и порядку карточек страницы плюс
  `total`, метка карточки — по её id и `updated_at`; правка в базе сдвигает обе.
  У страницы организации и справочников ETag пока нет — только
  `Cache-Control`.
- `Access-Control-Allow-Origin` ставится только для origin из `ALLOWED_ORIGINS`,
  вместе с `Vary: Origin` и `Access-Control-Allow-Credentials: true`.
  Preflight (`OPTIONS`) отвечает `204` с методами, заголовками и
  `Access-Control-Max-Age: 600`. Чужой origin на preflight получает `403`, а
  обычный запрос проходит без CORS-заголовков — браузер сам блокирует чтение
  ответа, поэтому `curl` увидит 200, а фронт — ошибку доступа.

## Что реально заполнено на демо-стенде

Сид `database/init.sql`: 8 опубликованных карточек (7 занятий + 1 услуга), 10
организаций, 12 точек, 16 групп, 25 строк расписания. Полезно, чтобы мобильный
экран не падал на `null` там, где его быть не должно, и не ждал данных там, где их
в сиде нет.

| Поле | Состояние на стенде |
|---|---|
| `lat`, `lng` | заполнены у всех 8 — карта работает |
| `name`, `slug`, `city`, `phone`, `format`, `status`, `kind`, `updated_at` | заполнены у всех |
| `link` (сайт организации) | `null` у всех 8 |
| `price_to` | `null` у всех 8 в списке (диапазон есть только у группы 16, она не попадает в «самую дешёвую») |
| `district` | `null` в 4 карточках — районы заведены не для всех точек |
| `seats` | `null` в 3 |
| `price_period` | `null` в 2 (обе бесплатные) |
| `photo` | `null` в 1 (`tiraspol-veselye-noty`) |
| `lesson_type`, `age.min/max`, `group_name`, `location_name` | `null` у услуги `tiraspol-repetitor-matematika` — у услуги возраста и названия группы нет по смыслу |
| `verified` | `true` только у `tiraspol-veselye-noty` |
| бесплатные (`price = 0`) | `dubossary-shakhmaty`, `tiraspol-futbol-detyam` |
| `videos[]` | пусто у всех — видео в сиде нет |

## Чего в контракте ещё нет

Не ломайся на этих ожиданиях — это отложенное, а не потерянное:

- **Авторизация и роли.** `/api/auth/*`, `GET /me`, кабинет владельца и модерация
  ещё не реализованы. В схеме таблицы `users` уже есть `account_type`
  (`user` / `owner_activity` / `owner_service` / `moderator`), `google_sub` и
  `provider` (`local` / `google`) — срез авторизации переносится на канон
  отдельно. Пока вход в приложении делать не на что — мок-авторизацию в контракт не
  включай, иначе переписывать оба клиента.
- **Голоса, избранное, отзывы, журнал изменений** — таблиц нет, поэтому нет и
  `sort=rating`.
- **Мессенджеры.** Таблица `messengers` в схеме есть, в выдачу ещё не поднята:
  наружу идут только `phone`, `email`, `site` организации.
- **Фильтр по организации** в каталоге не предусмотрен §5 — используй
  `/api/v1/organizations/{slug}`.

## Как проверить контракт на стенде

```bash
cd backend/Talentro
make test      # в том числе интеграционные тесты семантики фильтров §5
make checks    # database/checks.sql — целостность данных (§7.8)
```

Контракт в коде: маршруты — `internal/delivery/http/route.go`, поля —
`internal/models/card.go` и `internal/models/activity.go`, проверка параметров —
`internal/delivery/http/handlers/query.go`. Машиночитаемая спецификация —
`../../docs/openapi.yaml`, её сверка с таблицей маршрутов живёт в
`internal/delivery/http/openapi_test.go` и `route_test.go`.
