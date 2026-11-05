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

type Config struct {
	Port           string
	DatabaseURL    string
	AllowedOrigins []string
	GoogleClientID string
	SessionSecret  string
	TesterToken    string
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
	// TESTER_TOKEN пустой — тестовый вход отключается, а не открывается всем.
	return cfg, nil
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
