# Координация разработки фронтенда

## Роли и задачи

### Aider (верстка и UI):
1. Верстка интерфейсов по макетам
2. Стилизация с использованием Tailwind CSS
3. Адаптивная верстка для мобильных устройств
4. Создание визуальных компонентов:
   - Карточки организаций
   - Фильтры и формы
   - Навигационные элементы
   - Индикаторы загрузки
5. Анимации и переходы
6. Типографика и визуальная иерархия

### QodeX (логика и API):
1. Реализация бизнес-логики
2. Интеграция с Leaflet для интерактивной карты
3. Управление состоянием приложения
4. Создание хуков для работы с данными
5. Разработка API-клиентов
6. Интеграция с бэкендом
7. Реализация фильтрации и поиска
8. Обработка ошибок и состояний загрузки

## Компоненты и задачи

### Карта (Map)
- Aider:
  - Верстка контейнера карты
  - Стилизация маркеров и попапов
  - Адаптация для мобильных устройств
- QodeX:
  - Интеграция с Leaflet
  - Подключение API для данных
  - Реализация фильтрации
  - Управление состоянием карты

### Карточка организации (OrganizationCard)
- Aider:
  - Верстка карточки
  - Стилизация контента
  - Адаптивный дизайн
  - Анимации при наведении
- QodeX:
  - Подключение API для данных
  - Реализация отзывов (§10.2: звёзд и «рейтинга» в каталоге нет)
  - Интеграция с картой

### Фильтры (Filters)
- Aider:
  - Верстка компонента фильтров
  - Стилизация элементов формы
  - Адаптация для мобильных устройств
- QodeX:
  - Получение списка категорий
  - Реализация логики фильтрации
  - Интеграция с API

## API Endpoints

1. Получение списка организаций
   - Метод: GET
   - URL: /api/organizations
   - Параметры:
     - city: 'Тирасполь' | 'Бендеры' | … (см. `CityName`)
     - category: 'sport' | 'art' | 'language' | 'other'
     - age: number (один возраст ребёнка, §5.2 — не диапазон `ageGroup`)
     - priceType: 'free' | 'paid'
     - searchQuery: string
   - Ответ:
     ```typescript
     interface Organization {
       id: string;
       name: string;
       description: string;
       address: string;
       city: CityName;
       contacts: string;
       ageRange: [number, number];
       tags: string[];
       coordinates: Coordinates;
       reviews?: Review[];
       priceType: 'free' | 'paid';
       category: 'sport' | 'art' | 'language' | 'other';
     }
     ```

2. Получение данных организации
   - Метод: GET
   - URL: /api/organizations/:id
   - Ответ:
     ```typescript
     interface OrganizationDetails extends Organization {
       reviews: Review[];
     }
     ```

3. Получение списка категорий
   - Метод: GET
   - URL: /api/categories
   - Ответ:
     ```typescript
     interface Category {
       id: string;
       name: string;
     }
     ```

## Типы данных

Все типы данных определены в `src/types/index.ts`:
- `Coordinates` - координаты организации (`{ lat, lng }`, не tuple)
- `OrganizationCategory`, `PriceType`, `CityName` - машинные значения фильтров
- `Review` - отзыв об организации
- `Organization` - основная информация об организации
- `Filters` - параметры фильтрации (все поля необязательные)

## Тестовые данные

Тестовые данные для разработки находятся в `src/mocks/data.ts`:
- `mockOrganizations` - массив тестовых организаций
- `cities` - справочник городов (единый источник списка для селекта)
- `cityCoordinates` - центры городов, к которым летит карта при выборе города

## Аудит фильтрации и карты (3 ноября 2026, QodeX)

Проверялось: `src/components/Map.tsx`, `src/components/Filters.tsx`, `src/types/index.ts`,
`src/mocks/data.ts`, `src/components/OrganizationCard.tsx`, `src/pages/map.tsx`.

### Найдено и исправлено

