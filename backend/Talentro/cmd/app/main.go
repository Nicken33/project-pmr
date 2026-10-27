package main

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"talentro/internal/delivery/http/handlers"
	"talentro/internal/repository"
)

func main() {
	repo := repository.New(repository.NewDB())

	cardHandler := handlers.NewCardHandler(repo)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// 5. Вешаем роут на наш хендлер
	r.Get("/api/cards", cardHandler.SearchCard)

	// 6. Запускаем сервер на 8080 порту
	serverAddr := ":8080"
	println("Сервер запущен на http://localhost" + serverAddr)
	if err := http.ListenAndServe(serverAddr, r); err != nil {
		panic(err)
	}
}
