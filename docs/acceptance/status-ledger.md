# Реестр задач приёмки — Talentro

Служебный файл координатора. Не коммитить, не мержить. Только чтение + этот файл.

**База замера:** `feat/15-16-integration` = `3dd0172` («deploy: запись приёмки
стенда на сборке 281da3d»), стенд собран с `281da3d`.
**Прогон приёмки:** `node docs/acceptance/recheck-stand.mjs --web=http://127.0.0.1:3000 --api=http://127.0.0.1:8080`
→ **ИТОГ: PASS 69, FAIL 0, SKIP 4**, «ВЕРДИКТ: только PASS/SKIP — блокирующих
расхождений не найдено», exit 0. Время прогона: **2026-11-05 14:46:58 +0200**.
**Прогон иконок:** внутри того же скрипта, `check-category-icons.mjs` → exit 0,
«ИТОГ: проверка пройдена», но с предупреждением о 9 группах дублей (см. Н.7).

> Расхождение с вводными координатора: на 12:45 заявлялось PASS 63 / FAIL 4 /
> SKIP 6. Текущий прогон даёт 69 / 0 / 4 — четыре FAIL про гейтнутые маршруты
> сняты (строки ожидаются как «HTTP 404 без сессии → PASS» и «аноним 404 →
> тестировщик 200 → PASS»). Правка чекера: `ec2e948` Coordinator-2, 05.11 07:56.

## Статус веток относительно канонической линии

`git rev-list --count feat/15-16-integration..<ветка>` / обратно, замер 14:40:

| Ветка | своих | отстает | залита в integration | примечание |
|---|---|---|---|---|
| feat/15-clean-site-tester-session | 0 | 58 | да | локальный tip `a99b3fe` = `origin/…` |
| feat/backend-activities-api | 0 | 68 | да | tip `26a145d` = `origin/…` |
| feat/moderation-api | 0 | 25 | да | tip `784e1cb` = `origin/…` |
| feat/20-ci | 0 | 46 | да | tip `5c753aa` = `origin/…` |
| feat/21-honest-truth | 0 | 24 | да | tip `c164994` |
| feat/22-acceptance-mats | 0 | 1 | маркер | tip `281da3d` — это parent интеграции |
| feat/22-honest-data | 0 | 1 | маркер | тот же tip `281da3d` |
| feat/22-vercel-docs | 0 | 1 | маркер | тот же tip `281da3d` |
| feat/20-honest | 0 | 47 | **нет работы** | застыла на `9439130` с 04.11 23:27 |
| feat/20-legal | 0 | 47 | **нет работы** | застыла на `9439130` с 04.11 23:27 |
| **feat/mobile-flutter-mvp** | **12** | **100** | **НЕТ** | единственная не смерженная |

Все 12 удалённых веток на GitHub совпадают с локальными tip (сверено
`git ls-remote --heads origin` с `git for-each-ref refs/remotes`).
**Локальный `main` = `620396b`, `origin/main` = `a22802c` — локальная база
устаревшая; PR в main надо готовить от актуального `origin/main`.**

---

## Реестр пунктов (Топ-10 аудита + найденное после)

ID: `П0/П1/П2` — приоритет из аудита `stand-gaps-2026-11-04.md`, `Н` — найденное после.

