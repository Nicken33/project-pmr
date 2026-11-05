# CI: `.github/workflows/ci.yml`

Проверяющий пайплайн Talentro на GitHub Actions (задача 20). Один workflow `CI`,
два независимых job'а. Деплоя здесь нет — витрину на Vercel публикует человек
(см. `docs/vercel.md`).

## Когда запускается

- `push` в `main` и в рабочие ветки по регламенту `docs/git-rules.md`
  (`feat/**`, `fix/**`, `chore/**`, `docs/**`, `codex/**`);
- любой `pull_request`;
- `workflow_dispatch` — чтобы прогнать вручную.

Пуш в ту же ветку отменяет предыдущий незавершённый запуск (`concurrency`).
`permissions: contents: read` — пайплайн только читает репозиторий.

## backend (Go)

Работает из `backend/Talentro` (`defaults.run.working-directory`):

1. `actions/checkout@v4`;
2. `actions/setup-go@v5` с `go-version-file: backend/Talentro/go.mod` — версия
   берётся из `go.mod` (`go 1.27.2`), а не прописана числом;
3. `gofmt -l .` — падает со списком файлов и диффом, если формат не соблюдён;
4. `go build ./...`;
5. `go vet ./...`;
6. подготовка тестовой Postgres (см. ниже, job не красит);
7. `go test -count=1 ./...` — `-count=1` отключает переиспользование результатов
   из build-кэша.

Кэш: встроенный в `setup-go` (модули + build-кэш), `cache: true`.

## web (Next.js)

Работает из `web/`:

1. `actions/checkout@v4`;
2. `actions/setup-node@v4` с `node-version: 24`;
3. `npm ci` (по `web/package-lock.json`);
4. `npm run lint` → `eslint`;
5. `npx --no-install tsc --noEmit` — проверка типов;
6. `npm test` → `vitest run`;
7. `npm run build` → `next build`.

Кэш: встроенный в `setup-node` (`cache: npm`,
`cache-dependency-path: web/package-lock.json`).

Почему Node 24, а не 22: в `web/package.json` **нет** секции `engines`, `.nvmrc`
в репозитории тоже нет. Единственный заявленный ориентир — `web/Dockerfile`
(`ARG NODE_VERSION=24`, то же в `docs/deploy.md`), и локально всё проверено на
Node 24.20.0. Отсюда и 24.

Отдельного скрипта `typecheck` в `package.json` нет (scripts: `dev`, `build`,
`start`, `lint`, `test`, `test:watch`), поэтому шаг типов вызывает `tsc`
напрямую: `tsconfig.json` уже с `noEmit: true`. `next build` типы проверяет сам,
но отдельный шаг даёт более быстрый и читаемый отчёт об ошибке.

## Postgres-сервис и интеграционные тесты

`internal/repository/catalog_test.go` читает `DATABASE_URL` и при его отсутствии
делает `t.Skip(...)`; ожидания тестов завязаны на сиды из `database/init.sql`.
Поэтому job `backend` поднимает служебный контейнер `postgres:16` (тот же
мажор, что в `docker-compose.yml`) с `pg_isready`-healthcheck, а следующий шаг
грузит `database/init.sql` — сначала через `docker cp` + `psql` внутри контейнера,
при неудаче через `psql` с хоста.

Сознательно выбрана **мягкая деградация**, а не жёсткий гейт: если базу поднять
или загрузить `init.sql` не удалось, шаг пишет `::warning::`, НЕ выставляет
`DATABASE_URL`, кладёт `ok=0` в output и завершается с кодом 0. Тесты при этом
запускаются и интеграционные честно скипаются — job остаётся зелёным.

Причина: сборка, `vet` и юнит-тесты не зависят от Postgres, и падать из-за
каприза инфраструктуры раннера значило бы ловить красные job'ы, не связанные с
кодом. Но как только база поднялась, `DATABASE_URL` выставляется, и падение
интеграционных тестов **красит job** — это уже реальная регрессия.

Пароль `talentro-ci` в файле — не секрет: это временная база одноразового
раннера, живущая только на время job'а.

## Что здесь не покрыто

- пайплайн **ни разу не выполнялся на GitHub-раннере** — в этой задаче не было
  доступа к GitHub Actions (нет `act`, пуш в remote запрещён). Проверено: YAML
  разбирается парсером `js-yaml`, все `run`-блоки проходят `bash -n`, обе ветки
  шага загрузки базы прогнаны локально на заглушках `docker`/`psql`. Имена и
  аргументы actions (`checkout@v4`, `setup-go@v5`, `setup-node@v4`) — официальные;
  поведение `docker cp`/`docker exec` над service-контейнером на конкретном образе
  `ubuntu-latest` не verified;
- сборки Docker-образов и проверки `docker-compose.yml` (демон локально не
  использовался);
- прогоны приёмочных скриптов `docs/acceptance/*.mjs` / `*.sh` против живого
  стенда;
- деплой (Vercel публикуется человеком), миграции на боевой базе, `checks.sql`
  из `backend/Talentro/Makefile`;
- `golangci-lint` (Makefile использует его, если он установлен; в CI — только
  `go vet`), тесты с `-race`, покрытие, e2e/Playwright, линтинг SQL;
- job'ы не кэшируют `.next` и не складывают артефакты сборки.

## Локальная проверка (Windows, Node 24.20.0 / Go 1.27.2)

| Команда                    | Результат                                                     |
| -------------------------- | ------------------------------------------------------------- |
| `go build ./...`           | exit 0                                                        |
| `go vet ./...`             | exit 0                                                        |
| `go test ./... -count=1`   | exit 0; `auth`, `delivery/http`, `handlers`, `repository` ok; интеграционные — SKIP (нет `DATABASE_URL`) |
| `gofmt -l .`               | локально помечает **все** `.go`-файлы только из-за CRLF в рабочем дереве (`core.autocrlf=true`); в коммитах хранится LF (`git ls-files --eol` → `i/lf`), а после нормализации переводов строк список пуст. На Linux-раннере checkout даёт LF, так что шаг честно зелёный. |
| `npm run lint`             | exit 0, 0 ошибок / 14 предупреждений                            |
| `npx tsc --noEmit`         | exit 0                                                         |
| `npm test`                 | exit 0, 8 файлов / 121 тест пройден                             |
| `npm run build`            | exit 0, 16 маршрутов сгенерированы                              |

`node_modules` в `web/` уже были установлены — `npm ci` локально не запускался,
его поведение на чистом раннере не verified.