1. **`Filters.tsx` — фильтрация не работала в принципе.** Значения опций были
   человекочитаемыми (`'Спорт'`, `'Бесплатно'`), а в данных — машинные (`'sport'`,
   `'free'`): сравнение никогда не давало true. Теперь `value` берётся из
   `categoryOptions` / `priceOptions` (`src/lib/filter.ts`), подпись остаётся русской (§4.5).
2. **`Filters.tsx` — смена одного селекта обнуляла остальные.** `onChange` отдавал
   `{ category: name === 'category' ? value : '', ... }`, то есть любое изменение стирало
   два других поля. Компонент стал контролируемым: принимает `filters` + `onChange(patch)`,
   слияние делает `mergeFilters`, состояние живёт на странице.
3. **Фильтра по городам не было вовсе** (ни Тирасполя, ни Бендер). Добавлен селект из
   `cities`, а у `Organization` появилось обязательное поле `city: CityName` — раньше город
   приходилось угадывать из префикса `address` (§5.9).
4. **Возраст был возрастной группой** (`'3-6' | '7-12' | '13-18'`) вместо одного числа
   (§5.2). В `Filters` теперь `age?: number` + числовое поле с подсказкой при ошибке.
5. **Клик по маркеру ничего не делал.** В `Map.tsx` не было ни `Popup`, ни обработчиков.
   Добавлены: попоп (название, адрес, возраст, ссылка `/organization/:id`), `onSelect(id)`
   через `eventHandlers.click`, подсветка выбранного маркера, список результатов справа
   синхронизирован с картой в обе стороны.
6. **Маркеры были невидимы.** `Marker` без `icon` тянет `L.Icon.Default` с битыми путями к
   png под сборщиком. Теперь `L.divIcon` + стили `.mapPin` / `.mapPin--selected` в
   `src/styles/globals.css`.
7. **`Map.tsx` принимал не те данные.** Пропс был `markers?: [{ position: [lat, lng] }]` при
   `coordinates: { lat, lng }` в типе, и `/map` рендерил `<Map />` без пропсов — маркеров не
   было никогда. Теперь `organizations: Organization[]` (+ `activeCity`, `selectedId`, `onSelect`).
8. **`OrganizationCard.tsx` падал при рендере.** `<MapPin/>`, `<Phone/>`, `<Users/>`
   использовались без импорта (TS2304 → ReferenceError в браузере). Иконки импортированы из
   `lucide-react`; локальный дубль `interface Organization` с `coordinates: [number, number]`
   удалён — карточка использует общий тип из `@/types` (иначе мок в неё не передаётся).
9. **Звёздный рейтинг противоречил §10.2** («звёзд нигде нет»): удалён `rating` из `Review`
   и `Organization`, а также из мока. Потребителей в UI не было — проверка по grep.
10. **Глобальный CSS вне `_app`.** `import 'leaflet/dist/leaflet.css'` был внутри `Map.tsx`;
    в pages-router это ошибка сборки. Импорт перенесён в `src/pages/_app.tsx`.
11. **`/organization/[id]` был заглушкой** и показывал только `id`, хотя попап карты ведёт на
    эту страницу. Подключён мок: карточка организации, состояние «не найдено» + возврат к карте.

### Новые файлы

- `src/lib/filter.ts` — чистая логика: `filterOrganizations`, `mergeFilters`,
  `categoryOptions`, `priceOptions`, `defaultFilters`, `isAge` (без React, тестируется точечно).
- `src/lib/filter.test.ts` — 14 проверок на Node (без фреймворка).

### Как воспроизвести проверки

Корневой `src/` — заготовка без `package.json`, `tsconfig.json` и `node_modules`, поэтому
собрать или запустить её как приложение нельзя. Проверки гоняются так:

