package repository

import (
	"errors"
	"fmt"

	"github.com/lib/pq"

	"talentro/internal/models"
)

// ErrEmailTaken — адрес уже привязан к другому аккаунту. Молча переписать
// владельца нельзя: чужая сессия стала бы сессией вошедшего.
var ErrEmailTaken = errors.New("адрес электронной почты уже занят")

// googleUsername — из локальной части адреса плюс префикс хеша sub: одна и та
// же личность при повторном входе даёт то же имя, а два разных аккаунта с
// одинаковым локальным куском — разные.
const googleUsername = `left(split_part($2, '@', 1), 34) || '-' || substr(md5($1), 1, 8)`

// UpsertGoogleUser ищет по google_sub, при отсутствии создаёт строку и
// возвращает её же. Повторный вход ничего не плодит, поэтому role, выданная
// вручную в базе, переживает перелогин.
func (r *Repository) UpsertGoogleUser(p models.GoogleProfile) (models.User, error) {
	row := r.db.QueryRow(`
		INSERT INTO users (username, email, name, avatar_url, provider, google_sub, role)
		VALUES (`+googleUsername+`, $2, $3, $4, 'google', $1, 'user')
		ON CONFLICT (google_sub) DO UPDATE SET
			email = EXCLUDED.email,
			name = EXCLUDED.name,
			avatar_url = EXCLUDED.avatar_url
		RETURNING id, username, COALESCE(email, ''), COALESCE(name, ''),
			COALESCE(avatar_url, ''), provider, role
	`, p.Sub, p.Email, p.Name, p.Picture)

	var u models.User
	if err := row.Scan(&u.ID, &u.Username, &u.Email, &u.Name, &u.AvatarURL, &u.Provider, &u.Role); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Constraint == "users_email_key" {
			return models.User{}, ErrEmailTaken
		}
		return models.User{}, fmt.Errorf("сохранение пользователя Google: %w", err)
	}
	return u, nil
}
