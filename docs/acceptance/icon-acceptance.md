# Приёмка иконок категорий Talentro

- **Дата/время:** 2026-11-04, 22:00–22:06 EET (UTC+2); финальный прогон скрипта — 22:05:47.
- **Worktree:** `D:/CyberSprint/.worktrees/integration`, ветка `feat/15-16-integration`.
- **Окружение:** Node.js v24.20.0, Windows 10 (win32), Git Bash.
- **Стенд:** web `http://localhost:3000/` и `http://26.52.103.163:3000/`, API `http://localhost:8080/api/v1/categories`.
- **БД:** `talentro_accept_1516` на `127.0.0.1:55432` (psql 18).
- **Проверяемые версии:** `web/src/components/ui/Icon.tsx` sha256 `3aee270f10e4…` (79 записей `iconMap`, mtime 22:01), `database/init.sql` sha256 `5b0577a4149c…` (63 категории, mtime 19:20).

## Вердикт

| Область | Результат |
|---|---|
| Верхний уровень API vs план дизайнера | **PASS** — все 9 категорий совпали по Lucide-компоненту |
| SSR HTML :3000 | **PASS** — `lucide-shapes` нет, все 9 ожидаемых `lucide-*` присутствуют |
| Статическая карта `iconMap` | **PASS** — все имена из API и `init.sql` есть, к `Shapes` не ведут |
| Полнота дерева API | **FAIL** — API отдаёт 33 из 63 категорий (30 потеряны) |
| Воспроизводимость из `init.sql` | **RISK** — живая БД исправлена «на месте», `init.sql` не обновлён (8 расхождений) |
| Скрипт `check-category-icons.mjs` | **exit 1** — единственный провал: неполное дерево API |

Важно: стенд и БД менялись во время проверки. В 22:00 в БД верхний уровень был
`paw / map / dots`, и travel рендерился как `lucide-map`; к 22:02–22:03 кто-то
применил hotfix, и БД стала `paw-print / mountain / layout-grid`. Финальные
таблицы ниже отражают состояние после hotfix. Правка `init.sql` при этом не
появилась в рабочем дереве.

## Команды

```bash
node docs/acceptance/check-category-icons.mjs
node docs/acceptance/check-category-icons.mjs --web=http://26.52.103.163:3000/
curl -sS http://localhost:8080/api/v1/categories
"C:/Program Files/PostgreSQL/18/bin/psql.exe" -h 127.0.0.1 -p 55432 -U user7 \
  -d talentro_accept_1516 -c "SELECT id,parent_id,slug,icon FROM categories ORDER BY id;"
cd web && npx vitest run src/components/ui/Icon.test.ts
```

Результат `Icon.test.ts`: 25/25 passed. Скрипт проверки — exit code 1 (см. расхождения).
HTML дополнительно проверен в браузере через chrome-devtools MCP: DOM-извлечение
классов иконок и скриншот 1280×900 (скриншот в репозиторий не сохранялся).

## Ожидаемое соответствие: верхний уровень

План — `web/src/lib/data.ts` (`superCategories`), канон — API/БД, рендер — `Icon.tsx`.

| API slug | slug плана | Иконка плана | Иконка API/БД | API → Lucide | HTML `lucide-*` | Вердикт |
|---|---|---|---|---|---|---|
| `creative-arts` | `tvorchestvo` | `palette` | `palette` | Palette | `lucide-palette` ×2 | OK |
| `sport-fitness` | `sport` | `dumbbell` | `dumbbell` | Dumbbell | `lucide-dumbbell` ×2 | OK |
| `tech-games` | `tech` | `cpu` | `cpu` | Cpu | `lucide-cpu` ×2 | OK |
| `learning-kids` | `education` | `graduation-cap` | `graduation-cap` | GraduationCap | `lucide-graduation-cap` ×2 | OK |
| `animals-nature` | `nature` | `paw-print` | `paw-print` | PawPrint | `lucide-paw-print` ×2 | OK |
| `travel-outdoor` | `travel` | `mountain` | `mountain` | Mountain | `lucide-mountain` ×2 | OK |
| `practical-skills` | `practical` | `wrench` | `wrench` | Wrench | `lucide-wrench` ×2 | OK |
| `social-activity` | `social` | `users` | `users` | Users | `lucide-users` ×11* | OK |
| `other` | `other` | `layout-grid` | `layout-grid` | LayoutGrid | `lucide-layout-grid` ×4* | OK |