| ID | Формулировка | Статус | Владелец | Доказательство | Следующий шаг |
|---|---|---|---|---|---|
| **П0.1** | Вход фейковый (любой пароль ≥6, роль по подстроке почты), серверная сессия не доходит до интерфейса | **готово** | feat/backend-activities-api → Agent 2 + Coordinator-2 | коммит `fa75503` (реальный вход/регистрация из backend-ветки), `d7a6e5f` (ревью безопасности входа); в живом прогоне: `/account: аноним 404 → тестировщик 200` PASS, `/moderation: аноним 404 → тестировщик 200` PASS, `GET /api/auth/me` с кукой → `authenticated:true, tester:true` PASS; `GET /api/auth/login` → **405** (маршрут существует, POST-only) вместо прежнего 404 | закрыто; остаток — только UX-проверка ручного входа в браузере |
| **П0.2** | Кабинет модератора — черновик без бэкенда | **в работе** (сервер готов, витрина не подключена) | сервер: feat/moderation-api / Cline + Moderation-Fixer; витрина: Agent 1 | сервер: `backend/Talentro/internal/delivery/http/route.go:37-42` регистрирует 5 маршрутов, `docs/openapi.yaml:660/711/751/797/844`, мерж `0dc446f`; в живом прогоне `GET /api/v1/moderation/{queue,journal,reports}` → **401** (раньше 404). Витрина: в `web/src` integration **нет ни одной строки `api/v1/moderation`** — `ModerationClient.tsx:49` берёт журнал из мока `moderationJournal` | Агенту 1 закоммитить и влить `web/src/lib/moderation-api.ts` + `web/src/app/api/moderation/[...action]/route.ts` (сейчас untracked в `D:\CyberSprint`), затем сверить поля (см. сводку спецпроверок ниже) |
| **П0.3** | Страницы организаций: 7 из 8 → 404, восьмая отдаёт мок с чужими данными | **готово** | Agent 1 (контент) + Coordinator-2 | блок приёмки «Организации — контент»: 8/8 PASS («название и телефон из API найдены»), мерж `281da3d`; инвентарь `docs/content/org-descriptions.md` | закрыто |
| **П0.4** | Наполнение не выпускное: 8 карточек, 1 услуга, 0 фото | **свободно → граница MVP** | владельца решения нет (см. блок «Границы») | `GET /api/v1/activities` → `total 8`; `?kind=service` → `total 1`; блок `/media` прогона: «существует 0 из 10; отсутствует 10» → **SKIP** | решение владельца: выпускать или нет; код здесь не помогает |
| **П1.5** | `/map`: «0 меток» при координатах в API + ложный текст про бэкенд | **готово** | Agent 1 | прогон: «ложный текст: нет; метки 8 (json=8, счёт=8)» PASS | закрыто |
| **П1.6** | Все чипы категорий — «Другое» (мок-слаги против канона) | **готово** | Agent 1 + справочник категорий | прогон: «„Другое“ 0 из 8; другие: Музыка, Репетиторство, Шах…» PASS | закрыто |
| **П1.7** | Мёртвые кнопки: `?super`, `?time`, `?sort=rating` | **готово** | Agent-5 (feat/21-honest-truth) + Coordinator-2 | коммиты `e672e85` («неприменимые фильтры видны посетителю»), `1510eaa`; прогон: `?super=creative-arts` применён 3/8 = API PASS, `?time=evening` → «явно не поддерживается» PASS, `?sort=rating` → «явно не поддерживается» PASS | закрыто |
| **П1.8** | Демо-режим тестировщика подмешивает 6 мок-карточек, все ссылки → 404 | **в работе** (стало честным, но не закрытым) | Agent 1 | `web/src/components/catalog/CatalogClient.tsx:308-318` — блок «Выбор редакции» теперь с подписью «Карточки из плана оформления — в реальном каталоге их нет». Но прогон по-прежнему: `/activities/hudozhestvennaya-studiya-palitra` → HTTP 404 → **SKIP** | убрать ссылки на моки в demo-режиме (или гасить `<a>`), либо вывести мок-блок из demo-счётчика |
| **П1.9** | Выдуманные данные в шапке/подвале (бейдж «2», уведомления, телефон, почта) | **готово** | Coordinator-2 | `grep -rn "18.10.2026\|Чемпионе\|777 00 000\|hello@talentro" web/src` → **пусто**; коммиты `3727df7`, `9439130` | закрыто |
| **П2.10** | Формы и заявки только в localStorage, эндпоинтов нет | **готово честно** (серверной части нет — осознанно) | Agent 1 | коммиты `5a25e74`, `67bbd8f` («отзывы и анкеты честно остаются в браузере — без отправки модератору и без обещанного срока»), `1609f43` (открытый SLA зафиксирован) | перейти на сервер, когда модерация-витрина подключится (П0.2) |
| **Н.1** | `/media`: 0 из 10 файлов, все 404 | **открыто, владельца нет** | нет | прогон: «существует 0 из 10; отсутствует 10» SKIP + 10 строк `404 /media/cards/…`; `grep FileServer\|"/media"` по `backend/Talentro/**/*.go` → **никого** (Go /media не отдаёт); `web/next.config.ts:23` проксирует `/media/:path*` на origin Go; файлы должны лежать в томе `/srv/media` (`infra/Caddyfile:49-50`) | назначить владельца: либо положить файлы в том, либо убрать прокси-на-Gо и признать «фото нет» публично |
| **Н.2** | Локальный `main` отстаёт от `origin/main` (`620396b` vs `a22802c`) | **открыто** | координатор | `git rev-parse` обеих ссылок | обновить базу перед созданием PR (main защищён, мерж только через PR) |
| **Н.3** | `feat/20-honest` и `feat/20-legal` — пустые (0 своих, 47 позади), worktree чистые | **свободно / мертво** | заявлено как Agent 5 и Agent 6 | `git rev-list --count feat/15-16-integration..feat/20-{honest,legal}` = 0; tip обеих = `9439130` от 04.11 23:27; `git -C .worktrees/honest status --short` и `.worktrees/legal` → пусто | честность реально делалась в `feat/21-honest-truth` (`c164994`, см. П1.7); решение координатора: закрыть ветки или переназначить |
| **Н.4** | Неподключённые правки Агента 1 лежат незакоммиченными в главном дереве | **риск потери работы** | Agent 1 | `git status --short` в `D:\CyberSprint`: 6 изменённых + 23 untracked, в т.ч. `web/src/lib/moderation-api.ts`, `web/src/app/api/moderation/[...action]/route.ts`, `web/src/lib/proxy.ts`, `web/src/lib/navigation.ts`, `web/vercel.json` | закоммитить в свою ветку и предложить мерж; сейчас ни один из этих файлов не виден в integration |
| **Н.5** | Flutter-ветка не смержена: 12 своих, 100 позади | **в работе** | Agent 3 / Flutter-UI (tip `e01cd0a`, 04.11 23:31) | `git rev-list --count`; dirty: 11 изменённых + 6 новых feature-каталогов (`lib/features/{account,common,favorites,map,organization,shell}/`) | синхронизировать с интеграцией и завести PR; правки затрагивают только `frontend/mobile/**` → конфликтов с web/Go нет |
| **Н.6** | `docs/content/legal-check.md` (заявлен координатором как источник фактов) отсутствует | **открыто** | Agent 6 (право) — **без доказательства** | `ls docs/content/` в integration → только `about.md`, `categories.json`, `org-descriptions.md`, `photo-inventory.md`; `sed` файла → «No such file or directory» | Агенту 6 создать документ и коммит; правовые страницы при этом правились Coordinator-2 (`3727df7`) |
| **Н.7** | 9 групп дублирующихся иконок второго уровня | **свободно → дизайнер/владелец** | нет (по указанию координатора — дизайнер) | вывод `check-category-icons.mjs`: Music/Camera/Scissors/BookOpen/Heart/Leaf/Toolbox/Wrench/Hand — по 2 направления на одну картинку; при этом «ИТОГ: проверка пройдена» (дубли не считаются дефектом) | решение владельца: менять иконочный словарь или принять как есть |
| **Н.8** | Мусорные отчётные файлы в каноническом дереве | **открыто (гигиена)** | Coordinator-2 | `git -C .worktrees/integration status --short` → 6 untracked: `detail-palitra.json`, `detail-palitra-notes.txt`, `schedules.txt`, `indep-{empty-day,map-filters,unsupported}.txt`; ни один не игнорируется | вынести в `.audit-tmp/` (уже в `.gitignore:52`) или удалить |
| **Н.9** | `docs/acceptance/recheck-stand.mjs` в главном дереве untracked, но tracked в integration | **открыто (риск коллизии)** | Agent 1 / Coordinator-2 | `git -C .worktrees/integration ls-files docs/acceptance/recheck-stand.mjs` → путь напечатан; в `D:\CyberSprint` он в `??` | при merge/checkout на интеграцию git откажется перезаписывать untracked-файл; согласовать один источник |

