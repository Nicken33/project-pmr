package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	"talentro/internal/models"
)

// listETag — отпечаток страницы: состав и порядок карточек плюс общее число
// подходящих. If-None-Match сравнивает слабые метки по RFC 7232, а префикс W/
// честно говорит, что побайтовая точность ответа не гарантирована.
func listETag(cards []models.Card, total int) string {
	var b strings.Builder
	b.WriteString(strconv.Itoa(total))
	b.WriteByte('|')
	for _, c := range cards {
		b.WriteString(c.ID)
		b.WriteByte(',')
	}
	return weak(sum(b.String()))
}

// cardETag — отпечаток карточки по её id и времени последнего изменения (§9.3):
// правка модератором сдвигает updated_at, а значит и метку.
func cardETag(id string, updatedAt time.Time) string {
	return weak(sum(id + "|" + updatedAt.UTC().Format(time.RFC3339)))
}

func sum(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])[:16]
}

func weak(digest string) string {
	return `W/"` + digest + `"`
}

// matchAny разбирает If-None-Match — список меток или `*`.
func matchAny(header, etag string) bool {
	header = strings.TrimSpace(header)
	switch {
	case header == "":
		return false
	case header == "*":
		return true
	}
	for _, candidate := range strings.Split(header, ",") {
		if strings.TrimSpace(candidate) == etag {
			return true
		}
	}
	return false
}
