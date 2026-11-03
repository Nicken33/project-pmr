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

	activityHandler := handlers.NewActivityHandler(repo)
	healthHandler := handlers.NewHealthHandler(repo)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	httpdelivery.RegisterRoutes(r, activityHandler, healthHandler)

	serverAddr := ":" + cfg.Port

	srv := &http.Server{
		Addr:    serverAddr,
		Handler: r,
	}

	serverErrors := make(chan error, 1)

	go func() {
		serverErrors <- srv.ListenAndServe()
	}()

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)

	select {
	case err := <-serverErrors:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("ошибка HTTP-сервера: %v", err)
		}

	case <-ctx.Done():
		log.Println("Получен сигнал остановки сервера")
	}

	defer stop()

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
}