```bash
# 1) типы всего корневого src/ (нужен junction с зависимостями web/)
mklink /J D:\CyberSprint\node_modules D:\CyberSprint\web\node_modules
npx --prefix web tsc -p D:/CyberSprint/.audit-tmp/tsconfig.json   # exit 0

# 2) логика фильтрации (Тирасполь/Бендеры, категории, возраст, цена, поиск)
node --experimental-strip-types src/lib/filter.test.ts            # 14/14

# 3) реальные Map/Filters с подставным react-leaflet: пропсы, клики, контролируемые поля
node .audit-tmp/render-test.mjs                                   # 11/11
```

Результаты на момент аудита: tsc — 0 ошибок, `filter.test.ts` — 14/14, `render-test.mjs` — 11/11.

### Не проверено (и почему)

- Поведение Leaflet в браузере (реальное открытие попопа, кластеризация, `flyTo` при выборе
  города): в `web/node_modules` нет jsdom/testing-library, а сам корневой проект не запускается.
  Обработчик клика и пропсы проверены на подставных примитивах, `useEffect` с `flyTo` — только
  типами. Это нужно подтвердить вручную на `/map` после того, как корневой проект получит
  свой `package.json`, либо переносом логики в `web/` (там `LeafletCatalogMap.tsx` уже делает
  `divIcon` + `flyTo`).
- Кластеры (`leaflet.markercluster`) и радиус «рядом со мной» в корневом `src/` не подключены —
  это задача #4, реализовано в `web/src/components/map/LeafletCatalogMap.tsx`.

### Что дальше (для Aider)

- Верстка попапа и списка результатов (`src/pages/map.tsx`) — классы Tailwind стоит привести к
  дизайн-системе `web/src/app/globals.css`, сейчас разметка живёт на голых Tailwind-классах.
- `src/pages/index.tsx` (блок «Быстрый поиск») не подключён к `filterOrganizations` — логика
  готова, нужен только wiring.
- Дублирование слоёв: `web/src/lib/filters.ts` (slug-значения, `catalogMarkers`, `cityCenters`)
  и `src/lib/filter.ts` (значение-константы из мока) решают одну задачу. Пока корневой `src/`
  остаётся заготовкой, правки в него не должны расходиться с `web/`; при переносе — использовать
  версию из `web/`.

## Аудит импортов и путей `@/...` (3 ноября 2026, вечер, QodeX)

Проверялись все `import`/`require`/`dynamic(import())` в `src/pages/`, `src/app/`, `src/components/`
обеих веток: корень (`D:/CyberSprint/src`) и `web/` (`D:/CyberSprint/web/src`). Спецификаторов —
140, разрешение: `@/*` → `src/*` плюс относительные пути, расширения `.ts/.tsx/.js/.css` и `index.*`.

Инструменты: `node .audit-tmp/import-scan.mjs` (резолв путей) и `npx --prefix web tsc -p web/tsconfig.json --noEmit`
(ссылки на несуществующие экспорты и опущенные импорты). После правок: битых ссылок — 0,
ошибок в `web/src` — 0, в корневом `src/` — 0, `src/lib/filter.test.ts` — 14/14.

### Исправлено

1. **`web/src/pages/index.tsx` → `@/lib/api` (модуля нет и никогда не было).** Реальный слой —
   `@/lib/data` (готовые массивы) + `@/lib/filters` (`parseFilters`, `filterCatalog`). Попутно в
   этом же файле: `filtersToParams(context.query)` вызывался вместо `parseFilters` (возвращал
   `URLSearchParams` вместо `FilterState`), `Math.ceil(total / 20)` читал `total` до объявления
   (TDZ → падение на каждом запросе), а `getActivities({ count: true, group: … })` использовал
   API, которого в слое данных нет. Страница переписана по образцу рабочего
   `app_bak/page.tsx`: тот же состав пропсов `CatalogClient`, та же пагинация и «рядом по теме».
