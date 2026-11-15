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
	JWTSecret      string
	MediaDir       string

	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	SMTPFrom     string
	FrontendURL  string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Port:           getEnv("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		AllowedOrigins: splitList(os.Getenv("ALLOWED_ORIGINS")),
		JWTSecret:      getEnv("JWT_SECRET", os.Getenv("MODERATOR_TOKEN")),
		MediaDir:       getEnv("MEDIA_DIR", "./media"),
		SMTPHost:       os.Getenv("SMTP_HOST"),
		SMTPPort:       getEnv("SMTP_PORT", "587"),
		SMTPUsername:   os.Getenv("SMTP_USERNAME"),
		SMTPPassword:   os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:       os.Getenv("SMTP_FROM"),
		FrontendURL:    os.Getenv("FRONTEND_URL"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("не задана переменная DATABASE_URL")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET должен содержать не менее 32 символов")
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
