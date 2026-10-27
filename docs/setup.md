# Инструкция по развертыванию проекта
## Шаблон .env
```env
POSTGRES_USER=postgres
# Любой пароль (в файлах .env)
POSTGRES_PASSWORD=supersecretpassword
POSTGRES_DB=postgres
```
## 1. Установка Docker и Docker Compose
**Linux (Debian/Ubuntu):**
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
```
- **Windows / macOS:** Установите Docker Desktop

## 2. Переменные окружения
Создайте файл .env в корне проекта (скопируйте из шаблона):
```bash
cp .env.example .env
```
## 3. Запуск
```bash
docker compose up -d
```

## 4. Подключение к БД
Host: localhost;
Port: 5432;
User: postgres;
Password: из .env;
Database: postgres;



