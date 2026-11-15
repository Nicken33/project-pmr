# Talentro — аудит контракта API (openapi ↔ Go ↔ живой стенд ↔ web ↔ Flutter)

Дата прогона: 4 ноября 2026. Живой канон: `http://26.52.103.163:8080` (только GET;
кириллица в URL — percent-encoding). Только чтение, код не менялся.

Источники:
- **Реализация (стенд):** `D:\CyberSprint\.worktrees\integration\backend\Talentro` — `internal/delivery/http/route.go`, `handlers/catalog.go`, `handlers/query.go`, `handlers/etag.go`, `handlers/auth.go`, `httpx/response.go`, `models/card.go`, `models/activity.go`, `repository/catalog.go`, `repository/dictionaries.go`, `repository/activity.go`.
- **Контракт:** машиночитаемого файла в `D:\CyberSprint\.worktrees\integration\docs\` **нет** (в заданном пути `openapi.yaml` отсутствует; в `docs/` только README/deploy/acceptance). Фактические копии: `D:\CyberSprint\.worktrees\backend\docs\openapi.yaml` (1315 строк, самый полный — далее «openapi») и `D:\CyberSprint\.worktrees\moderation\docs\openapi.yaml` (959 строк, содержит чужие пути). Человекочитаемый контракт: `D:\CyberSprint\.worktrees\integration\backend\Talentro\API.md`.
- **Web:** `D:\CyberSprint\.worktrees\integration\web\src\lib\api.ts`, `api-server.ts`, `types.ts`, `session.ts`, `organization-page.ts`, `activity-page.ts`.
- **Flutter:** `D:\CyberSprint\.worktrees\mobile\frontend\mobile\lib\data\models\activity.dart`, `activity_parts.dart`, `reference.dart`, `media.dart`, `json.dart`, `domain\catalog_query.dart`, `data\api\api_client.dart`.
- **«В пути»:** в `D:\CyberSprint\.worktrees\backend\backend\Talentro` — незакоммиченные `handlers/auth_local.go`, `internal/auth/password.go`, `internal/auth/limiter.go`, `route.go` (+`/api/auth/login`, `/api/auth/register`). openapi этого среза уже описывает login/register.

База на стенде: 8 опубликованных карточек (`GET /api/v1/activities` → `total: 8`), id 10, 9 (услуга-репетитор), 6, 5, 4, 3, 2, 1.

---

## 1. Сводная таблица «эндпоинты»

Статусы: **OK** — сходится везде; **FAIL** — расхождение; **НЕТ** — отсутствует на слое.
«route.go» = интеграционное дерево (то, что на стенде); live-проверка — GET 4.11.2026.

| Эндпоинт | openapi | route.go | live | web | flutter | Статус |
|---|---|---|---|---|---|---|
| `GET /health` | есть | `route.go:18` | 200 `{status,database,version}` | `api.ts:281` (fetchHealth) | НЕТ (не используется) | OK |
| `GET /api/v1/activities` | есть | `route.go:21` | 200, `{items,total,page,limit}` | `api.ts:302` | `api_client.dart:47` | **FAIL** (см. G-4: 304 объявлен, не работает; G-7: дефолт sort) |
| `GET /api/v1/activities/{slug}` | есть | `route.go:22` | 200, 43 ключа | `api.ts:306` | `api_client.dart:52` | OK (304 проверен: `If-None-Match` → 304) |
| `GET /api/v1/organizations/{slug}` | есть | `route.go:26` | 200 `{organization,activities,total}`; и по id (`/organizations/1` → 200) | `api.ts:312` | `api_client.dart:67` | OK (ETag не обещан — его нет, сойтос) |
| `GET /api/v1/categories` | есть | `route.go:23` | 200, 9 корней, у листов ключа `children` нет | `api.ts:316` | `api_client.dart:57` | OK |
| `GET /api/v1/cities` | есть | `route.go:24` | 200, 8 городов, ключа `city_id` нет | `api.ts:320` | `api_client.dart:60` | OK |
| `GET /api/v1/districts?city=` | есть | `route.go:25` | 200 c slug/id; без city → 400-конверт | `api.ts:325` | `api_client.dart:64` | **FAIL** (G-6: `city=Тирасполь` → 200 `[]` молча, а openapi обещает «или имя») |
| `GET /api/cards` (legacy) | есть (deprecated) | `route.go:32` | 200 голый массив + `X-Total-Count: 8` + ETag | экспорт `api.ts:285` **никем не вызывается** | НЕТ | OK (веб-вызов мёртв) |
| `GET /api/cards/{id}` (legacy) | есть (deprecated) | `route.go:33` | 200; битый UTF-8 → `fields.id` | НЕТ | НЕТ | OK |
| `GET /api/categories`, `/api/cities`, `/api/organizations/{slug}` (legacy) | есть | `route.go:34-36` | 200 | НЕТ | НЕТ | OK |
| `POST /api/auth/google`, `POST /api/auth/tester`, `GET /api/auth/me`, `POST /api/auth/logout` | есть | `route.go:40-43` | `GET /api/auth/me` → 200 `{"authenticated":false,"tester":false}` | `api.ts:351`, `session.ts:27` | НЕТ («Эндпоинтов авторизации в контракте ещё нет» — `api_client.dart:26-28`) | **FAIL** по форме ошибок (G-8) |
| `POST /api/auth/login`, `POST /api/auth/register` | **есть в openapi** (`backend/docs` стр. 416/461) | **НЕТ в интеграционном route.go** | **404 text/plain** «404 page not found» | веб ждёт их (`/?register → POST /api/auth/register` 404 — `docs/acceptance/stand-gaps-2026-11-04.md`) | НЕТ | **В ПУТИ**: нереализован на стенде; есть незакоммиченный срез в `.worktrees\backend\backend\Talentro` (`route.go:40-41`, `auth_local.go`) |
| `GET /api/v1/moderation/queue`, `/journal`, `/applications/{id}/decision` | только в **moderation**-копии openapi (`:412-424`) | НЕТ ни в одном route.go | 404 text/plain | НЕТ | НЕТ | **FAIL контракта** (G-3: амбициозные пути в машиночитаемом контракте) |
| `/api/districts` (legacy) | нет | нет (`route.go:32-36` без него) | 404 | нет | нет | OK (единообразно отсутствует) |

---

## 2. Поля: openapi ↔ Go ↔ live ↔ web ↔ flutter

Набор ключей живого JSON **ровно** совпадает с openapi `Card` (38 полей) и `Activity`
(+`organization`,`locations`,`groups`,`photos`,`videos`) — сверено по `Object.keys`
живого ответа `/api/v1/activities/9`: `id,slug,name,kind,org_id,city,age,link,description,district,price,category,org_slug,org_name,org_type,phone,address,lat,lng,location_id,location_name,group_id,group_name,price_to,price_period,seats,category_id,category_slug,super_category,super_category_slug,format,lesson_type,status,verified,photo,groups_count,locations_count,updated_at` + 5 вложенных. Дрейфа имён/типов в ответах нет.

omitempty-ловушки (обе задокументированы и подтверждены вживую):
| Ключ | Правило | Живой факт | Клиенты |
|---|---|---|---|
| `categories[].children` | `omitempty` (`models/activity.go:94`) — у листа **ключа нет** | `leaf has no children key: true` (проверка всего дерева, 9 корней) | web `children?: ApiCategory[]` (`api.ts:170`) OK; flutter `children = const []` (`reference.dart:13,33`) OK |
| `cities[].city_id` | `omitempty` (`models/activity.go:101`) — у городов ключа нет | `[{"id":1,"slug":"tiraspol","name":"Тирасполь"},…]` | flutter `City` не читает city_id OK; web `city_id?: number` OK |
| `districts[].city_id` | присутствует | `[{"id":1,"slug":"centr","name":"Центр","city_id":1},…]` | flutter читает (`reference.dart:71`) OK |
| `null` vs отсутствие | правила без omitempty: `link`,`email`,`site`,`contacts_verified_at`,`photo`,`seats`,`district`,`price_to`,`price_period`,`lesson_type`,`group_name`,`location_name`,`lat`,`lng` — **ключ есть, значение null** | подтверждено: у id=9 `email: null`, `site: null`, `contacts_verified_at: null`, `seats: null`, `age: {"min":null,"max":null}` | OK у обоих клиентов |

Именно то, что спрашивала приёмка по репетитору id=9 — **не дефект связи, а данные**:
`lesson_type: null`, `group_name: null`, `age.min/max: null`, `seats: null` — контракт явно говорит
«у услуги возраста и названия группы нет по смыслу» (`API.md` §Возраст, таблица «Что реально заполнено»).
`email/site/contacts_verified_at` в выдаче **присутствуют** (значения null) — openapi `Organization` описывает их; `photos[]` у id=9 — 1 шт (`/media/cards/9/repetitor-urok.jpg`); в списке плоское `photo` null только у id=10 (совпадает с `API.md`).

Что веб/флаттер ожидают, а бэкенд **не отдаёт никогда** (осознанные дыры, зафиксированы в `API.md` «Чего в контракте ещё нет»): `reviews`, `votesPlus/votesMinus`, `messengers`, `logo/cover`, `shortDescription`, `serviceMode`, `isNew`, `promoted`, `createdAt` (web подставляет `updated_at` — `api-server.ts:252`). Статус: **НЕТ у сервера, есть в типах веб-домена** — падений нет, но см. G-13 (веб синтезирует `verifiedAt` из `updated_at`).

---

## 3. Фильтры `GET /api/v1/activities` — эмпирика (числа из живого стенда)

Все прогоны с `limit=100`; базовая линия: **total=8**.

| Параметр | openapi заявляет | парсер/репозиторий | живой результат | web шлёт | flutter шлёт | Вердикт |
|---|---|---|---|---|---|---|
| `q=фортепиано` | подстрока name/org/desc/cat | `query.go:52`, `catalog.go:232-248` | 200, total=1 | ✔ (`api.ts` q) | ✔ | OK |
| `city=tiraspol` / `city=1` | id или slug | `query.go:54-56` | 200, total=4 / 4 | ✔ slug | ✔ slug | OK |
| `city=Тирасполь` (имя) | только id/slug (`City`) | имя уходит в `ci.slug` | **200, total=0 молча** | нет | нет | OK по контракту, ловушка UI |
| `city_name=Тирасполь` | строка | `query.go:57` | 200, total=4 | нет (`city_name` только в legacy `fetchCards`) | нет | OK |
| `district=Центр` без city | 400 | `query.go:67-69` | **400** `fields.district` | нет | нет (не шлёт без города, `catalog_query.dart:183`) | OK |
| `city=tiraspol&district=Центр` / `=centr` | имя или slug | `catalog.go:142-154` (`d.name IN OR d.slug IN`) | 200, total=3 в обоих | ✔ (`district` через запятую слагов, `api-server.ts:299`) | ✔ `districtSlugs.join(',')` | OK |
| `district=Центр,Населёнка` | «несколько — через запятую» | split по `,` (`query.go:60`) | **200, total=4** — списки через запятую РАБОТАЮТ | ✔ | ✔ | **Приёмка «списки через запятую не поддерживаются» — ОПРОВЕРГНУТА для district** |
| `category=music`/`11`/`creative-arts` | id, slug; родитель тянет детей | `catalog.go:165-172` | 200, total=1 / 1 / 3 | ✔ | ✔ | OK |
| `category=Музыка` (имя) | «**или имя**» (openapi `Category:`, раздел `/api/v1/categories`) | SQL сравнивает только `cat.slug`/`p.slug` | **200, total=0 молча** | шлёт slug — не задевает | шлёт slug | **FAIL G-5** |
| `category=music,dance` | про списки для category речи нет | `intOrSlug`, запятая не режется (`query.go:72-74`) | **200, total=0 молча** | нет | нет | **FAIL G-10** (молчаливый ноль) |
| `direction=music` | прежний alias | `query.go:76-78` | 200, total=1 | legacy `fetchCards` (`api.ts:289`) | нет | OK |
| `age=8` | группа без границ подходит; услуги вне | `catalog.go:191-201` (`c.kind='activity'`) | 200, total=6 (7 занятий − 1 несовместимая; услуга id=9 исключена) | ✔ | ✔ | OK |
| `age=0`/`age=abc`/`age=121` | 400 | `query.go:80-87` | **400** `fields.age` | ✔ (только валидные числа) | ✔ | OK |
| `price_max=200` | нижняя граница группы ≤ X | `catalog.go:202-205` | 200, total=4 | ✔ | ✔ | OK |
| `price_max=-1` | 400 | `query.go:89-96` | **400** `fields.price_max` | — | — | OK |
| `free=1` | price_from=0 | `catalog.go:206-209` | 200, total=2 | только `free=1` при чекбоксе (`api-server.ts:303`) | `free=1` при true (`catalog_query.dart:189`) | OK |
| `free=0` | «1/0/true/false» — не говорит, что `0` = снят | `parseBool` → `f.Free=false` → **условие не добавляется** | **200, total=8** (не «платные 6»!) | нет | нет | **Ловушка G-9** |
| `verified=1` | ≤90 дней | `catalog.go:188-190` | 200, total=1 (id=10) | ✔ | ✔ | OK |
| `verified=0`/`false` | «1/0/true/false» enum | `f.Verified` — plain `bool`, false = no-op | **200, total=8** (неподтверждённых реально 7) | нет | нет | **Ловушка G-9** |
| `online=1`/`0` | both/online vs строго offline | `catalog.go:181-187` | 200, total=1 / total=7 | ✔ false тоже шлёт (`api.ts:334-336`) | ✔ | OK |
| `kind=service` | activity/service, прочее 400 | `query.go:124-130` | 200, total=1; `kind=xxx` → **400**; `kind=activity,service` → **400** | ✔ | ✔ | OK |
| `day=4` / `day=8` | 1–7, EXISTS по расписанию | `query.go:132-139`, `catalog.go:210-221` | 200, total=4 / **400** `fields.day` | ✔ (число 1–7 из `WEEKDAYS`) | ✔ | OK |
| `time=19:30` | момент ЧЧ:ММ внутри time_from…time_to | `query.go:141-147`, `isHHMM` 214-221 | 200, total=2 | **не шлёт** (`time` отсутствует в `ActivityQuery`, `api.ts:192-209`) | модель поддерживает (`catalog_query.dart:198`), UI не выставляет | OK сервер; G-12 (веб) |
| `time=9:00` / `time=24:00` | «ровно 5 символов» → 400 | `isHHMM` len!=5 | **400** `fields.time` | — | — | **Приёмка «time — момент ЧЧ:ММ» ПОДТВЕРЖДЕНА** |
| `near=46.8407,29.6344` | точка в границах ПМР | `parseGeo` 225-242 | 200, total=8; `near=99,99` → **400** `fields.near` | ✔ (`NEAR_CENTERS`, `api-server.ts:336-345`) | ✔ (`GeoPoint.insideRegion`) | OK |
| `radius=3000&near=…` | 100–50000, требует near | `query.go:158-168` | 200, total=4; `radius` без `near` → **400** `fields.radius` | ✔ | ✔ | OK |
| `sort=updated/price/name/verified` | только эти 4 | `query.go:170-178`, `cardOrder` 281-294 | price: `2:0 6:0 4:150 10:200 5:250 1:300 9:400 3:450`; verified: id10 первым; `sort=rating` → **400**; `sort=free` → **400** | ✔ (маппинг new/free/name/verified, прочее undefined — `api-server.ts:318-334`) | ✔ (белый список `allowedSorts`) | OK, кроме дефолта (G-7) |
| *(без sort)* | openapi: «default: updated» | `cardOrder` default → `t.card_id DESC` | дефолт `10 9 6 5 4 3 2 1`; `sort=updated` `1 2 3 4 5 6 9 10` (ничьи `updated_at`, тай-брейк id ASC) | web всегда шлёт `sort` — не задевает | не задевает | **FAIL G-7** |
| `super=creative-arts` | **не заявлен** (для web-URL исторический) | не парсится → игнор | **200, total=8 молча** | в API-запрос **не попадает**: current-код маппит `superCategory→category` (`api-server.ts:300`); но на ревизии стенда `a81745b` super был в `unsupportedFilters` и молча терялся (`docs/acceptance/stand-gaps-2026-11-04.md`: «/?super=creative-arts — найдено 8», P1) | нет (то же решение: «наднаправление — это тот же category», `catalog_query.dart:69-71`) | **G-11**: параметр не существует у сервера |
| `org=1` | «неизвестные игнорируются» | — | 200, total=8 | нет | нет | OK (заявлено) |
| `page=0`→400, `page=999`→200 `items:[]`,`total:8`; `limit=101`→400; пустые значения (`city=`, `age=`) → фильтр снят | — | `query.go:180-196` | подтверждено | — | — | OK |
| битый UTF-8 (`q=%D0`) | 400 с именем поля | `query.go:35-41` | **400** `fields.q` | — | — | OK |

**Итог по приёмочным утверждениям:** «sort допускает только updated|price|name|verified» — подтверждено
(rating/free → 400); «time — момент ЧЧ:ММ» — подтверждено (9:00 → 400); «списки через запятую не
поддерживаются» — **опровергнуто как тотальное**: для `district` работают (3→4 карточки), для `category`
дают молчаливый ноль, для `kind` — 400.

---

## 4. Форма тела и коды ошибок: 400 / 404 / 401 / 403 / 405

| Класс | Каталог+справочники (v1 и legacy) | Маршруты вне реестра | Auth (POST-only пути, GET-обращение) |
|---|---|---|---|
| 400 | конверт `{"error":{"code":400,"message":"проверь поля","fields":{…}}}` — подтверждено для age, day, time, kind, sort, radius, limit, page, UTF-8-в-query, districts без city, district без city. Единый для всех каталожных путей | — | — |
| 404 | конверт: `занятие не найдено…` (v1 и legacy `/api/cards/x`), `организация не найдена…`; пустой slug→404, битый UTF-8 в slug→400 `fields.slug` / в id→400 `fields.id` | **text/plain** `404 page not found\n` (chi-дефолт; `Content-Type: text/plain`) — вне §9.3 | **text/plain** `404 page not found\n` для `GET /api/auth/login|register` (роутер не знает путь) |
| 405 | н/д (всё GET) | — | **пустое тело, без Content-Type** — chi до хендлера; openapi `MethodNotAllowed` обещает JSON `{error:{code:405,…}}` — **FAIL G-8** |
| 401 | н/д | — | POST-пути получить GET-ом нельзя; по коду: `auth.go:90,94,145` — `http.Error(...)` → **text/plain** «неверный токен» и т.п., тогда как openapi `BadCredentials`/401 рисует конверт. **FAIL G-8**. Для будущих login/register срез `auth_local.go` пишет честно конверт (`httpx.WriteError`, строки 112,132,160,170) |
| 403 | н/д для GET | OPTIONS с чужим origin → `http.Error "origin not allowed", 403` (`cors.go:22`), тело text/plain — контракт (§CORS) описывает только статус, не форму — расхождения нет | — |
| 500/503 | конверт `серверная ошибка…` (`response.go:77`); `/health` при базе → 503 `{status:"error",database:"disconnected"}` (по коду `health.go`, live — ok/connected) | — | — |

Вывод: **в рамках каталога конверт един**, но «край системы» (несуществующий путь, метод не тот, auth-ошибки)
из §9.3 выпадает.

---

## 5. Молча игнорируемые / молча обнуляющие фильтры (опасный класс) — с цифрами

| # | Вход | Ожидаемое клиентом | Факт сервера | Цифра |
|---|---|---|---|---|
| 1 | `super=…` | «только над-направление» | параметра нет, игнор | total **8 → 8** (должно быть 3 как у `category=creative-arts`) |
| 2 | `free=0` | «платные» | no-op | **8 → 8** (платных 6) |
| 3 | `verified=0` / `verified=false` | «неподтверждённые» | no-op (plain bool в `CardFilter`, `card.go:86`) | **8 → 8** (неподтверждённых 7) |
| 4 | `category=<имя>` | фильтрует (openapi обещает имя) | сравнивается только с slug → пусто | `category=Музыка`: **8 → 0 молча** |
| 5 | `category=a,b` | список или 400 | один «slug» `a,b` | `music,dance`: **8 → 0 молча** |
| 6 | `city=<имя>` | фильтрует | сравнивается с slug | `Тирасполь`: **8 → 0 молча** (работает только `city_name=` → 4) |
| 7 | `districts?city=<имя>` | районы Тирасполя | `c.slug = $1` (`dictionaries.go:121-138`), имени нет | **4 района → 0 молча** (200 `[]`) |
| 8 | `city=1,2` | два города | slug `1,2` | **8 → 0 молча** |
| 9 | без `sort` при обещанном `default: updated` | порядок как `sort=updated` | `card_id DESC` (`catalog.go:292`) | дефолт `10 9 6…` против updated `1 2 3…` |

Ни один клиент сегодня не попадает на №2–№8 (оба отправляют только slug/id и только «true»-значения:
`api-server.ts:295-313`, `catalog_query.dart:180-211`), поэтому дефекты **серверно-контрактные**:
кнопка «платно»/чип «по имени», появившиеся в UI без синхронизации с парсером, замолчат на сервере.
На стенде уже был ровно такой случай (№1) — приёмка зафиксировала `/?super=creative-arts → 8` (P1,
`stand-gaps-2026-11-04.md`), текущий веб-код уже маппит super→category (`api-server.ts:300`), сервер — нет.

---

## 6. Приоритизированный список расхождений

**P1 — чинить в бэкенде:**
1. **G-4 `If-None-Match → 304` на списке не работает.** openapi: `/api/v1/activities` и `/api/cards`declare `304` + параметр `IfNoneMatch` (`backend/docs/openapi.yaml:148,158,276,311,326`); `catalog.go:63-77` ставит ETag, но проверку `matchAny` вызывает только `writeActivity` (`catalog.go:131-134`). Живьём: `If-None-Match: <etag>` на `?limit=2` → **200** (карточка `/activities/1` → 304 корректно).
2. **G-8 Форма ошибок auth вне конверта.** `auth.go:90,94,145` (`http.Error` → text/plain), GET-405 → пустое тело; openapi `MethodNotAllowed/BadCredentials` — JSON-конверт (`openapi.yaml:877-895`). Перевести на `httpx.WriteError` + chi `SetHandler(MethodNotAllowed)`.
3. **G-5/G-6/G-7:** либо реализовать обещанное (имя в `category`, имя в `districts?city=`, дефолт sort = `updated`), либо убрать из контракта — см. P2-контракт. Молчаливый `total=0`/`[]` — худшая из форм.
4. **G-9:** `free=0`/`verified=0` — задокументировать поведение «снят» в openapi (параметры-строки с enum намекают обратное) или резолвить в обратный фильтр.

**P2 — убрать/поправить в контракте:**
- **G-3:** убрать `/api/v1/moderation/*` из `moderation/docs/openapi.yaml` (или пометить `x-planned`): пути есть только в этой копии openapi (:412-424), в `route.go` их нет ни в одном дереве, live 404.
- **G-2:** `/api/auth/login|register` (`backend/docs/openapi.yaml:416,461`) — «в пути»: live 404, нет в интеграционном `route.go`; срез живёт незакоммиченным в `.worktrees\backend\backend\Talentro` (`auth_local.go`, `internal/auth/password.go`, `limiter.go` — 401-единообразие, 409+`fields.email`, 429+`Retry-After`). До мержа и деплоя openapi расходится со стендом; веб-страницы `/login`,`/register` остаются фейковыми (приёмка P0).
- Убрать/уточнить: «category по имени», «districts city по имени», `Sort default: updated` без изменения кода — это заявление контракта о несуществующем.
- **G-0:** положить канонический `openapi.yaml` в `integration/docs` (путь, ожидаемый процессом, пуст; сейчас две разошедшиеся копии 1315 vs 959 строк).

**P3 — веб:**
- **G-12:** `ActivityQuery` (`api.ts:192-209`) не имеет `time`, хотя сервер честно фильтрует по `ЧЧ:ММ`; UI оперирует «утро/день/вечер» и помечает фильтр unsupported (`api-server.ts:350`). Если решение — поддержка, начать с маппинга промежутка → три запроса/границы; если нет — оставить как есть (сейчас честные метки `unsupportedLabels`, это правильно).
- **G-13:** синтез `verifiedAt = updated_at` при `verified: true` (`api-server.ts:255`) выдаёт дату обновления за дату проверки контактов (§11.3) — подменить на явную формулировку или дождаться поля от сервера.
- **G-14:** разболтанные nullability в `ApiActivity` (`org_slug/org_name/org_type/format/kind/status/phone: | null`, `api.ts:59-80`) против guarantees модели Go (`card.go:31-56`, кроме `phone` = пустая строка) — сузить, чтобы `.length`-проверки не маскировали реальные дефекты. Мёртвый экспорт `fetchCards`/`/api/cards` удалить после миграции (`api.ts:285`, вызовов нет).

**P4 — Flutter (модели почти идеальны):**
- **G-15:** `OrganizationPage.fromJson` считает `organization` non-null (`activity.dart:233`), openapi объявляет `nullable` (`OrganizationPage.organization`) — при реальном null асMap даст пустого «призрака» id=0/slug=''. Guard на `json['organization'] is Map`.
- **G-16:** `time` в `CatalogQuery` (`catalog_query.dart:97,198`) существует в модели, но ни один экран его не выставляет — либо подключить UI, либо убрать, чтобы не плодить «молча не отправляемый» фильтр.
- Подтверждено отсутствующим: расхождений `lat/lng` vs `latitude/longitude` нет — флаттер читает `lat`/`lng` (`activity.dart:127-128`, `activity_parts.dart:119-120`), `latitude/longitude` в коде клиентов — только MapBox-камера (`activity_map.dart:66`), не JSON.
- Типы id (строка `id`, числа `org_id/location_id/group_id/category_id`), `weekday` 1–7, `ЧЧ:ММ`-строки, `updated_at` с offset — читаются корректно (`json.dart:15-49`).

---

## 7. Чек-лист «молча игнорируемые фильтры» для UI (главный риск)

Кнопку/чип можно считать безопасными только если значение входит в белый список парсера
(`query.go`): `q, city(id|slug), city_name, district(имя|slug, список, +city), direction, category(id|slug),
age, price_max, free(только truthy-смысл), online, verified(только truthy-смысл), kind, day, time(ЧЧ:ММ),
near,radius, sort(updated|price|name|verified), page, limit`. Всё остальное — включая `super`, `org`,
любые имена вместо slug в `city/category`, запятые в `category/kind`, «0»-значения булевых — не даёт ни
ошибки, ни эффекта.

---

### Приложение: доказательная база
- Живые прогоны 45+ фильтров и 22 эндпоинтов/ошибок (node-fetch, 04.11.2026, `26.52.103.163:8080`) — цифры в таблицах §3–§4.
- Коды: файлы/строки указаны инлайн; бэкенд = `.worktrees\integration\backend\Talentro`, веб = `.worktrees\integration\web\src\lib`, флаттер = `.worktrees\mobile\frontend\mobile\lib`, контракт = `.worktrees\backend\docs\openapi.yaml` + `moderation/docs/openapi.yaml` + `integration\backend\Talentro\API.md`.
