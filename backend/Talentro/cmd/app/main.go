package main

import (
	"context"
	"errors"
	"fmt"
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

	cardHandler := handlers.NewCardHandler(repo)
	healthHandler := handlers.NewHealthHandler(repo)
	authHandler := handlers.NewAuthHandler(repo, cfg.JWTSecret, cfg.MediaDir)

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(httpdelivery.RequestIDHeader)
	r.Use(httpdelivery.CORS(cfg.AllowedOrigins))
	r.Use(httpdelivery.JSONRequestLogger)
	r.Use(middleware.Recoverer)

	httpdelivery.RegisterRoutes(
		r,
		cardHandler,
		healthHandler,
		authHandler,
		cfg.MediaDir,
	)

	serverAddr := ":" + cfg.Port

	srv := &http.Server{
		Addr:    serverAddr,
		Handler: r,
	}

	serverErrors := make(chan error, 1)

	printStartupBanner("http://localhost" + serverAddr)
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
		fmt.Println("\n🛑 Получен сигнал остановки. Завершаю работу сервера...")
		printShutdownBanner()
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

func printStartupBanner(address string) {
	purple := "\033[38;5;141m"
	reset := "\033[0m"

	fmt.Printf("\n%s", purple)
	fmt.Println("╭──────────────────────────────────────╮")
	fmt.Println("│           TALENTRO API               │")
	fmt.Printf("│     Запуск: %s\n", address)
	fmt.Println("╰──────────────────────────────────────╯")
	fmt.Print(reset)
}

func printShutdownBanner() {
	purple := "\033[38;5;141m"
	reset := "\033[0m"

	fmt.Printf("\n%s", purple)
	fmt.Println("╭──────────────────────────────────────╮")
	fmt.Println("│         Сервер остановлен            │")
	fmt.Println("╰──────────────────────────────────────╯")
	fmt.Print(reset)
}
