package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"talentro/internal/models"
)

var ErrEmailTaken = errors.New("email занят")

func (r *Repository) CreateUser(input models.CreateUser, passwordHash string) (models.User, error) {
	var user models.User
	err := r.db.QueryRow(`
		INSERT INTO users (email, password_hash, name, account_type)
		VALUES ($1, $2, $3, $4)
		RETURNING id, email, name, account_type`,
		input.Email, passwordHash, input.Name, input.AccountType,
	).Scan(&user.ID, &user.Email, &user.Name, &user.AccountType)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return models.User{}, ErrEmailTaken
		}
		return models.User{}, fmt.Errorf("создание пользователя: %w", err)
	}
	return user, nil
}

// GetOrCreateGoogleUser creates a schema-compatible account on the first
// Google sign-in, or returns the existing account with the same verified email.
func (r *Repository) GetOrCreateGoogleUser(email, name, accountType, passwordHash string) (models.User, error) {
	var user models.User
	err := r.db.QueryRow(`
		INSERT INTO users (email, password_hash, name, account_type)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (email) DO NOTHING
		RETURNING id, email, name, account_type`, email, passwordHash, name, accountType).
		Scan(&user.ID, &user.Email, &user.Name, &user.AccountType)
	if errors.Is(err, sql.ErrNoRows) {
		return r.GetUserByEmail(email)
	}
	if err != nil {
		return models.User{}, fmt.Errorf("создание Google-пользователя: %w", err)
	}
	return user, nil
}

func (r *Repository) GetUserByEmail(email string) (models.User, error) {
	var user models.User
	var passwordHash sql.NullString
	err := r.db.QueryRow(`SELECT id, email, password_hash, name, account_type FROM users WHERE email = $1`, email).
		Scan(&user.ID, &user.Email, &passwordHash, &user.Name, &user.AccountType)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, sql.ErrNoRows
		}
		return models.User{}, fmt.Errorf("поиск пользователя: %w", err)
	}
	if passwordHash.Valid {
		user.PasswordHash = passwordHash.String
	}
	return user, nil
}

func (r *Repository) GetUserByID(id int64) (models.User, error) {
	var user models.User
	err := r.db.QueryRow(`SELECT id, email, name, account_type FROM users WHERE id = $1`, id).
		Scan(&user.ID, &user.Email, &user.Name, &user.AccountType)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, sql.ErrNoRows
		}
		return models.User{}, fmt.Errorf("получение профиля: %w", err)
	}
	return user, nil
}

func (r *Repository) UpdateUser(id int64, input models.UpdateUser) (models.User, error) {
	var user models.User
	err := r.db.QueryRow(`
		UPDATE users SET name = $3
		WHERE id = $1 AND email = $2
		RETURNING id, email, name, account_type`, id, input.Email, input.Name).
		Scan(&user.ID, &user.Email, &user.Name, &user.AccountType)
	if errors.Is(err, sql.ErrNoRows) {
		return models.User{}, ErrEmailChangeRequiresVerification
	}
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return models.User{}, ErrEmailTaken
		}
		return models.User{}, fmt.Errorf("обновление профиля: %w", err)
	}
	return user, nil
}

func (r *Repository) IsUserBlocked(userID int64) (bool, error) {
	var blocked bool
	err := r.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM blocks
			WHERE user_id = $1
			  AND revoked_at IS NULL
			  AND (expires_at IS NULL OR expires_at > now())
		)`,
		userID,
	).Scan(&blocked)
	if err != nil {
		return false, fmt.Errorf("проверка блокировки пользователя: %w", err)
	}
	return blocked, nil
}