---

## Известные границы MVP, которые не чинятся кодом

Решение владельца — «выпускать с пустыми полями». Не является дефектом, но
должно быть видно пользователю.

| Граница | Фактическое состояние | Чем подтверждено |
|---|---|---|
| Наполнение каталога | 8 занятий, из них 1 услуга (12,5 % против «каждой пятой» в ТЗ §11.2) | `GET /api/v1/activities` → `total 8`; `?kind=service` → `total 1` |
| Фотографии | 0 из 8 карточек; `/media/**` отсутствует на стенде | прогон: «существует 0 из 10»; в списке SKIP |
| Бэкенд модерации в витрине | серверные маршруты есть, UI их не вызывает | `route.go:37-42` + 401 вживую против пустого grep `api/v1/moderation` в `web/src` |
| VDS/домен для публичного API | нет публичного API; стенд только в VPN | комментарий координатора + `docs/vercel.md`, `docs/deploy.md` (публикация витрины описана, бэкенда — нет) |
| Отзывы, избранное владельца, заявки «не нашли занятие» | живут в браузере посетителя, на сервер не уходят | `5a25e74`, `67bbd8f`, `1609f43` |
| Иконки второго уровня направлений | 9 пар направлений рисуются одной картинкой | предупреждение `check-category-icons.mjs` |
| Репетитор без возраста, «Расписание уточняется» | частично пустые поля карточек | аудит П0.4, п. 4; код не влияет на наличие данных |

