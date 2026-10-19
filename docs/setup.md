# Запуск PostgreSQL в Docker

## 1. Переменные окружения
Создайте файл `.env` в корне проекта:
```env
POSTGRES_USER=postgres
# Любой пароль (в файлах .env)
POSTGRES_PASSWORD=supersecretpassword
POSTGRES_DB=postgres
```
## Запуск
docker compose up -d
## Подключение к БД
Host: localhost;
Port: 5432;
User: postgres;
Password: из .env;
Database: postgres;