\* `users` и `layout-grid` используются ещё и вне полосы категорий (шапка,
переключатель вида и т. п.), поэтому счётчики больше 2. Для приёмки важно
наличие класса, а не количество.

Все 9 компонентов различны; дублей верхнего уровня нет. Живой DOM сайдбара
(извлечён из браузера) дал ровно девять разных классов:
`lucide-palette, lucide-dumbbell, lucide-cpu, lucide-graduation-cap,
lucide-paw-print, lucide-mountain, lucide-wrench, lucide-users, lucide-layout-grid`.

## Второй уровень: то, что реально отдаёт API (24 из 54)

| Родитель | Категории: `icon` → компонент |
|---|---|
| `creative-arts` | `drawing: brush` → Brush; `music: music` → Music; `dance: dance` → PersonStanding; `photo-video: camera` → Camera; `needlework: yarn` → Scissors; `cooking: chef` → ChefHat; `stage-performance: theater` → Theater |
| `sport-fitness` | `basketball: basketball` → CircleDot; `volleyball: volleyball` → Volleyball; `martial-arts: fist` → Shield; `swimming: water` → Waves; `athletics: run` → Footprints; `fitness-yoga: yoga` → Activity; `gymnastics: gym` → Accessibility; `dance-sport: music` → Music |
| `tech-games` | `video-games: gamepad` → Gamepad2; `board-games: dice` → Dice5; `chess: chess` → Crown; `design-3d: cube` → Box |
| `learning-kids` | `logic: logic` → Puzzle; `math: sigma` → Sigma; `reading: book` → BookOpen; `speed-reading: book` → BookOpen |
| `animals-nature` | `ecology: leaf` → Leaf |

Дубли второго уровня в видимой части API: `Music` (`music`, `dance-sport`) и
`BookOpen` (`reading`, `speed-reading`). В полной БД таких групп шесть:
`BookOpen`, `Music`, `Leaf` (`plant-growing`, `ecology`), `Toolbox`
(`toolwork`, `diy-workshop`), `Wrench` (`metalwork`, `device-repair`), `Heart`
(`pet-care`, `charity`). План дизайнера сам повторяет иконки на втором уровне
(`circle` ×3, `book-open` ×2, `tent` ×2, `scissors` ×2, `camera` ×2, `music` ×2),
поэтому это не считается провалом; уникальность проверяется для верхнего уровня.

## Расхождение 1 (блокер): API теряет 30 категорий

`GET /api/v1/categories` вернул 33 строки из 63 в БД. Не отданы:

| Родитель | Потерянные slug: `icon` → Lucide |
|---|---|
| `sport-fitness` | `football` (ball → Circle) |
| `tech-games` | `programming` (code → Code), `robotics` (robot → Bot) |
| `learning-kids` | `foreign-languages` (globe → Languages), `school-prep` (school → School), `speech-dev` (speech → MessageCircle) |
| `animals-nature` | `pet-care` (heart → Heart), `dog-training` (dog → Dog), `gardening` (flower → Flower2), `plant-growing` (leaf → Leaf) |
| `travel-outdoor` | `tourism` (backpack → Backpack), `hiking` (mountain → Mountain), `camping` (tent → Tent), `orienteering` (compass → Compass), `local-history` (landmark → Landmark) |
| `practical-skills` | `toolwork` (tool → Toolbox), `carpentry` (saw → Hammer), `metalwork` (wrench → Wrench), `device-repair` (wrench → Wrench), `diy-workshop` (tool → Toolbox) |
| `social-activity` | `volunteering` (hands → HandHeart), `event-organizing` (calendar → Calendar), `charity` (heart → Heart), `interest-clubs` (users → Users) |
| `other` | `tutoring` (user → User), `massage` (hand → Hand), `manicure` (nail → Hand), `grooming` (scissors → Scissors), `photo-service` (camera → Camera), `transport` (truck → Truck) |

Их иконки статически корректны (все имена есть в `iconMap`, ни одно не ведёт к
`Shapes`), но в API/HTML они не проверены. В SSR-разметке главной их фильтров нет:
например, «Программирование», «Иностранные языки», «Туризм», «Волонтёрство»,
«Репетиторство» не встречаются, хотя «Баскетбол», «Шахматы», «Экология» есть.

