#!/bin/sh
# Прогон проверок целостности database/checks.sql (§7.8).
#
# Логика живёт в скрипте, а не в recipe Makefile: make на Windows (GNU Make для
# mingw) игнорирует SHELL и выполняет команды через cmd.exe, где многострочные
# конструкции с if и $$ разбираются как команды — target падал на строке вида
# `"url" не является внутренней или внешней командой`. Одна строка `sh скрипт`
# проходит и под cmd, и под нормальным sh.
#
# Строку подключения берёт из DATABASE_URL, а если переменной нет — из
# backend/Talentro/.env (перевод строки Windows и кавычки вырезаются, иначе
# libpq не разберёт URI). Выходит nonzero, если проверки не пройдены или нечего
# проверять: CI так и должен это считать.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
sql="$here/checks.sql"

url=${DATABASE_URL:-}
if [ -z "$url" ]; then
	for env_file in "$here/../backend/Talentro/.env" "./.env"; do
		[ -f "$env_file" ] || continue
		found=$(grep -E '^DATABASE_URL=' "$env_file" | head -n 1 | cut -d= -f2- || true)
		# '\r' из Windows-перевода строк и кавычки вокруг значения.
		url=$(printf '%s' "$found" | tr -d '\r"')
		[ -n "$url" ] && break
	done
fi

if [ -z "$url" ]; then
	echo "нужен DATABASE_URL — в окружении или в backend/Talentro/.env" >&2
	exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
	echo "нужен psql в PATH (Windows: C:\\Program Files\\PostgreSQL\\18\\bin)" >&2
	exit 1
fi

# Кодировка задаётся явно: без PGCLIENTENCODING psql на Windows отправляет запросы
# в локальной cp1251, и кириллица в именах проверок ломается на входе.
PGCLIENTENCODING=UTF8 exec psql "$url" -X -v ON_ERROR_STOP=1 -f "$sql"
