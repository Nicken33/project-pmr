# Go-бэкенд Talentro (§9). Двухслойная сборка: компилируем в golang, запускаем в
# маленьком alpine — без исходников, без тулчейна и без setuid-помощников.
#
# Контекст сборки — эта папка, поэтому пути в COPY короткие:
#   docker build -t talentro-api backend/Talentro        # из корня репозитория
#   docker build -t talentro-api .                        # из backend/Talentro
#
# Настройки в образ не кладём: internal/config читает окружение, а локальный .env
# отрезан .dockerignore (в нём реальные пароли и токен модератора).

ARG GO_VERSION=1.27.2
FROM golang:${GO_VERSION}-alpine AS build

WORKDIR /src

# GO_VERSION должен быть не ниже директивы `go` в go.mod, иначе тулчейн начнёт
# докачивать саму себя (GOTOOLCHAIN=auto) и сборка упрётся в отсутствие сети.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0: lib/pq чистый Go, поэтому бинарник статический и работает в
# alpine без glibc. -trimpath убирает пути сборки, -s -w режут debug-секции.
# Версия в /health (§9.1) берётся из handlers.Version, поэтому тег релиза обязан
# попадать в бинарник: docker build --build-arg VERSION=$(git describe --tags --always).
ARG VERSION=dev
ENV CGO_ENABLED=0
RUN go build -trimpath \
      -ldflags "-s -w -X talentro/internal/delivery/http/handlers.Version=${VERSION}" \
      -o /out/talentro ./cmd/app

FROM alpine:3.22

# tzdata нужна, чтобы контейнер понимал TZ: «проверено за 90 дней» (§7.11)
# считается по current_date, и сутки в Приднестровье должны быть местными.
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -g 10001 -S talentro \
 && adduser -u 10001 -S talentro -G talentro

WORKDIR /app
COPY --from=build /out/talentro /app/talentro

USER 10001:10001
EXPOSE 8080

# PORT читает internal/config (по умолчанию 8080), поэтому healthcheck берёт его
# же. /health отвечает 503, когда база недоступна, так что unhealthy означает
# «процесс жив, каталога нет», а не только «процесс умер».
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT:-8080}/health" || exit 1

# Exec-form: бинарник получает SIGTERM напрямую, а main.go по нему делает
# graceful shutdown (10 секунд на доработку ответов).
ENTRYPOINT ["/app/talentro"]
