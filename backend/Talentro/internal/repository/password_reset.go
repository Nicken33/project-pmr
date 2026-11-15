package repository

import (
	"database/sql"
	"errors"
	"fmt"
)

var ErrInvalidPasswordResetToken = errors.New("недействительный токен восстановления пароля")

// Создаёт запись для сброса пароля.
// Если пользователя с такой почтой нет, вернёт found=false без ошибки.
func (r *Repository) CreatePasswordResetToken(email, tokenHash string) (found bool, err error) {
	var id int64

	err = r.db.QueryRow(`
		INSERT INTO password_reset_tokens (user_id, token_hash)
		SELECT id, $2
		FROM users
		WHERE email = $1
		RETURNING id`,
		email, tokenHash,
	).Scan(&id)

	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("создание токена восстановления пароля: %w", err)
	}

	return true, nil
}

// Меняет пароль, погашает использованный токен
// и остальные ещё действующие токены этого пользователя.
func (r *Repository) ResetPassword(tokenHash, passwordHash string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("начало сброса пароля: %w", err)
	}
	defer tx.Rollback()

	var tokenID, userID int64
	err = tx.QueryRow(`
		SELECT t.id, t.user_id
		FROM password_reset_tokens t
		JOIN users u ON u.id = t.user_id
		WHERE t.token_hash = $1
		  AND t.used_at IS NULL
		  AND t.expires_at > now()
		FOR UPDATE OF t, u`,
		tokenHash,
	).Scan(&tokenID, &userID)

	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalidPasswordResetToken
	}
	if err != nil {
		return fmt.Errorf("проверка токена восстановления пароля: %w", err)
	}

	_, err = tx.Exec(`
		UPDATE users
		SET password_hash = $1, updated_at = now()
		WHERE id = $2`,
		passwordHash, userID,
	)
	if err != nil {
		return fmt.Errorf("обновление пароля: %w", err)
	}

	_, err = tx.Exec(`
		UPDATE password_reset_tokens
		SET used_at = now()
		WHERE user_id = $1
		  AND used_at IS NULL
		  AND expires_at > now()`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("погашение токенов восстановления пароля: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("сохранение нового пароля: %w", err)
	}

	return nil
}