2. **`web/src/components/catalog/ActivityCard.tsx` — `<ResponsiveImage/>` без импорта**
   (TS2304 в двух местах → ReferenceError при рендере каталога). Компонент существует в
   `@/components/ui/ResponsiveImage`, импорт добавлен.
3. **`ActivityCard` ломался на скелете.** `CatalogClient:376` рендерит `<ActivityCard skeleton />`
   без `activity`, но `activity: Activity` был обязательным, а хуки инициализировались через
   `activity.groups[0]`. `activity` стал необязательным (только для скелета), вычисляемые поля
   перенесены под ранний возврат скелета, проверка `if (skeleton || !activity)`.
4. **`ResponsiveImage` не проходил типы Next 16.** Проп `srcSet` в `next/image` больше не входит в
   `ImageProps` (Omit в `next/dist/shared/lib/get-img-props.d.ts`), плюс вручную собирался URL с
   `?fm=webp&w=…` — для локальных `/images/*.jpg` это meaningless. Убраны `srcSet`,
   `unoptimized` и пересборка URL: `next/image` сам генерирует srcset и форматы.
5. **`@/app/legal.module.css` — 5 битых ссылок** (`components/legal/LegalLayout.tsx` и 4 страницы
   в `app_bak/`) из-за переименования `web/src/app` → `web/src/app_bak`. Файл перенесён к
   единственному живому потребителю — `web/src/components/legal/legal.module.css`, все 5 импортов
   переведены на него. Путь больше не зависит от того, как называется директория маршрутов,
   поэтому переживает и возврат к App Router, и переход на Pages Router.

### Не исправлено — требует решения того, кто ведёт миграцию

> **Решено 4 ноября 2026.** По выбору владельца возвращён App Router: `web/src/app_bak` →
> `web/src/app`, незаконченная заготовка Pages Router перенесена в `web/src/pages_draft`
> (файлы не удалялись). Пункты 1–4 этого списка снимаются сами: живое дерево — только
> `src/app`, пустые заглушки и `index.tsx` выведены из сборки (`src/pages` отсутствует),
> `.next` пересобран. Подробности — в разделе «Возврат к App Router» ниже.

Ровно в 23:17 в `web/src/` появилась пустая заготовка Pages Router, а в 23:38 там же
сохранялась правка; `web/src/app` переименован в `app_bak` в 23:01. Это чужая незаконченная
работа, поэтому её содержимое не трогалось.

1. **7 пустых файлов** (0 байт): `web/src/pages/map.tsx`, `web/src/pages/profile.tsx`,
   `web/src/pages/admin/add-section.tsx`, `web/src/components/{Filters,Layout,Map,OrganizationCard}.tsx`.
   Пустой файл в `pages/` — это маршрут без default-экспорта, `next build` на нём падает
   (`tsc` это уже показывает как TS2306 в `.next/dev/types/validator.ts`). Четыре пустых
   компонента в `web/src/components/` никем не импортируются — дубли корневой заготовки.
2. **`web/src/pages/` без `_app.tsx` и `_document.tsx`.** Глобальные стили
   (`app_bak/globals.css`, ~8000 строк дизайн-системы) сейчас не подключены ни одним живым
   файлом, шрифты и `AppProviders` (избранное, сессия, тосты) тоже живут только в
   `app_bak/layout.tsx`. Пока миграция не завершена, `/` рендерится без стилей и провайдеров.
3. **`app_bak` (≈40 страниц App Router) выведен из сборки.** Всё, что было проверено и работает
   (`/account`, `/favorites`, `/map`, `/organizations/[slug]`, `/activities/*`, `/legal`), сейчас
   недоступно: Next видит только `src/pages` с одной живой страницей `/`.
4. **`.next/types/validator.ts`** сгенерирован под старое дерево `src/app/**` и даёт ~70 ошибок
   TS2307/TS2344, не связанных с кодом. Они уходят сами после `rm -rf .next && next build` — но
   только когда пункты 1–3 решены.