---

## Пересечения: какие деревья правят одни и те же файлы

Метод: `git diff --name-only HEAD` + `git ls-files --others --exclude-standard`
по каждому грязному дереву, затем попарное пересечение списков.

| Дерево | путей изменено/создано |
|---|---|
| `D:\CyberSprint` (Agent 1, витрина) | 59 |
| `.worktrees/mobile` (Agent 3) | 24 |
| `.worktrees/backend` (Agent 2) | 15 |
| `.worktrees/honest3` (feat/22-honest-data) | 8 |
| `.worktrees/integration` | 6 (мусор, Н.8) |
| `.worktrees/ci`, `.worktrees/honest`, `.worktrees/honest2`, `.worktrees/legal`, `.worktrees/docs`, `.worktrees/accept`, `.worktrees/moderation` | 0 — чистые |

**Попардных пересечений грязных путей не найдено ни в одной паре** — то есть
прямых конфликтов «три параллельные правки одного файла» сейчас нет. Реальные
точки будущего столкновения — другие:

1. **`docs/openapi.yaml`** — правится и в `.worktrees/backend` (dirty ` M`), и
   уже залит из `feat/moderation-api` (81f4753 → `784e1cb`). Файл общий для
   Agent 2 и Cline; второй мерж даст конфликт по строкам контракта.
2. **`backend/Talentro/API.md`** — тоже dirty в backend-ветке и трогался
   модерацией. Тот же класс риска.
3. **`web/src/lib/filters.ts` + `filters.test.ts`** — dirty в
   `.worktrees/honest3` (feat/22), тогда как фильтры уже правились в
   `feat/21-honest-truth` (`e672e85`, смержено в `1510eaa`). Три честных
   ветки (20-honest / 21-honest-truth / 22-honest-data) пилят одну зону
   `web/src/lib` и `web/src/components/{catalog,activity}` — это и есть
   будущий конфликт, пока он виден только как «untracked vs смерженное».
4. **`web/src/app/api/auth/[...action]/route.ts`** — правится в дереве
   Агента 1 (dirty) и существует в integration после `147d06d` + `d7a6e5f`
   (ревью безопасности входа). Любая правка Агента 1 поверх залитого ревью
   обязана ретестировать тайминг- и лимитер-поведение.
5. **`docs/acceptance/recheck-stand.mjs`** — см. Н.9.

---

