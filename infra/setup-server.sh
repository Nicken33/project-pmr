#!/usr/bin/env bash
# ==============================================================================
# Setup Server Script for Ubuntu 22.04 / 24.04 LTS
# Project: PMR (Talentro)
# Target: Production / Staging Server
# ==============================================================================

set -euo pipefail

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "[-] Ошибка: данный скрипт должен быть запущен с правами root (sudo)."
  exit 1
fi

echo "[+] Начинаем базовую настройку сервера..."

# 1. Часовой пояс и NTP синхронизация
echo "[+] Настройка часового пояса и синхронизации времени..."
timedatectl set-timezone Europe/Chisinau || timedatectl set-timezone UTC
apt-get update -y
apt-get install -y systemd-timesyncd
systemctl enable --now systemd-timesyncd

# 2. Обновление пакетов и базовые утилиты
echo "[+] Установка базовых утилит и unattended-upgrades..."
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
apt-get install -y curl wget git ufw fail2ban unattended-upgrades ca-certificates gnupg lsb-release htop net-tools

# Включение автоматических обновлений безопасности
dpkg-reconfigure -f noninteractive unattended-upgrades

# 3. Настройка пользователя deploy
DEPLOY_USER="deploy"
if id "$DEPLOY_USER" &>/dev/null; then
    echo "[i] Пользователь $DEPLOY_USER уже существует."
else
    echo "[+] Создание пользователя $DEPLOY_USER..."
    useradd -m -s /bin/bash "$DEPLOY_USER"
    usermod -aG sudo "$DEPLOY_USER"
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$DEPLOY_USER"
    chmod 0440 "/etc/sudoers.d/$DEPLOY_USER"
fi

# Настройка SSH ключей для deploy
DEPLOY_SSH_DIR="/home/$DEPLOY_USER/.ssh"
mkdir -p "$DEPLOY_SSH_DIR"

# Ключ Кирилла (nicke@Nicken)
KIRILL_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK++lMsFPReesMnzXv/cU4w6ETWjF8Ea3nIvPD0T6FET nicke@Nicken"

cat << EOF > "$DEPLOY_SSH_DIR/authorized_keys"
$KIRILL_KEY
EOF

chmod 700 "$DEPLOY_SSH_DIR"
chmod 600 "$DEPLOY_SSH_DIR/authorized_keys"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_SSH_DIR"

# 4. Усиление безопасности SSH
echo "[+] Усиление безопасности SSH..."
SSHD_CONFIG="/etc/ssh/sshd_config"
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' "$SSHD_CONFIG"
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' "$SSHD_CONFIG"
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' "$SSHD_CONFIG"
systemctl restart ssh || systemctl restart sshd

# 5. Настройка Fail2ban для защиты SSH
echo "[+] Настройка Fail2ban..."
cat << 'EOF' > /etc/fail2ban/jail.local
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
backend = systemd
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# 6. Настройка файрвола UFW
echo "[+] Настройка UFW (22, 80, 443)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP Caddy'
ufw allow 443/tcp comment 'HTTPS Caddy'
ufw --force enable

# 7. Настройка Swap (2 ГБ)
SWAPFILE="/swapfile"
if [ ! -f "$SWAPFILE" ]; then
    echo "[+] Создание Swap-файла 2 ГБ..."
    fallocate -l 2G "$SWAPFILE" || dd if=/dev/zero of="$SWAPFILE" bs=1M count=2048
    chmod 600 "$SWAPFILE"
    mkswap "$SWAPFILE"
    swapon "$SWAPFILE"
    echo "$SWAPFILE none swap sw 0 0" >> /etc/fstab
    sysctl vm.swappiness=10
    echo "vm.swappiness=10" >> /etc/sysctl.conf
else
    echo "[i] Swap-файл уже существует."
fi

# 8. Установка Docker Engine и Docker Compose v2
echo "[+] Установка Docker Engine + Compose v2..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"

# 9. Создание структуры рабочих каталогов
echo "[+] Создание рабочих директорий приложения..."
mkdir -p /srv/app /srv/media /srv/backups
chown -R "$DEPLOY_USER:$DEPLOY_USER" /srv/app /srv/media /srv/backups
chmod 775 /srv/app /srv/media /srv/backups

echo "=============================================================================="
echo "[+] Настройка сервера успешно завершена!"
echo "[i] Пользователь: $DEPLOY_USER"
echo "[i] SSH: Только по ключам, вход root по паролю запрещен."
echo "[i] Файрвол UFW: активен (порты 22, 80, 443 открыты)."
echo "[i] Docker: $(docker --version)"
echo "[i] Docker Compose: $(docker compose version)"
echo "[i] Каталоги созданы: /srv/app, /srv/media, /srv/backups"
echo "=============================================================================="