Проверка `http://localhost:3000` ответов не дала (сервер не запущен), поэтому фактический рендер
`/` после починки `index.tsx` в браузере не подтверждён — подтверждено только типами и резолвом путей.

### Что делать дальше по порядку

1. Определиться с роутером в `web/`: либо вернуть `app_bak` → `app` (App Router, всё уже работает),
   либо довести `src/pages` (создать `_app.tsx` с `import "../styles"`/globals + `_document.tsx`,
   перенести маршруты из `app_bak`, удалить пустые заглушки).
2. Не держать две копии одинаковых компонентов: `Map/Filters/Layout/OrganizationCard` есть и в
   корневом `src/`, и пустыми в `web/src/components/`.
3. После пункта 1 — `rm -rf web/.next`, `npm --prefix web run build`, затем прогон
   `node .audit-tmp/import-scan.mjs` для контроля импортов.

## Возврат к App Router и запуск (4 ноября 2026, QodeX)

Выбор сделан владельцем: живое дерево — App Router.

1. `web/src/app_bak` → `web/src/app` (40 маршрутов, `layout.tsx` с `AppProviders`, `globals.css`
   ~8000 строк дизайн-системы).
2. Незакченная заготовка Pages Router перенесена целиком в `web/src/pages_draft/` (ничего не
   удалялось): `index.tsx` (переписан на `@/lib/data` + `parseFilters`/`filterCatalog`), пустые
   `map.tsx`, `profile.tsx`, `admin/add-section.tsx`, `components/*`. Каталога `src/pages` в `web/`
   больше нет, поэтому `next build` эти файлы не видит и 7 пустых файлов сборку не ломают.
3. `rm -rf web/.next` → `npm --prefix web run build`: exit 0, «Compiled successfully»,
   74 статических страниц. `tsc` по `web/src` — 0 ошибок.
4. `npm --prefix web run dev` (порт 3000) — Ready, 0 ошибок в логе. Ответы: 200 на `/`, `/map`,
   `/favorites`, `/account`, `/login`, `/register`, `/organizations/studiya-palitra`,
   `/activities/hudozhestvennaya-studiya-palitra`, `/activities/…/reviews`,
   `/account/activities/app-palitra-sketch`, `/account/activities/new`, `/privacy`, `/request`,
   `/about`, `/terms`, `/rules`, `/offline`; ожидаемые 404 — `/activities` (индекса нет) и
   заведомо несуществующий slug.
5. Известный дефект `pages_draft/index.tsx` (вне живого дерева, не чиним): 500
   «Error serializing `.results[0].activity.groups[0].priceTo`» — Pages Router не сериализует
   `undefined` из `getServerSideProps`; в App Router той же проблемы нет.

## Сверка с ТЗ «Talentro» (4 ноября 2026, QodeX)

Проверялось: полный текст ТЗ (`tz_text.txt`) против `web/src` — маршруты `src/app`, компоненты
`src/components`, слой данных `src/lib/{types,data,filters,utils}.ts`. Статусы: реализовано,
частично, нет, противоречит.

