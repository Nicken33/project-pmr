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

// UpsertGoogleUser ищет по google_sub, при отсутствии создаёт строку и
// возвращает её же. Повторный вход ничего не плодит, поэтому account_type,
// выданный вручную в базе, переживает перелогин.
//
// Каноническая схема (§7) не знает username и avatar_url: имя пользователя
// живёт в name, аватар — в avatar_path, роль — в account_type. Значения по
// умолчанию ('local' / 'user') заданы в самой таблице, здесь они явные.
func (r *Repository) UpsertGoogleUser(p models.GoogleProfile) (models.User, error) {
	row := r.db.QueryRow(`
		INSERT INTO users (email, name, avatar_path, provider, google_sub, account_type)
		VALUES ($2, $3, $4, 'google', $1, 'user')
		ON CONFLICT (google_sub) DO UPDATE SET
			email = EXCLUDED.email,
			name = EXCLUDED.name,
			avatar_path = EXCLUDED.avatar_path
		RETURNING id, email, COALESCE(name, ''), COALESCE(avatar_path, ''),
			provider, account_type
	`, p.Sub, p.Email, p.Name, p.Picture)

	var u models.User
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Provider, &u.Role); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Constraint == "users_email_key" {
			return models.User{}, ErrEmailTaken
		}
		return models.User{}, fmt.Errorf("сохранение пользователя Google: %w", err)
	}
	return u, nil
}
