# Talentro backend: короткие команды для разработки.
# Запускать из папки backend/Talentro (рядом с go.mod): make <команда>
#
# На Windows `make` (mingw-сборка GNU Make) игнорирует SHELL и выполняет recipe
# через cmd.exe, поэтому здесь нет многострочных shell-конструкций: они дают
# мусор вида `"url" не является внутренней командой`. Всё, что требует if или $$,
# уехало в отдельный скрипт (`sh ../../database/checks.sh`) — одна строка
# проходит и под cmd, и под POSIX sh. Одно исключение: `make help` читает
# комментарии через awk и работает только там, где make зовёт sh; список команд
# для Windows — в README.

APP        := ./cmd/app
BIN        := bin/talentro
CHECKS     := ../../database/checks.sh
DB_CONTAINER ?= pg
DB_NAME      ?= main_db
# Если Docker у тебя работает без sudo, запускай: make db-up DOCKER=docker
DOCKER     ?= sudo docker

.DEFAULT_GOAL := help

.PHONY: help run build test lint fmt vet tidy clean checks db-up db-down db-shell db-tables

help: ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-10s %s\n", $$1, $$2}'

run: ## Запустить сервер (настройки читаются из .env)
	go run $(APP)

build: ## Собрать бинарник в bin/talentro
	go build -o $(BIN) $(APP)

test: ## Запустить тесты
	go test ./...

lint: ## Проверить код (go vet; golangci-lint, если установлен, зови отдельно)
	go vet ./...

fmt: ## Отформатировать код
	gofmt -w .

vet: ## Найти типичные ошибки (go vet)
	go vet ./...

tidy: ## Привести go.mod и go.sum в порядок
	go mod tidy

# Проверки целостности §7.8. Строку подключения ищёт скрипт: в окружении, а если
# его нет — в .env. Ошибка целостности или отсутствие и того и другого = nonzero.
checks: ## Прогнать database/checks.sql (ошибки целостности = провал)
	@sh $(CHECKS)

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
