# Аудит медиаконвейера Talentro: почему фото карточек не доходят до браузера

Дата: 04.11.2026. Аудит — только чтение, правок в код/конфиг не вносилось.
Стенд: витрина `http://127.0.0.1:3000` / `http://26.52.103.163:3000` (build `k3yvyrSB0nN5sISONf_np`,
запуск из `.worktrees/integration/web`, `NEXT_PUBLIC_API_URL=http://127.0.0.1:8080`), API `:8080`.
В БД 10 путей `/media/...` у 8 занятий; все 10 отдают 404 и на `:8080`, и на `:3000`; файлов на диске нет.

## 0. Резюме для координатора (TL;DR)

Фото не видны из-за **трёх независимых разрывов**, и ни один из них не чинится «одним rewrite»:

1. **Файлов физически нет** (0 из 10). Ни одна правка конфига не создаёт содержимое.
2. **На стенде некому отдавать файлы**: Go-API не имеет роута `/media`
   (`route.go:12-44`, в `backend/Talentro` нули по `FileServer|StripPrefix|static`),
   а Caddy — единственный компонент, который их отдаёт — на Windows-стенде не запущен.
   Действующий rewrite `/media/:path*` → `NEXT_PUBLIC_API_URL` (`:8080`) указывает на мёртвую точку.
3. **Запущенный билд стенда не соответствует ни одному дереву** (см. §4), а «честный фолбэк»
   в `ResponsiveImage` подменяет живые карточки мок-фото `kids.jpg` — это противоречит правилу ТЗ
   «лучше пустое поле, чем правдоподобная догадка».

## 1. Таблица «звено цепи → ожидание → факт → вердикт»

