package repository

import (
	"database/sql"
	"errors"
	"fmt"

	"talentro/internal/models"
)

var ErrInvalidEmailVerificationToken = errors.New("ссылка подтверждения недействительна или истекла")
var ErrRegistrationCooldown = errors.New("письмо уже отправлено, подожди минуту")
var ErrEmailChangeRequiresVerification = errors.New("для смены почты требуется отдельное подтверждение")

// Pending credentials are not an account: login, reviews and publication remain unavailable.
// Re-registering replaces the credentials and invalidates the previous confirmation link.
func (r *Repository) BeginRegistration(input models.CreateUser, passwordHash, tokenHash string) error {
	var exists bool
	if err := r.db.QueryRow(`SELECT EXISTS (SELECT 1 FROM users WHERE email = $1)`, input.Email).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return ErrEmailTaken
	}
	var email string
	err := r.db.QueryRow(`
		INSERT INTO pending_registrations (email, password_hash, name, account_type, token_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5, now() + interval '15 minutes')
		ON CONFLICT (email) DO UPDATE SET
		    password_hash = EXCLUDED.password_hash, name = EXCLUDED.name,
		    account_type = EXCLUDED.account_type, token_hash = EXCLUDED.token_hash,
		    expires_at = EXCLUDED.expires_at, created_at = now(), sent_at = now()
		WHERE pending_registrations.sent_at <= now() - interval '1 minute'
		RETURNING email`, input.Email, passwordHash, input.Name, input.AccountType, tokenHash).Scan(&email)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrRegistrationCooldown
	}
	return err
}

// An unknown, registered, expired or recently contacted address produces the same public response.
func (r *Repository) ResendRegistration(email, tokenHash string) (bool, error) {
	var found string
	err := r.db.QueryRow(`
		UPDATE pending_registrations SET token_hash = $2,
		    expires_at = now() + interval '15 minutes', sent_at = now()
		WHERE email = $1 AND created_at > now() - interval '24 hours'
		  AND sent_at <= now() - interval '1 minute'
		  AND NOT EXISTS (SELECT 1 FROM users WHERE email = $1)
		RETURNING email`, email, tokenHash).Scan(&found)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (r *Repository) ConfirmRegistration(tokenHash string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var email, passwordHash, name, accountType string
	err = tx.QueryRow(`SELECT email, password_hash, name, account_type
		FROM pending_registrations WHERE token_hash = $1 AND expires_at > now()
		FOR UPDATE`, tokenHash).Scan(&email, &passwordHash, &name, &accountType)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalidEmailVerificationToken
	}
	if err != nil {
		return err
	}
	// Google may have created the account meanwhile. Never overwrite its credentials or role.
	result, err := tx.Exec(`INSERT INTO users (email, password_hash, name, account_type)
		VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`, email, passwordHash, name, accountType)
	if err != nil {
		return fmt.Errorf("подтверждение регистрации: %w", err)
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM pending_registrations WHERE email = $1`, email); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}
	if count == 0 {
		return ErrEmailTaken
	}
	return nil
}
