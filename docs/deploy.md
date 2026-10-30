# Руководство по развертыванию инфраструктуры сервера и домена

## 1. Первичная настройка сервера (CYB-303)
Для воспроизводимой настройки VDS (Ubuntu 22.04 / 24.04 LTS):

1. Скопируйте скрипт `infra/setup-server.sh` на целевой сервер:
   ```bash
   scp infra/setup-server.sh root@<IP_СЕРВЕРА>:/root/
   ```
2. Подключитесь по SSH и запустите скрипт с правами root:
   ```bash
   ssh root@<IP_СЕРВЕРА>
   chmod +x /root/setup-server.sh
   /root/setup-server.sh
   ```
3. Скрипт выполнит:
   - Создание пользователя `deploy` с sudo;
   - Настройку SSH-доступа только по ed25519-ключам (вход root и пароли отключены);
   - Конфигурацию UFW (разрешены порты 22, 80, 443);
   - Установку Fail2ban, NTP, Unattended-Upgrades;
   - Создание Swap 2 ГБ;
   - Установку Docker Engine и Docker Compose v2;
   - Создание директорий `/srv/app`, `/srv/media`, `/srv/backups`.

4. Проверка подключения:
   ```bash
   ssh deploy@<IP_СЕРВЕРА>
   docker compose version
   ```

---

## 2. Настройка домена и HTTPS через Caddy (CYB-304)

1. **DNS-запись:**
   В панели управления доменом/DNS добавьте `A`-запись:
   - Имя: `@` (или ваш поддомен)
   - Значение: `<IP_СЕРВЕРА>`

2. **Запуск Caddy:**
   На сервере в каталоге `/srv/app/infra`:
   ```bash
   DOMAIN=your-domain.com docker compose -f docker-compose.caddy.yml up -d
   ```
   Caddy автоматически получит валидный бесплатный SSL-сертификат (Let's Encrypt / ZeroSSL) и включит HTTPS.

3. **Маршрутизация Caddy (`Caddyfile`):**
   - `/` $\rightarrow$ веб-интерфейс (`web:80`) или заглушка «Скоро здесь будет каталог»;
   - `/api/*` $\rightarrow$ бэкенд на Go (`api:8080`);
   - `/media/*` $\rightarrow$ локальное хранилище фото (`/srv/media`).