## Гигиена git по 12 деревьям

Проверялось: `git ls-files -c` (индекс) c фильтром `.env`, приватных ключей,
`package-lock.json`, `photo_2026*`, `app_bak`, `Карточка`, `.audit`, `secret`,
`credential`, `.p12/.jks/.keystore`.

**В индексе ни одного дерева нет запрещённого.** Ни `.env`, ни ключей, ни
корневого `package-lock.json`, ни `photo_2026-10-30_16-04-59.jpg`, ни
`src/app_bak/`, ни «Карточка занятия.svg», ни `.audit-tmp`.
Что легально лежит в индексе: `.env.example`, `backend/Talentro/.env.example`,
`web/.env.example`, `web/package-lock.json` (не корневой).

Находки по деревьям — всё это **untracked, но НЕ игнорируемые** файлы, то есть
`git add -A` случайно их коммитит:

| Дерево | Находка | Игнорируется? |
|---|---|---|
| `D:\CyberSprint` | `package-lock.json` (корневой, 65 КБ) | **нет** |
| `D:\CyberSprint` | `photo_2026-10-30_16-04-59.jpg` (203 КБ) | **нет** |
| `D:\CyberSprint` | `карточка занятия.svg` (1,86 МБ) | **нет** |
| `D:\CyberSprint` | `TDS.svg` (4,6 МБ) | **нет** |
| `D:\CyberSprint` | `.audit-canon-{det,list,org}.json` | **нет** |
| `D:\CyberSprint` | `.audit-tmp/` | да — `.gitignore:52` |
| `D:\CyberSprint` | `src/app_bak/` | **нет** |
| `D:\CyberSprint` | `.pr-body.md`, `.pr-title.txt`, каталог `worktree` | **нет** |
| `D:\CyberSprint` | `docs/{api-contract,content-gap,deploy,media-pipeline,security}-*.md`, `docs/content/`, `docs/screenshots/*` | **нет** (это ценный отчётный контент — решить, коммитить или игнорировать) |
| `.worktrees/integration` | 6 отчётных файлов в корне дерева (Н.8) | **нет** |
| остальные 10 деревьев | чисто | — |

Отдельно: `.gitignore` закрывает секреты корректно (`.env`, `.env.*`,
с исключением `!.env.example`), тяжёлые бинарники макетов закрыты только по
`*.zip` —svg/jpg в корне не закрыты.

---

## Заявлено «сделано», но доказательства нет / нет владельца

1. **Agent 6 (право)** — ветка `feat/20-legal` пуста (`own=0`, tip 04.11),
   worktree чист, `docs/content/legal-check.md` не существует (Н.6). При этом
   «готово» за правовые страницы фактически сделал Coordinator-2 в `3727df7`.
2. **Agent 5 (честность)** — `feat/20-honest` пуста; реальная работа в
   `feat/21-honest-truth` (`c164994`, `e672e85`, `ee1b55d`) и смержена в
   `1510eaa`. Претензия на ветку ≠ претензия на работу; доказательство есть,
   но не по названной ветке.
3. **feat/22-honest-data / feat/22-vercel-docs / feat/22-acceptance-mats** —
   три разных имени на одном tip `281da3d`, который является parent
   интеграции. Своих коммитов 0. Доказательств отдельной работы нет; в
   `.worktrees/honest3` при этом 8 незакоммиченных правок — работа есть,
   commits нет.