Причина не в иконках, а в сборке дерева:
`backend/Talentro/internal/repository/dictionaries.go:15-18` сортирует
`ORDER BY COALESCE(parent_id, id), order_num, id`. У корня `order_num` = 1…9, у
детей — 1…N. Ребёнок с `order_num` меньше номера корня оказывается в выдаче
раньше родителя, а строки 41–45 (`byID[parentID]` не найден → `continue`)
молча выбрасывают его. Поэтому у корня 6 (`travel-outdoor`) теряются все пять
детей, у корня 9 (`other`) — все шесть. Это ломает не только иконки, но и
фильтры категорий на витрине; правка вне роли тестировщика, передано в отчёт.

## Расхождение 2 (риск воспроизводимости): `init.sql` отстал от БД

Живая БД исправлена, но `database/init.sql` всё ещё содержит старые значения.
Миграции/`UPDATE` в репозитории нет, поэтому новый стенд, поднятый из `init.sql`,
вернёт расхождения:

| Категория | `init.sql` | Живая БД/API |
|---|---|---|
| `drawing` | `palette` | `brush` |
| `sport-fitness` | `run` | `dumbbell` |
| `dance-sport` | `dance` | `music` |
| `learning-kids` | `book` | `graduation-cap` |
| `animals-nature` | `paw` | `paw-print` |
| `travel-outdoor` | `map` | `mountain` |
| `social-activity` | `hands` | `users` |
| `other` | `dots` | `layout-grid` |

Для четырёх верхнеуровневых категорий это снова даст картинку не из плана:
`run` → Footprints (план Dumbbell), `book` → BookOpen (план GraduationCap),
`map` → Map (план Mountain), `hands` → HandHeart (план Users). Именно `map → Map`
и был причиной «mountain не как в плане» до hotfix. Нужно либо обновить
`init.sql`, либо добавить миграцию в репозиторий.

## Что проверено статически и в HTML

- `iconMap`: 79 записей; 31 уникальное имя из API и 51 из `init.sql` присутствуют,
  ни одно не маппится на `Shapes`. Все 53 уникальных имени в живой БД покрыты
  объединением этих словарей.
- SSR HTML: HTTP 200, 44 уникальных `lucide-*` класса, `lucide-shapes` — 0.
- Визуально (браузер, 1280×900): девять верхнеуровневых иконок в сайдбаре
  различаются формой и цветом; полоса направлений показывает palette, dumbbell,
  cpu, graduation-cap, paw-print, mountain, wrench, users, layout-grid.
- `Icon.test.ts` (агент-web): 25 тестов passed, включая проверки `init.sql`,
  моков дизайнера, алиасов и уникальности верхнего уровня.

## Что осталось непроверенным

1. **Pixel-perfect сверка с макетом дизайнера** не делалась: макета/Figma в
   репозитории нет. Проверено соответствие плану `data.ts` и различимость иконок,
   а не точная графика.
2. **30 категорий, потерянных API**, не проверены в живом UI. После исправления
   `dictionaries.go` нужно перезапустить скрипт: HTML-проверка тогда увидит и их.
3. **Только главная страница.** Страницы категорий/карточек, мобильная вёрстка и
   другие места использования `CategoryIcon` не проверялись.
4. **Стенд/БД менялись во время теста** (hotfix верхнего уровня около 22:02).
   Перед коммитом/релизом нужен повторный прогон на стабильном стенде; текущий
   exit code 1 ожидаем из-за неполного дерева API.
5. **Скриншот не сохранён в репозиторий** (снят через chrome-devtools MCP).
   Финальный визуальный sign-off дизайнера остаётся за человеком.
6. Ничего не коммитилось и серверы не перезапускались. Правка `Icon.tsx` и
   `Icon.test.ts` уже вошла в коммит `9f10e6b` («15: карта иконок категорий
   резолвит канон §7 и моки витрины»); в рабочем дереве остались только
   `docs/acceptance/check-category-icons.mjs` и этот отчёт (untracked), их
   коммитит координатор после финальной проверки.

## Повторный прогон после фиксов (22:14, HEAD f2d2843)

- API отдаёт 63 категории (9 корней, 54 ребёнка) — потеря 30 детей устранена
  коммитом `a81745b`.
- `init.sql` выровнен с живой БД коммитом `f2d2843`, предупреждение о
  расхождении сида и БД снято.
- `node docs/acceptance/check-category-icons.mjs` → **exit 0**; SSR-разметка без
  `lucide-shapes`, девять верхнеуровневых иконок различимы.
- Открытыми остаются только дизайнерские вопросы второго уровня (9 групп
  одинаковых иконок) и пункты 1, 3, 5 из раздела выше.