| §ТЗ | Требование | Статус | Где |
|---|---|---|---|
| 3.1 | Каталог: карточка=занятие, чипы, «Найдено N», пагинация 20, скелетон, пусто + «рядом по теме» | реализовано | `app/page.tsx:15-48`, `catalog/CatalogClient.tsx:302-439` |
| 3.1.8 / 10.8 | Состояние «ошибка сети — повторить» в каталоге | нет | есть только `app/error.tsx`, `app/offline/page.tsx`; ветки error в `CatalogClient.tsx` нет |
| 3.2 | Карточка в списке (обложка, цена, возраст, адрес, сердечко, дата проверки) | частично | `catalog/ActivityCard.tsx:133-292` — наднаправление заменено направлением (`:173`); «ещё N групп» без условия `>1` (`:187`) |
| 3.3 / 3.4 | Карточка занятия и услуги: галерея, группы, точки, звонок, голоса, жалоба | реализовано | `activity/ActivityDetail.tsx:285-836` |
| 3.5 | Карта: OSM, кластеры, метки, радиусы, «Найдено» считает занятия | реализовано | `map/LeafletCatalogMap.tsx:45-126`, `map/MapClient.tsx:40-306`, `lib/filters.ts:400-446` |
| 3.5.6 | Чипы радиуса 500 м / 1 / 3 / 10 км | противоречит | на `/map` верно (`MapClient.tsx:40-45`), в сайдбаре 1/3/5/10 км без 500 м (`catalog/FilterSidebar.tsx:276-280`) |
| 3.6 | Избранное | реализовано | `favorites/FavoritesClient.tsx`, `providers/AppProviders.tsx:162-193` (localStorage) |
| 3.7 | Вход/регистрация | частично | `auth/AuthForm.tsx:192-266` — только клиент, кнопка Google фиктивная |
| 3.8 / 3.8.1 | Анкета владельца (шаги, валидация, медиа 1600 px / 30 с, черновик); статусы + причина отказа + SLA | реализовано | `account/ApplicationForm.tsx:43-1584`, `account/OwnerCabinet.tsx:198-234`, `lib/utils.ts:167-182` |
| 3.9 / 12.15 | Кабинет модератора: очереди, publish/reject, журнал, просрочка SLA, жалобы, блокировки | нет | ссылке из `layout/Header.tsx:186` вести некуда; моки `lib/data.ts:1957-2152` никем не читаются |
| 3.10 | Страница организации (точки, фильтр по точке) | частично | `organization/OrganizationClient.tsx:24-225`; мессенджеры — один вместо списка |
| 3.11 / 12.13 | 4 юридические страницы, дисклеймер, «© OpenStreetMap» | реализовано | `app/{about,rules,privacy,terms}/page.tsx`, `about/page.tsx:257-271`, `privacy:138-303`, `rules:62-121` |
| 3.12 | Заявка «не нашли» (от 5 знаков, ограничение частоты) | реализовано локально | `request/RequestClient.tsx:18-62` |
| 4 / 8 | Справочники: 9 наднаправлений, 8 городов, районы | частично | `lib/data.ts:20-30, 92-113`; перечень направлений расходится с §4 |
| 5 / 5.2 | Фильтры: нормализация `ё`, возраст одним числом, цена, район⇐город, «проверенные ≤90 дней», сортировка по голосам (≥3), пустые значения не в URL | логика верна, UI противоречит | `lib/filters.ts:76-343` (`age` сравнивается с `[ageFrom; ageTo]` группы — `:148-150`); в UI только чипы 3/5/7/10/12/15/18 (`catalog/FilterSidebar.tsx:45-53, 474-481`), число 8 ввести нельзя, подпись «От N лет» (`:468`) меняет смысл на нижнюю границу |
| 6.2 | Next SSR, PWA, адаптив | реализовано | `app/layout.tsx`, `app/manifest.ts`, `public/sw.js` |
| 9 | API-слой (20 эндпоинтов) | нет | в `src/lib` нет `api.ts`; поиск `fetch(` по `web/src` даёт 0 совпадений |
| 10.2 | Звёзд/рейтингов нет — только «плюс/минус» | реализовано | `activity/ActivityDetail.tsx:623-649` |
| 10.3 | Цена без красного цвета | реализовано | `app/globals.css:1856-1869` |
| 10.6 | Зона нажатия ≥ 44×44 px | противоречит | `app/globals.css:1547-1556` (`.favoriteButton` 32×32), `:4320-4331` (`.voteButton` 34 px), `:1692-1706` (`.cardMetaButton` 26 px), `.cardLocationButton`/`.dayButton`/`.segment`/`.choicePill`/`.activeFilterChip` 25–31 px |
| 15.6 | Читаемый кегль | противоречит | `font-size: 8px` в `app/globals.css:1692-1706, 1871-1881, 2555-2566`, `9px` в `:4320-4331` |
| 10.17 | `aria-expanded` на раскрывающих | реализовано | `catalog/ActivityCard.tsx:181, 231` |
| 10.19 / 10.20 | Форма отзыва | реализовано | `activity/ReviewsBlock.tsx:24-518` |
| 10.21 | OG-теги и SSR для карточек | реализовано | `app/activities/[slug]/page.tsx:28-66` |

