package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           string
	DatabaseURL    string
	AllowedOrigins []string
	ModeratorToken string
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
		ModeratorToken: os.Getenv("MODERATOR_TOKEN"),
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"),
		SessionSecret:  os.Getenv("SESSION_SECRET"),
		TesterToken:    os.Getenv("TESTER_TOKEN"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("не задана переменная DATABASE_URL")
	}
	if cfg.ModeratorToken == "" {
		return nil, fmt.Errorf("не задана переменная MODERATOR_TOKEN")
	}
	// Без ключа нечем подписать куку сессии, а вход без подписи — это вход,
	// который любой посетитель сконструирует сам.
	if cfg.SessionSecret == "" {
		return nil, fmt.Errorf("не задана переменная SESSION_SECRET")
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
