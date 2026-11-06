package config

import (
	"strings"
	"testing"
)

// Load только читает окружение — к базе он не подключается (это делает
// repository.NewDB), поэтому проверка конфигурации живёт без DATABASE_URL-стенда
// и без единого скипа.
func setAuthEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/talentro?sslmode=disable")
	t.Setenv("SESSION_SECRET", strings.Repeat("a", minSessionSecretLen))
}

// MODERATOR_TOKEN ни один обработчик не читает: кабинет модератора (§3.8, §9.12)
// ещё не написан, а требование в Load заставляло выдумывать секрет ради старта.
// Тест фиксирует, что absence — это нормальный запуск, а не тихий fallback:
// когда кабинет появится, он принесёт собственную проверку секрета.
func TestLoadStartsWithoutModeratorToken(t *testing.T) {
	setAuthEnv(t)
	t.Setenv("MODERATOR_TOKEN", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load без MODERATOR_TOKEN: %v", err)
	}
	if cfg.DatabaseURL == "" || cfg.SessionSecret == "" {
		t.Errorf("обязательные переменные потеряны: %+v", cfg)
	}
}

func TestLoadAcceptsCompleteEnv(t *testing.T) {
	setAuthEnv(t)
	// PORT пустым, а не «не трогаем»: иначе значение из окружения прогона
	// решало бы, что означает «без PORT ждали 8080».
	t.Setenv("PORT", "")
	t.Setenv("ALLOWED_ORIGINS", "https://talentro.local, https://api.talentro.local")
	t.Setenv("TESTER_TOKEN", "токен-для-приёмки")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load с полным окружением: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, без PORT ждали 8080", cfg.Port)
	}
	if len(cfg.AllowedOrigins) != 2 {
		t.Errorf("AllowedOrigins = %v, ждали два источника из списка", cfg.AllowedOrigins)
	}
	if cfg.TesterToken == "" || cfg.SessionSecret == "" {
		t.Errorf("переменные входа потеряны: %+v", cfg)
	}
}

// Пустые DATABASE_URL и SESSION_SECRET — отказ запуска, а не «работаем как
// получится»: без базы сервис не отвечает вообще, а без ключа кука сессии
// подписывается нечем.
func TestLoadRequiresCoreVariables(t *testing.T) {
	setAuthEnv(t)

	tcs := []struct {
		name string
		key  string
	}{
		{"DATABASE_URL", "DATABASE_URL"},
		{"SESSION_SECRET", "SESSION_SECRET"},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(tc.key, "")
			if _, err := Load(); err == nil {
				t.Errorf("Load без %s прошла успешно — старт без обязательной переменной не валится", tc.name)
			}
		})
	}
}

// §12.1: подпись куки бессилен на коротком ключе, поэтому граница длины —
// обязательный отказ, а не подсказка в README.
func TestLoadSessionSecretLength(t *testing.T) {
	tcs := []struct {
		name    string
		secret  string
		wantErr bool
	}{
		{"31 байт", strings.Repeat("a", minSessionSecretLen-1), true},
		{"ровно 32 байта", strings.Repeat("a", minSessionSecretLen), false},
		{"64 байта (openssl rand -hex 32)", strings.Repeat("f", 64), false},
		// Граница считается в байтах, а не в символах: 16 кириллических символов
		// — это 32 байта UTF-8. Генератор (`openssl rand -hex`) даёт ASCII, так
		// что случайный секрет в пределах правила остаётся; проверка фиксирует,
		// что именно байты считаются, а не «длина строки по-русски».
		{"16 кириллических символов = 32 байта", strings.Repeat("к", 16), false},
		{"15 кириллических символов = 30 байт", strings.Repeat("к", 15), true},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			setAuthEnv(t)
			t.Setenv("SESSION_SECRET", tc.secret)

			_, err := Load()
			if (err != nil) != tc.wantErr {
				t.Errorf("Load(SECRET len=%d байт): err = %v, ждали ошибку = %v",
					len(tc.secret), err, tc.wantErr)
			}
		})
	}
}

// Дыра, которую держала длина: значения из `.env.example` достаточно длинные,
// чтобы пройти проверку выше, и при этом публично известны — они лежат в
// репозитории. Скопированный шаблон даёт сервер, который подписывает куки
// ключом, известным любому посетителю, то есть вход под любой ролью, включая
// модератора и тестировщика, без пароля. Поэтому заглушка — отказ запуска,
// а не предупреждение в лог.
func TestLoadRejectsTemplatePlaceholders(t *testing.T) {
	tcs := []struct {
		name   string
		secret string
		tester string
		key    string
	}{
		{
			"SESSION_SECRET из backend/Talentro/.env.example",
			"CHANGE_ME_MIN_32_BYTES_USE_OPENSSL_RAND_HEX_32", "", "SESSION_SECRET",
		},
		// Короткий CHANGE_ME отсекается и по длине; хвост нужен, чтобы тест
		// ловил именно проверку заглушки.
		{"CHANGE_ME с хвостом до 32 байт", "CHANGE_ME_до_32_байт_хвостом", "", "SESSION_SECRET"},
		{"CHANGE_ME в нижнем регистре", "change_me_secret_len_32+bytes_ok", "", "SESSION_SECRET"},
		{"CHANGE_ME с суффиксом", "CHANGE_ME__session_2026_len_32_bytes", "", "SESSION_SECRET"},
		{"TESTER_TOKEN из шаблона", "", "CHANGE_ME", "TESTER_TOKEN"},
		{
			"TESTER_TOKEN развёрнутый",
			"", "CHANGE_ME_MIN_32_BYTES_USE_OPENSSL_RAND_HEX_32", "TESTER_TOKEN",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			setAuthEnv(t)
			if tc.secret != "" {
				t.Setenv("SESSION_SECRET", tc.secret)
			}
			t.Setenv("TESTER_TOKEN", tc.tester)

			_, err := Load()
			if err == nil {
				t.Fatalf("Load пустила %s — публичная заглушка из шаблона стала рабочим секретом", tc.key)
			}
			if !strings.Contains(err.Error(), tc.key) {
				t.Errorf("ошибка %q не называет переменную, которую надо починить", err)
			}
		})
	}
}

// Тот же отказ не должен цеплять нормальные значения: пустой TESTER_TOKEN —
// это «вход для проверки отключён», а не заглушка, а сгенерированный токен
// длиннее 32 байтов проходит.
func TestLoadAcceptsRealValuesNotPlaceholders(t *testing.T) {
	tcs := []struct {
		name  string
		key   string
		value string
	}{
		{"TESTER_TOKEN пустой — вход отключён", "TESTER_TOKEN", ""},
		{"TESTER_TOKEN случайный", "TESTER_TOKEN", strings.Repeat("7", 64)},
		{"SESSION_SECRET случайный", "SESSION_SECRET", strings.Repeat("b", 64)},
		// Заглушка определяется по префиксу, а не по подстроке: «CHANGE» внутри
		// нормального ключа не должен ломать запуск.
		{"SESSION_SECRET с CHANGE внутри", "SESSION_SECRET", "NnCHANGEqQ" + strings.Repeat("c", 40)},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			setAuthEnv(t)
			t.Setenv(tc.key, tc.value)
			if _, err := Load(); err != nil {
				t.Errorf("Load отказала на %s=%q: %v", tc.key, tc.value, err)
			}
		})
	}
}