### Главные расхождения с ТЗ (по убыванию критичности)

1. **§3.9 — кабинета модератора нет вовсе.** Модерационный контур (§3.9, §12.15, §15.8, §15.16)
   непроверяем: очереди, журнал, жалобы, дефициты и блокировки лежат в моках
   (`lib/data.ts:1957, 2013, 2076, 2117-2152`), потребителей ноль; список причин отказа
   `moderationRejectReasons` не подключён ни к экрану, ни к валидации.
2. **§9/§12 — готовность к бэкенду нулевая.** Ни одного API-клиента; голоса, избранное, жалобы,
   заявки и анкеты живут в `useState`/`localStorage`; роль выводится из подстроки почты
   `moder`/`owner` (`providers/AppProviders.tsx:112-121`) вместо `GET /me`;
   `NEXT_PUBLIC_API_URL` отсутствует (в коде только `NEXT_PUBLIC_SITE_URL`, `app/layout.tsx:9`).
3. **§10.6 и §15.6 — доступность.** Тап-зоны 25–34 px и кегль 8–9 px не пройдут приёмку;
   задача №9 в трекере остаётся открытой.
4. **§3.5.6 — два разных набора радиусов** (карта 500 м/1/3/10 км, сайдбар 1/3/5/10 км);
   чинится одним источником значений в `lib/filters.ts`.
5. **§5.2 — возраст только пресетами:** семантика фильтра верная, но произвольное число не ввести,
   а подпись «От N лет» не соответствует реальной логике.
6. **§4 — справочник направлений разошёлся:** сервисные позиции (массаж, маникюр, груминг,
   репетиторство, фотоуслуги) сложены в `superSlug: "other"` (`lib/data.ts:85-89`), «перевозка»
   отсутствует, «верховая езда» (`:70`) в §4 нет, а «выращивание растений», «краеведение»,
   «работа с инструментом», «слесарное дело», «благотворительность» (`:66-83`) не заведены.
7. **§4.5 — единый источник списка нарушен:** названия наднаправлений второй раз хардкоднуты в
   `lib/utils.ts:62-75` (против `lib/data.ts:20-30`), третья копия — 4 категории в корневом
   `src/lib/filter.ts:4-9`.
8. **§3.3.7 / табл. 2 п.8 — мессенджеры:** одна кнопка «Написать организации» по первому найденному
   контакту (`activity/ActivityDetail.tsx:82-92, 665-674`;
   `organization/OrganizationClient.tsx:24-31`), ТЗ требует каждый своей кликабельной строкой.
9. **§3.3.6 — «Как добраться»** есть только на карте (`map/MapClient.tsx:302-306`), в раскрытой
   точке карточки занятия — нет (`activity/ActivityDetail.tsx:529-585`).
10. **§3.3.3 — диапазон цен в шапке** печатается только когда группа не выбрана
    (`activity/ActivityDetail.tsx:218-219, 615`); при выбранной группе различие цен теряется.
11. **§10.2 — «0 / 0» вместо «голосов нет»** в карточке списка
    (`catalog/ActivityCard.tsx:273-278`); в карточке занятия всё по ТЗ.
12. **§3.1.10 — «рядом со мной»** считает расстояние от центра города
    (`lib/filters.ts:269, 296-300`), геолокация запрашивается только на `/map`
    (`catalog/FilterSidebar.tsx:261-268`).