4. **«/api/auth/* ещё не в docs/API.md»** (пункт (a) от координатора) — **не
   подтверждается**: `/api/auth/*` описан в `backend/Talentro/API.md:77-82,
   334-339` и в `docs/openapi.yaml:418/463/509/571/620/640`. Отдельного
   корневого `docs/API.md` в репозитории нет — есть только
   `backend/Talentro/API.md` (найдено `find -name API.md`).
5. **«docker-compose не прокидывает SESSION_SECRET/TESTER_TOKEN»** (пункт (b))
   — **не подтверждается на integration**: `docker-compose.yml:77`
   `SESSION_SECRET: ${SESSION_SECRET:?не задан SESSION_SECRET}`,
   `docker-compose.yml:80` `TESTER_TOKEN: ${TESTER_TOKEN:-}`. Остаток риска:
   `TESTER_TOKEN` с пустым значением по умолчанию → `/api/auth/tester` должен
   отвечать 503 (задокументировано в `API.md:337`), а не тихо пускать.
   В `.worktrees/backend` `docker-compose.yml` правится незакоммиченно — там
   проверка ещё не залита.
6. **Нет владельца:** Н.1 (/media — самый тяжёлый открытый дефект витрины),
   Н.7 (дубли иконок), Н.3 (две мёртвые ветки), Н.6 (правовые тексты).
7. **Имена владельцев от координатора не совпадают с авторами коммитов.** По
   `git log --format='%an'` над последними 40 коммитами интеграции авторы
   только: `Coordinator-2`, `Nicken`, `Agent-5`, `CI-Engineer`,
   `Moderation-Fixer`, `Moderation Dev`, `Coordinator`. Коммитов с автором
   Agent-1/2/3/4/6/7, «контент-агент», «инженер по развёртыванию»,
   «Ревьюер-2», «Flutter-UI», «Cline», «Помощник координатора» нет ни одного.
   Attribution работает только через ветку/worktree, а не через git — это
   надо учитывать, когда «доказательство = коммит» требуется поимённо.

---

## Спецпроверки по указанию координатора — сводка

| Пункт | Вердикт | Доказательство |
|---|---|---|
| (a) `/api/auth/*` в API-доке | **закрыто** (постановка устарела) | `backend/Talentro/API.md:77-82, 334-339`; `docs/openapi.yaml:418-656` |
| (b) compose: SESSION_SECRET / TESTER_TOKEN | **закрыто в integration**, риск остаёт в dirty backend-ветке | `docker-compose.yml:77,80`; `git -C .worktrees/backend status` → ` M docker-compose.yml` |
| (c) роут `/media` в Go | **НЕ закрыто** | grep `FileServer`/`"/media"` по `backend/Talentro/**/*.go` → пусто; Go-роута нет, есть only Caddy-`handle_path` (`infra/Caddyfile:49-50`) и Next-rewrite на Go (`web/next.config.ts:23`); файлы отсутствуют → 0/10 |
| (d) контракт модерации сверен с `web/src/lib/types.ts` | **НЕ закрыто, расхождение реальное** | сервер: `ModerationApplication` (`docs/openapi.yaml:1625+`) требует `id, card_id, slug, title, kind, status, card_status, description, format, lesson_type, phone, category, category_slug, super_category, super_category_slug, organization_id, organization_slug, organization_name, organization_type, organization_city, groups, locations, photos, groups_count, locations_count…`; витрина: `web/src/lib/types.ts:248-256` `ModerationEntry` = `{id, applicationTitle, organizationSlug, actor, decision, comment?, createdAt}` — ни `card_id`, ни `status`/`card_status`, ни пагинации `{items,total,page,limit}`; `decision` в web — это «published/rejected», в контракте статусы два разных словаря (§7.18). Клиент-обёртка `fetchQueue/fetchJournal/fetchReports` существует, но **только как untracked-файл Агента 1** (`web/src/lib/moderation-api.ts:315-325`) и не залита |
| (e) 9 групп дублирующихся иконок | **не закрыто, передано дизайнеру/владельцу** | вывод `check-category-icons.mjs`: Music, Camera, Scissors, BookOpen, Heart, Leaf, Toolbox, Wrench, Hand — по 2 направления на 1 иконку; сабмитов под это нет |

---

## Хронология замеров этого файла

- 2026-11-05 14:40 — перезамер веток/деревьев (`git rev-list`, `git worktree list`, `git ls-remote`).
- 2026-11-05 14:46:58 +0200 — прогон `recheck-stand.mjs`: PASS 69 / FAIL 0 / SKIP 4, exit 0.
- 2026-11-05 14:5x — GET-зонды `/api/v1/moderation/*` → 401, `/api/auth/{login,register}` → 405.
