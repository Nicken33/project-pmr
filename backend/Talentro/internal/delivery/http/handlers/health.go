package handlers

import (
	"context"
	"log"
	"net/http"
	"time"

	"talentro/internal/httpx"
)

type DBPinger interface {
	Ping(ctx context.Context) error
}

// Version задается сборкой: -ldflags "-X ...handlers.Version=1.2.3". §9.1 хочет
// версию в /health, а «unknown» на локальном стенде честнее, чем придуманная.
var Version = "unknown"

type HealthHandler struct {
	db DBPinger
}

func NewHealthHandler(db DBPinger) *HealthHandler {
	return &HealthHandler{db: db}
}

type healthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Version  string `json:"version"`
}

// Health — GET /health (§9.1). База живёт в отдельном признаке: процесс может
// отвечать, но без БД каталог всё равно пустой, и стенд должен это видеть.
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	body := healthResponse{Status: "ok", Database: "connected", Version: Version}
	status := http.StatusOK

	if err := h.db.Ping(ctx); err != nil {
		log.Printf("health: база недоступна: %v", err)
		body.Status = "error"
		body.Database = "disconnected"
		status = http.StatusServiceUnavailable
	}

	httpx.WriteJSON(w, status, body)
}