13. **§8 табл. 12 / §12.14 — отзыв не изменить и не удалить своему автору**
    (`activity/ReviewsBlock.tsx:395-575`), а «свой» определяется по совпадению имени (`:389`).
14. **§3.1.6 — «обновлённые за неделю»**: сортировка по `updatedAt` без окна в 7 дней
    (`lib/filters.ts:310-340`).

### Готовность к интеграции с бэкендом

Точка замены одна и удобная: `lib/data.ts` (моки) плюс чистые функции `lib/filters.ts`, который
уже возвращает `CatalogResult { activity, match }` — это ровно §9.2 (`groups_count`,
`locations_count`, раскрытые `group` + `location`). Серверные вызовы идут через функции в
`app/*/page.tsx` (`app/page.tsx:21-35`, `app/map/page.tsx:14-22`), их замена на `fetch` не
затрагивает компоненты.

Чего для интеграции не хватает:

1. `lib/api.ts`, типов ответов и модели ошибок `{ error: { code, message, fields } }` для
   400/401/403/404/409/429.
2. `page` в `FilterState` (`lib/filters.ts:23-30`) и координат вместо булева `near` — иначе
   пагинация и «рядом со мной» на сервер не переезжают.
3. Обработки сетевых ошибок и четвёртого состояния (loading/empty/error) в `CatalogClient.tsx`.
4. `NEXT_PUBLIC_API_URL`, `images.remotePatterns` и `rewrites` в `next.config.ts`.
5. Идемпотентности мутаций: голоса/жалобы/анкеты сейчас в памяти
   (`account/OwnerCabinet.tsx:37`, `activity/ActivityDetail.tsx:119-120`,
   `activity/ReviewsBlock.tsx:53-55`); серверу нужен `POST /activities/{id}/vote (+1/-1/null)`.
6. Реальной загрузки медиа: сейчас blob/data-URL после canvas
   (`account/ApplicationForm.tsx:200-210`), пути из §8 табл. 7 не формируются, `POST /upload` нет.
7. Серверной авторизации: HTTP-only cookie или JWT плюс `GET /me`, CSRF, реакция на 401,
   проверка прав (§12.4), rate-limit и блокировки с причиной (403).
8. Расстояния и «проверено ≤90 дней» должны приходить с сервера: сейчас `lib/filters.ts:269`
   берёт моковые `cityCenters` и `Date.now()`.

### Дублирование `web/src` и корневого `src/`

Одна задача решена дважды и по-разному: модель данных (`src/types/index.ts:29-43` — организация с
`address: string`, `ageRange`, `tags`, `priceType` против §7.9–7.11 и табл. 1-А/1-Б в
`web/src/lib/types.ts:83-147`), справочники (`src/mocks/data.ts:4-25` против
`web/src/lib/filters.ts:213-222` — названия городов и их центры расходятся; 4 категории против 9),
фильтрация (`src/lib/filter.ts:44-59` против `web/src/lib/filters.ts:264-343`) и компоненты карты и
фильтров. Корневой `src/` не имеет `package.json`, не собирается и по ТЗ уже отстал (нет районов,
групп и точек, зато есть `tags`). В репозиторий он коммитится как историческая заготовка, но
разработка продолжается только в `web/`.

### Что делать дальше по ТЗ

1. Кабинет модератора (`/moderation`): две очереди (анкеты и жалобы), publish/reject с обязательной
   причиной из `moderationRejectReasons`, журнал §12 табл. 11, подсветка просрочки SLA, блокировки.
2. `lib/api.ts` + типы ответов + обработка 401/403/429, `NEXT_PUBLIC_API_URL`, состояние ошибки в
   каталоге.
3. Один источник радиусов и один источник справочников (§4.5), произвольный возраст вводом числа,
   все мессенджеры списком, «Как добраться» в карточке, диапазон цен при выбранной группе,
   «голосов нет» в списке, редактирование и удаление своего отзыва.
4. Поднять тап-зоны до 44×44 px и кегль до читаемого (задача №9).

