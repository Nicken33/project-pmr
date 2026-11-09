package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// minSessionSecretLen — нижняя граница SESSION_SECRET в байтах; проверяется в
// Load, см. комментарий там же.
const minSessionSecretLen = 32

// placeholderPrefix — начало значений из `.env.example` (`CHANGE_ME…`). Длина
// такой заглушки проходит проверку ниже, поэтому её надо отбраковывать отдельно:
// скопированный шаблон даёт сервер, который подписывает куки ключом, лежащим в
// публичном репозитории. Проверка по префиксу, а не по подстроке — «CHANGE»
// внутри настоящего ключа не должен ломать запуск.
const placeholderPrefix = "CHANGE_ME"

type Config struct {
	Port           string
	DatabaseURL    string
	AllowedOrigins []string
	GoogleClientID string
	SessionSecret  string
	TesterToken    string
	// MediaDir — каталог, из которого раздаётся /media/* и куда пишутся загрузки
	// владельца. Пути в БД начинаются с /media/, поэтому каталог обязан быть
	// тем же самым, что видит reverse proxy: иначе загруженное фото легально
	// лежит на диске и отдаёт 404 с витрины.
	MediaDir string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		AllowedOrigins: splitList(os.Getenv("ALLOWED_ORIGINS")),
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"),
		SessionSecret:  os.Getenv("SESSION_SECRET"),
		TesterToken:    os.Getenv("TESTER_TOKEN"),
		MediaDir:       getEnv("MEDIA_DIR", "./media"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("не задана переменная DATABASE_URL")
	}
	// Без ключа нечем подписать куку сессии, а вход без подписи — это вход,
	// который любой посетитель сконструирует сам.
	if cfg.SessionSecret == "" {
		return nil, fmt.Errorf("не задана переменная SESSION_SECRET")
	}
	// Короткий ключ перебирается офлайн: подпись HMAC с 8 символами кто угодно
	// подберёт дома на видеокарте, и «подписанная кука» превращается в открытую.
	// 32 байта — нижняя граница SHA-256, `openssl rand -hex 32` даёт ровно 64.
	if len(cfg.SessionSecret) < minSessionSecretLen {
		return nil, fmt.Errorf("SESSION_SECRET короче %d байт: подпись куки подбирается офлайн", minSessionSecretLen)
	}
	// Заглушка длиннее границы — и всё равно публичный ключ: значение лежит в
	// `.env.example` в репозитории. Пустой SESSION_SECRET уже отсекается выше,
	// поэтому отказ по префиксу здесь — последний шаг, и он же первый для
	// того, кто скопировал шаблон и не стал читать комментарии.
	if isPlaceholder(cfg.SessionSecret) {
		return nil, fmt.Errorf(
			"SESSION_SECRET = значение из шаблона (%s…): куку подписывает ключ, известный любому посетителю. "+
				"Сгенерируйте: openssl rand -hex 32", placeholderPrefix)
	}
	// TESTER_TOKEN пустой — тестовый вход отключается, а не открывается всем.
	// Заглушка здесь не «ещё один необязательный параметр»: это пароль на роль
	// тестировщика, а она открывает кабинет модерации (§3.9).
	if isPlaceholder(cfg.TesterToken) {
		return nil, fmt.Errorf(
			"TESTER_TOKEN = значение из шаблона (%s…): вход тестировщика открывается паролем, "+
				"известным из репозитория. Сгенерируйте: openssl rand -hex 32", placeholderPrefix)
	}
	return cfg, nil
}

// isPlaceholder — про значение из шаблона `.env.example`. Регистр не учитывается:
// `change_me` в .env означает ровно то же самое.
func isPlaceholder(v string) bool {
	return strings.HasPrefix(strings.ToUpper(strings.TrimSpace(v)), placeholderPrefix)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
