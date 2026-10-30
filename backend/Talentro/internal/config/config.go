package config

import (
	"fmt"
	"github.com/joho/godotenv"
	"os"
	"strings"
)

type Config struct {
	Port           string
	DatabaseURL    string
	AllowedOrigins []string
	ModeratorToken string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		AllowedOrigins: splitList(os.Getenv("ALLOWED_ORIGINS")),
		ModeratorToken: os.Getenv("MODERATOR_TOKEN"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("не задана переменная DATABASE_URL")
	}
	if cfg.ModeratorToken == "" {
		return nil, fmt.Errorf("не задана переменная MODERATOR_TOKEN")
	}
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
