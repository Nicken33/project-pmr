package repository

import (
	"database/sql"
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

// ErrNoUser — почты в базе нет. Отличать этот случай от «не тот пароль» наружу
// нельзя: почта уникальна (§3.7.1), поэтому ответ «такого адреса нет» — это
// проверка существования адреса, которую атакующий превратит в перебор.
var ErrNoUser = errors.New("пользователь не найден")

// PasswordByEmail — строка пользователя и хэш его пароля. Пустой хэш означает,
// что пароль не задан: аккаунт заведён входом через сервис (§3.7.4), и проверять
// для него пароль нечем.
func (r *Repository) PasswordByEmail(email string) (models.User, string, error) {
	var (
		u    models.User
		hash sql.NullString
	)

	err := r.db.QueryRow(`
		SELECT id, email, COALESCE(name, ''), COALESCE(avatar_path, ''),
			provider, account_type, password_hash
		FROM users
		WHERE email = $1
	`, email).Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Provider, &u.Role, &hash)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return models.User{}, "", ErrNoUser
	case err != nil:
		return models.User{}, "", fmt.Errorf("поиск пользователя по почте: %w", err)
	}

	return u, hash.String, nil
}

// InsertLocalUser — регистрация по почте и паролю (§3.7.1). account_type всегда
// 'user': тип аккаунта меняет модератор, а не тот, кто зарегистрировался
// (§3.7.2), поэтому поле из тела запроса серверу не нужно.
//
// Дубль ловит уникальность индекса, а не проверка «есть ли такой»: между SELECT
// и INSERT два посетителя успели бы завести одну почту дважды.
func (r *Repository) InsertLocalUser(email, name, passwordHash string) (models.User, error) {
	var u models.User

	err := r.db.QueryRow(`
		INSERT INTO users (email, password_hash, name, provider, account_type)
		VALUES ($1, $2, $3, 'local', 'user')
		RETURNING id, email, COALESCE(name, ''), COALESCE(avatar_path, ''), provider, account_type
	`, email, passwordHash, name).
		Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Provider, &u.Role)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Constraint == "users_email_key" {
			return models.User{}, ErrEmailTaken
		}
		return models.User{}, fmt.Errorf("создание учётной записи: %w", err)
	}

	return u, nil
}
