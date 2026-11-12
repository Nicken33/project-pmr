# Talentro backend: короткие команды для разработки.
# Запускать из папки backend/Talentro (рядом с go.mod): make <команда>

APP        := ./cmd/app
BIN        := bin/talentro
DB_CONTAINER ?= pg
DB_NAME      ?= main_db
# Если Docker у тебя работает без sudo, запускай: make db-up DOCKER=docker
DOCKER     ?= sudo docker

.DEFAULT_GOAL := help

.PHONY: help run build test lint fmt vet tidy clean db-up db-down db-shell db-tables

help: ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-10s %s\n", $$1, $$2}'

run: ## Запустить сервер (настройки читаются из .env)
	go run $(APP)

build: ## Собрать бинарник в bin/talentro
	go build -o $(BIN) $(APP)

test: ## Запустить тесты
	go test ./...

lint: ## Проверить код (golangci-lint, а если не установлен, go vet)
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint не найден, запускаю go vet"; \
		go vet ./...; \
	fi

fmt: ## Отформатировать код
	gofmt -w .

vet: ## Найти типичные ошибки (go vet)
	go vet ./...

tidy: ## Привести go.mod и go.sum в порядок
	go mod tidy

clean: ## Удалить собранные файлы
	rm -rf bin

db-up: ## Запустить контейнер с базой
	$(DOCKER) start $(DB_CONTAINER)

db-down: ## Остановить контейнер с базой
	$(DOCKER) stop $(DB_CONTAINER)

db-shell: ## Открыть psql внутри контейнера (под администратором)
	$(DOCKER) exec -it $(DB_CONTAINER) psql -U postgres -d $(DB_NAME)

db-tables: ## Показать список таблиц
	$(DOCKER) exec $(DB_CONTAINER) psql -U postgres -d $(DB_NAME) -c '\dt'