№ | Звено | Ожидание | Факт (файл:строка) | Вердикт
--|-------|----------|--------------------|--------
1 | Путь в БД/API → фронт | `photos[].path` вида `/media/cards/1/x.jpg` доезжает до компонента без изменений | Маппинг as-is: `web/src/lib/api-server.ts:109` (`(media ?? []).map((item) => item.path)`); типы `ApiMedia.path` — `web/src/lib/api.ts:88-90` | **PASS**
2 | Файлы на диске (origin контента) | 10 файлов лежат в `MEDIA_HOST_DIR` (прод) / `web/public/media` (стенд) | Ни одного: `docs/content/photo-inventory.md:5-7,125` («Реально доступных файлов: 0 из 10 путей»); `docs/acceptance/stand-gaps-2026-11-04.md:72` (`/media/cards/** 404`); каталога `web/public/media` не существует (проверено `ls`) | **FAIL**
3 | Отдача файлов: Caddy (прод) | `/media/cards/1/x.jpg` → физический `/srv/media/cards/1/x.jpg` | `infra/Caddyfile:49-52`: `handle_path /media/*` срезает префикс, `root * /srv/media`, `file_server`; том: `docker-compose.yml:155` `${MEDIA_HOST_DIR:-/srv/media}:/srv/media:ro` (и `infra/docker-compose.caddy.yml:14` — жёсткий `/srv/media`). Правило маппинга корректно, но кормить его нечем (звено 2), и на стенде Caddy не запущен | **PASS** (правило) / **FAIL** (фактическая отдача: нет файлов, нет процесса)
4 | Отдача файлов: API `:8080` | (эталон архитектуры) API медиа не раздаёт — это задача Caddy | Подтверждено: `backend/Talentro/internal/delivery/http/route.go:12-44` — только `/health`, `/api/v1/*`, legacy `/api/*`, `/api/auth/*`; grep `FileServer|StripPrefix|/media` по `*.go` — 0 совпадений; у сервиса `api` в `docker-compose.yml` тома с медиа нет. Следствие: **rewrite с :3000 на API — мёртвая ветка**, 404 гарантирует и на стенде, и на проде при `NEXT_PUBLIC_API_URL=…:8080` | **FAIL** (как origin для rewrite-назначения)
5 | Rewrite/прокси в Next | `/media/:path*` → живой файловый origin | Код есть и **уже закоммичен**: `269e5b6` («фото бэкенда через /media прокси») — предок HEAD интеграции (`git merge-base --is-ancestor` ✓); `next.config.ts:3,10,20-24`, `src/lib/media.ts:16-21` (обе ветки, идентичны, `git status` чистый). Но: запуск стенда — сборка `k3yvyrSB0nN5sISONf_np`, `.next/BUILD_ID`integration = `h0jd_triIP66DrJypbzMG`, main = `j7-99fuxSF8wJbxcYe85s` (три разных; в текущем `required-server-files.json` интеграции `media/:path*` уже есть). Назначение rewrite на стенде — мёртвый API (звено 4) | **FAIL** (билд стенда рассинхронизован; назначение мертво)
6 | Конфиг `images` next/image | Пускать относительные `/media/...` без `remotePatterns` | Блок `images` отсутствует в обеих `next.config.ts` — и не нужен: `localPatterns` по умолчанию `undefined` → любые локальные пути разрешены (`node_modules/next/dist/shared/lib/image-config.js:119`; `shared/lib/image-loader.js:58-66`), `remotePatterns` проверяются только для абсолютных URL (`image-loader.js:68-80`). Next 16.4.4. `locales` в проекте не используются | **PASS** (дизайн «относительный путь + same-origin rewrite, без remotePatterns» корректен)
7 | Заимствований файла оптимизатором | `/_next/image?url=%2Fmedia%2F...` внутри тянет файл через пайплайн Next (public/** → rewrites) | Подтверждено по исходникам: `server/image-optimizer.js:747-773` `fetchInternalImage` → `handleRequest(mocked.req...)`, т.е. полный роутинг-пайплайн с фазой rewrites; non-2xx апстрима → ImageError → 404 браузеру | **PASS** (механизм; результат зависит от звеньев 2/4/5)
8 | Компонент строит URL | `photos[0]` → `<Image src>`; при пустом массиве — честная заглушка | `ActivityCard.tsx:116-128` (compact) и `:157-170`: `activity.photos[0] ? <ResponsiveImage src=.../> : coverEmpty «Фото нет»` | **PASS**
9 | Честный фолбэк при 404 | «Фото нет» (пустое поле), а не выдуманная картинка | `ResponsiveImage.tsx:17` `FALLBACK_SRC="/images/kids.jpg"`; `:38-41` `onError` подставляет мок-фото **на живые карточки**. Файл `web/public/images/kids.jpg` существует (обе ветки) → пользователь видит «детское фото» вместо реального снимка студии/поля. Это правдоподобная догадка — прямое нарушение правила ТЗ; плюс второй запрос и шум в консоли | **FAIL** (по честности)
10 | Кэш/CDN | Медиа переживает загрузку файлов без протухания; моки не ломаются | `Caddyfile:31-36` — только safety-заголовки, `Cache-Control` для `/srv/media` не задан (риск минимальный); `public/sw.js:41` кэширует только `/images/` (моки), `/media` не трогает; оптимизатор кэширует только успешные ответы | **риск** (нет `Cache-Control` на медиа-блоке Caddy — правка P3 ниже)

**Итого: 5 явных FAIL (звенья 2, 3-отдача, 4, 5, 9), 1 риск (10).**

## 2. Корневые причины (сжатые)

1. **Контент не загружен** — единственный первопричинный дефис: отдавать нечего.
2. **Архитектурный конфликт прокси**: закоммиченный rewrite (`269e5b6`) проксирует `/media` на
   `NEXT_PUBLIC_API_URL`. На проде (`.env.example:54`, `docs/deploy.md:71`) это публичный origin
   **через Caddy** — схема рабочая (волоспин: Next-оптимизатор → `https://домен/media/...` → Caddy →
   `/srv/media`). На стенде это голый Go-API `:8080` — схема мертва, т.к. API медиа не раздаёт (звено 4).
3. **Стенд собран не из того состояния**: `k3yvyrSB0nN5sISONf_np` не совпадает с `.next` ни одного
   дерева. Судя по `q=75` в консоли браузера, в运行-билд уже попал `269e5b6` (quality=75 введён им же),
   т.е. 404 на `/_next/image` с высокой вероятностью порождён не отсутствием rewrite, а мёртвым
   назначением прокси (API) + отсутствием файлов. Требуется пересборка/перезапуск с фиксацией BUILD_ID.
4. **Фолбэк нечестный** (звено 9): при отсутствии файла карточка тихо врёт «kids.jpg»,
   что маскирует проблему и нарушает требования ТЗ.

## 3. Проверка гипотезы: «достаточно ли одного rewrite, если файлов всё равно нет»

**Нет, недостаточно — трижды:**

- Rewrite не создаёт файлы: при 0/10 файлов получаем 404 в любом варианте (назначения нет чего возвращать).
- Даже после появления файлов: на текущем стенде `destination = http://127.0.0.1:8080` —
  Go-API без роута `/media` (`route.go:12-44`) ⇒ rewrite вернёт API-шный 404. **Единственный штатный
  раздающий компонент фото — Caddy (`Caddyfile:49-52`); rewrite с :3000 на API не имеет смысла как
  постоянная схема отдачи — зафиксировано явно.**
- Даже rewrite из дерева не действует на запущенном стенде: процесс крутит сборку
  `k3yvyrSB0nN5sISONf_np` ≠ текущего `.next` (`h0jd_triIP66DrJypbzMG`).

Минимум, чтобы фото «дошли»: файлы на диске у раздающего компонента + живой origin назначения +
пересборка/перезапуск витрины.

## 4. Точный минимальный набор правок

### 4.1 Локальный стенд на Windows (сейчас)

| # | Где | Что сделать | Тип |
|---|-----|-------------|-----|
| L1 | `.worktrees/integration/web` | Пересобрать и перезапустить витрину с текущим деревом (`npm run build && next start` с `NEXT_PUBLIC_API_URL=http://127.0.0.1:8080`). Зафиксировать новый BUILD_ID (ожидание: `media/:path*` в `.next/required-server-files.json` — в текущем уже есть) | ops, без кода |
| L2 | `.worktrees/integration/web/public/media/` | **Когда владелец принесёт файлы**: положить их в точности под путями БД: `public/media/cards/{id}/{файл}.jpg`, `public/media/locations/{id}/{файл}.jpg`. `public/**` проверяется раньше rewrites (комментарий `next.config.ts:8-9` подтверждается пайплайном из `image-optimizer.js:747`), поэтому **правок конфига не нужно вообще** — и `/media/...`, и `/_next/image` начнут отдавать 200. Креста с существующими моками нет: `public/media` сейчас не существует | ops (placement), без кода |
| L3 | `.worktrees/integration/web/src/components/ui/ResponsiveImage.tsx`, строки 16-17, 28-32, 38-41, 50-51 | **Честный фолбэк**: убрать подмену на `kids.jpg`, при ошибке загрузки `/media/...` рендерить пустое состояние «Фото нет» (тот же `coverEmpty`, что в `ActivityCard.tsx:165-169`). Минимальная замена: `useState(src)/useEffect` → `const [failed, setFailed] = useState(false); useEffect(() => setFailed(false), [src]); if (failed) return (<div className="coverEmpty" ...><ImageOff size={22}/><span>Фото нет</span></div>);` в `<Image>` — `src={src}`, `onError={() => setFailed(true)}`, удалить `FALLBACK_SRC`; добавить импорт `ImageOff` из `lucide-react`. Если `coverEmpty` недоступен из CSS-модуля компонента — нейтральный inline-стиль `display:grid;place-items:center;min-height:120px` | 1 правка кода |
| L4 | — | **Не** пытаться оживить rewrite на API: не добавлять в Go `/media`-статик (контракт §9 загрузки ещё нет, том `/srv/media` API не примонтирован). Раздающий — Caddy (прод) или `public/media` (стенд) | решение, зафиксировать в план |

Вариант «стенд через Caddy» (L2-alt): поднять `docker compose up db api web caddy` из корня интеграции,
`MEDIA_HOST_DIR=<папка с файлами>`. Риск зафиксирован: `docker-compose.yml:14-17` — в ветке интеграции
**нет `web/` каталога/Dockerfile**, compose-сборка web не пройдёт, пока web-ветка не влита. Поэтому L2
(placement в `public/media`) — рабочий минимум сегодня.

### 4.2 Прод через Caddy (потом)

| # | Где | Что сделать | Тип |
|---|-----|-------------|-----|
| P1 | хост VDS, `${MEDIA_HOST_DIR:-/srv/media}` | Файлы координатором: `rsync` оригиналов в `/srv/media/cards/{id}/` и `/srv/media/locations/{id}/`, `chmod -R a+rX /srv/media` (эталон: `docs/deploy.md:273-277`). Маппинг Caddy проверен: `/media/cards/1/x.jpg` → `/srv/media/cards/1/x.jpg` — правок Caddyfile для отдачи не требуется | ops |
| P2 | VDS `.env` + web-образ | `NEXT_PUBLIC_API_URL=https://<публичный домен>` (не `…:8080`!) — тогда закоммиченный rewrite делает волоспин через Caddy и находит файл (механизм: `image-optimizer.js:747-773` → rewrites → Caddy → file_server). Пересобрать web: destination компилируется в build (`required-server-files.json`). Проверка изнутри контейнера: `docker compose exec web sh -c 'wget -qO- https://<домен>/media/cards/1/palitra-oblozhka.jpg | head -c 16'` — если DNS/TLS-волоспин из контейнера не работает (предупреждение `deploy.md:303`), План B: для путей, начинающихся с `/media/`, рендерить нативный `<img>` в обход оптимизатора (альтернатива описана в `deploy.md:181-183`); Caddy-раздача при этом та же | ops + 1 env + rebuild |
| P3 | `infra/Caddyfile`, после строки 51 (`file_server`) внутри `handle_path /media/*` | Опционально (снять риск звена 10): добавить `header Cache-Control "public, max-age=86400"` | 1 строка конфига |
| P4 | `docs/deploy.md:176-183` (§4.2) | У устаревшей заметки: она утверждает, что правки нет, но `269e5b6` уже её внёс (rewrite-подход выбран). Привести §4.2 в соответствие: описать принятый дизайн (относительный путь + rewrite same-origin + Caddy как файловый origin; `remotePatterns` не нужен — проверено по `image-loader.js:58-80` в Next 16.4.4) | docs |

### 4.3 Развилка веток, требующая решения координатора

- Контекст задачи («rewrite не закоммичен, лежит untracked в `web/next.config.ts`») **устарел**: правка
  закоммичена в `269e5b6` (ветка `feat/15-clean-site-tester-session`) и является предком HEAD интеграции
  (`4f0ae6a`); рабочее дерево интеграции чистое. Во время аудита дерево обновилось на глазах
  (первое чтение `next.config.ts` — 15 строк без rewrites; повторное — rewrites есть): вероятно,
  параллельный merge/pull. Перед правками L1/L3 убедиться, что стенд пересобирается из актуального HEAD.
- `ResponsiveImage.tsx` в двух деревьях **разные**: main-tree — без фолбэка (`src={src}`, quality 75,
  строка 29), интеграция — с фолбэком `kids.jpg` (`:17,38-41`). L3 делать в одном месте и синхронизировать
  через merge, иначе возвратим `kids.jpg` слиянием.

## 5. Что должен принести владелец (из `photo-inventory.md`)

Точные пути (совпадают с БД — иначе карточка останется на заглушке, `photo-inventory.md:97-99`),
прод-адрес файла = `/srv/media` + путь без префикса `/media`, адрес стенда = `web/public/media` + то же.

№ | Путь в БД (он же URL) | Сюжет | Что за кадр | Требования (fmt/размер/вес)
--|----------------------|-------|-------------|------------------------------
1 | `/media/cards/1/palitra-oblozhka.jpg` | Студия «Палитра», обложка | дети за мольбертами / акварель крупно, педагог помогает | JPEG/WebP sRGB, 3:2, ≥1200×800 (идеал 1600×1067), ≤2 МБ
2 | `/media/cards/1/palitra-zal.jpg` | «Палитра», галерея | общий зал с мольбертами, материалы, работы на стене | 3:2/4:3, длинная сторона ≥1600 px, ≤2 МБ
3 | `/media/locations/1/studiya-palitra.jpg` | «Палитра», точка | интерьер основного зала | 3:2, ≥1200×800, ≤2 МБ
4 | `/media/cards/2/dnestr-pole.jpg` | «Днестр», обложка | тренировка на поле, мяч, ворота/разметка | 3:2, ≥1200×800, ≤2 МБ
5 | `/media/locations/2/dnestr-pole.jpg` | «Днестр», точка (поле на Населёнке) | тот же сюжет, второй путь — прислать отдельный файл или копию (у «зала в манеже» фото нет и не заводим) | 3:2, ≥1200×800, ≤2 МБ
6 | `/media/cards/3/robo-zanyatie.jpg` | Робототехника, обложка | сборка/программирование робота, конструктор + ноутбук | 3:2, ≥1200×800, ≤2 МБ
7 | `/media/cards/4/tancy-parnoe.jpg` | Бальные танцы, обложка | пара/группа в зале, парная постановка | 3:2, ≥1200×800, ≤2 МБ
8 | `/media/cards/5/podgotovka-klass.jpg` | Подготовка к школе, обложка | дети пишут/читают с педагогом за столами | 3:2, ≥1200×800, ≤2 МБ
9 | `/media/cards/6/shakhmaty-turnir.jpg` | Шахматы, обложка | партия за доской, часы и фигуры в кадре | 3:2, ≥1200×800, ≤2 МБ
10 | `/media/cards/9/repetitor-urok.jpg` | Репетитор, обложка | тетрадь/доска/экран с задачей; лицо ребёнка опционально | 3:2, ≥1200×800, ≤2 МБ

Отдельно (не в БД, согласовать с координатором прежде чем создавать запись): предлагаемый путь
карточки 10 — `/media/cards/10/veselye-noty-oblozhka.jpg` (`photo-inventory.md:76-79`).

Обязательные условия для всех строк (`photo-inventory.md:81-118`): оригиналы (не скриншоты и не
пересылка в мессенджере); имена — латиница без пробелов, шаблон `{slug}-{сюжет}.jpg`; без рамок,
коллажей, подписей, чужих логотипов; узнаваемые дети — только с письменного согласия родителей,
иначе ракурсы без лиц; при загрузке заполнить в БД `source_url` и `author`; после выкладки проверить
`curl -sI http://<стенд>/media/... → 200` (чек-лист п.8). **Никаких стоковых/AI-заменителей** — пустая
заглушка честнее.

## 6. Не сломают ли правки моки `web/public/images`

Проверено listing'ом и кодом — **нет**:

- В обеих ветках в `web/public/images` лежат 32 мока (`art.jpg, ..., kids.jpg, yoga.jpg`); `kids.jpg`
  существует — текущий фолбэк технически работает (и именно поэтому в консоли видно только 404
  оптимизатора, а не битые карточки).
- Rewrite имеет source строго `/media/:path*` — с `/images/...` не пересекается; плоские rewrites
  исполняются после проверки `public/**` (комментарий `next.config.ts:8-9`, механизм
  `fetchInternalImage → handleRequest`). Моки继续 отдаются с диска.
- Моки каталога ссылаются на `/images/...` (`data.ts:389,519,...`) — ни один путь не меняется.
-新增 `public/media/` (L2) — новый каталог, конфликтов с `public/images` нет.
- Правка L3 удаляет только использование `kids.jpg` как фолбэка живых карточек; сам файл остаётся
  и продолжает работать моком галереи (`data.ts:519`).
- `sw.js:41` кэширует `/images/` — поведение моков через service worker не меняется; `/media` SW не
  перехватывает, так что после выкладки файлов не будет «залипшего 404» из SW-кэша.

## 7. План приёмки после починки

1. `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/media/cards/1/palitra-oblozhka.jpg` → 200 (стенд, после L1+L2).
2. `curl -s 'http://127.0.0.1:3000/_next/image?url=%2Fmedia%2Fcards%2F1%2Fpalitra-oblozhka.jpg&w=640&q=75' -o /tmp/i.jpg` → 200, `file` определяет JPEG/WebP/AVIF.
3. Консоль браузера на `/` (real-режим): ноль 404 по `/_next/image`; карточки 1-6,9 с реальными фото; карточка 10 — «Фото нет».
4. `curl -s http://127.0.0.1:3000/images/kids.jpg` → 200 (моки живы).
5. Прод: `curl -sI https://<домен>/media/cards/1/palitra-oblozhka.jpg` → 200 + `Cache-Control` (после P3).
6. Автотест-хелпер уже есть: `docs/acceptance/recheck-stand.mjs` (секция `/media`, строки 630-736).

## 8. Приложение: ключевые свидетельства

- Фолбэк: `.worktrees/integration/web/src/components/ui/ResponsiveImage.tsx:17` (`FALLBACK_SRC`), `:38-41` (`onError`), `:50` (`quality={75}` — совпадает с `q=75` в консоли стенда).
- Компонент: `.worktrees/integration/web/src/components/catalog/ActivityCard.tsx:116-128,157-170`.
- Маппинг: `.worktrees/integration/web/src/lib/api-server.ts:109`.
- Rewrite: `.worktrees/integration/web/next.config.ts:3,10,20-24`; `src/lib/media.ts:16-21`; тест `src/lib/media.test.ts`.
- Go: `internal/delivery/http/route.go:12-44` (нет `/media`); grep `FileServer|StripPrefix` — 0.
- Caddy/compose: `infra/Caddyfile:49-52`; корневой `docker-compose.yml:155` (`MEDIA_HOST_DIR`), `infra/docker-compose.caddy.yml:14`; `docs/deploy.md:71,75,176-183,273-277,303`.
- Next 16.4.4: `node_modules/next/dist/shared/lib/image-config.js:119`, `shared/lib/image-loader.js:58-80`, `server/image-optimizer.js:747-773`.
- Инвентарь: `docs/content/photo-inventory.md` (= копия в интеграции); `docs/acceptance/stand-gaps-2026-11-04.md:55,72,102`.
- Расхождение билдов: контекст `k3yvyrSB0nN5sISONf_np` vs `.next/BUILD_ID` интеграции `h0jd_triIP66DrJypbzMG` vs main `j7-99fuxSF8wJbxcYe85s`.
