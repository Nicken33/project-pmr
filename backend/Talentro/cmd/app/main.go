package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"talentro/internal/auth"
	"talentro/internal/config"
	httpdelivery "talentro/internal/delivery/http"
	"talentro/internal/delivery/http/handlers"
	"talentro/internal/repository"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("конфигурация: %v", err)
	}

	db, err := repository.NewDB(cfg)
	if err != nil {
		log.Fatalf("база данных: %v", err)
	}
	defer db.Close()

	repo := repository.New(db)

	sessionStore, err := auth.NewStore(cfg.SessionSecret)
	if err != nil {
		log.Fatalf("сессии: %v", err)
	}

	catalogHandler := handlers.NewCatalogHandler(repo)
	healthHandler := handlers.NewHealthHandler(repo)
	authHandler := handlers.NewAuthHandler(cfg, repo, sessionStore)
	moderationHandler := handlers.NewModerationHandler(repo, handlers.WithSessions(sessionStore))

	r := chi.NewRouter()

	// CORS первым: preflight (OPTIONS) должен обслуживаться до лога и до 401/404.
	// Пустой ALLOWED_ORIGINS означает «междоменным запросам отказано».
	r.Use(httpdelivery.CORS(cfg.AllowedOrigins))

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	httpdelivery.RegisterRoutes(r, catalogHandler, healthHandler, authHandler, moderationHandler)

	serverAddr := ":" + cfg.Port

	srv := &http.Server{
		Addr:    serverAddr,
		Handler: r,
	}

	log.Printf("Сервер запущен на http://localhost%s", serverAddr)

	serverErrors := make(chan error, 1)

	// Сигналы ловим до запуска goroutine: иначе Ctrl+C в окно между стартом
	// сервера и NotifyContext убивает процесс напрямую, минуя graceful shutdown.
	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	go func() {
		log.Printf("Сервер запущен на http://localhost%s", serverAddr)
		serverErrors <- srv.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("ошибка HTTP-сервера: %v", err)
		}

	case <-ctx.Done():
		log.Println("Получен сигнал остановки сервера")
	}

	shutdownCtx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Не удалось корректно остановить сервер: %v", err)

		if err := srv.Close(); err != nil {
			log.Printf("Ошибка принудительного закрытия сервера: %v", err)
		}
	}

	log.Println("Сервер остановлен")
}
