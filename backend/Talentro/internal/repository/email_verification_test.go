package repository

import (
	"database/sql"
	"errors"
	"os"
	"sync"
	"testing"

	"talentro/internal/models"
)

// Uses a dedicated disposable database, never the application database.
func TestEmailRegistrationIntegration(t *testing.T) {
	dsn := os.Getenv("TALENTRO_EMAIL_TEST_DSN")
	if dsn == "" {
		t.Skip("TALENTRO_EMAIL_TEST_DSN not set")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var database string
	if err := db.QueryRow(`SELECT current_database()`).Scan(&database); err != nil {
		t.Fatal(err)
	}
	if database != "talentro_email_test" {
		t.Fatal("use a disposable talentro_email_test database")
	}
	if _, err := db.Exec(`CREATE TABLE users (id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT, name TEXT, account_type TEXT)`); err != nil {
		t.Fatal(err)
	}
	defer db.Exec(`DROP TABLE IF EXISTS pending_registrations, users`)
	migration, err := os.ReadFile("../../../../database/migrations/009_email_registration_confirmation.sql")
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err := db.Exec(string(migration)); err != nil {
			t.Fatal(err)
		}
	}
	repo := New(db)
	input := models.CreateUser{Email: "pending@example.test", Name: "Owner", AccountType: "section_owner"}
	if err := repo.BeginRegistration(input, "password-hash", "first-token-hash"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.GetUserByEmail(input.Email); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("pending account must not exist: %v", err)
	}
	if err := repo.BeginRegistration(input, "replacement", "too-early"); !errors.Is(err, ErrRegistrationCooldown) {
		t.Fatalf("cooldown: %v", err)
	}
	if found, err := repo.ResendRegistration(input.Email, "too-early"); err != nil || found {
		t.Fatalf("early resend: %v %v", found, err)
	}
	if _, err := db.Exec(`UPDATE pending_registrations SET sent_at = now() - interval '2 minutes'`); err != nil {
		t.Fatal(err)
	}
	if found, err := repo.ResendRegistration(input.Email, "second-token-hash"); err != nil || !found {
		t.Fatalf("resend: %v %v", found, err)
	}
	if err := repo.ConfirmRegistration("first-token-hash"); !errors.Is(err, ErrInvalidEmailVerificationToken) {
		t.Fatalf("old token: %v", err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); results <- repo.ConfirmRegistration("second-token-hash") }()
	}
	wg.Wait()
	close(results)
	var successes, invalid int
	for err := range results {
		if err == nil {
			successes++
		} else if errors.Is(err, ErrInvalidEmailVerificationToken) {
			invalid++
		} else {
			t.Fatal(err)
		}
	}
	if successes != 1 || invalid != 1 {
		t.Fatalf("single use: %d successes, %d invalid", successes, invalid)
	}
	user, err := repo.GetUserByEmail(input.Email)
	if err != nil || user.PasswordHash != "password-hash" || user.AccountType != "section_owner" {
		t.Fatalf("confirmed account: %+v %v", user, err)
	}
	if _, err := repo.UpdateUser(user.ID, models.UpdateUser{Email: "other@example.test", Name: "Changed"}); !errors.Is(err, ErrEmailChangeRequiresVerification) {
		t.Fatalf("email bypass: %v", err)
	}
	if _, err := repo.UpdateUser(user.ID, models.UpdateUser{Email: input.Email, Name: "Changed"}); err != nil {
		t.Fatal(err)
	}
	input.Email = "expired@example.test"
	if err := repo.BeginRegistration(input, "hash", "expired-token"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE pending_registrations SET expires_at = now() - interval '1 second'`); err != nil {
		t.Fatal(err)
	}
	if err := repo.ConfirmRegistration("expired-token"); !errors.Is(err, ErrInvalidEmailVerificationToken) {
		t.Fatalf("expiry: %v", err)
	}
	if _, err := db.Exec(`UPDATE pending_registrations SET created_at = now() - interval '25 hours', sent_at = now() - interval '2 minutes'`); err != nil {
		t.Fatal(err)
	}
	if found, err := repo.ResendRegistration(input.Email, "expired-request"); err != nil || found {
		t.Fatalf("expired request must require new registration: %v %v", found, err)
	}
	if err := repo.BeginRegistration(input, "replacement-password", "replacement-token"); err != nil {
		t.Fatal(err)
	}
	if err := repo.ConfirmRegistration("replacement-token"); err != nil {
		t.Fatal(err)
	}
	replaced, err := repo.GetUserByEmail(input.Email)
	if err != nil || replaced.PasswordHash != "replacement-password" {
		t.Fatalf("re-registration credentials: %+v %v", replaced, err)
	}
	if err := repo.BeginRegistration(input, "attack-password", "attack-token"); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("existing user registration: %v", err)
	}
	input.Email = "google@example.test"
	if err := repo.BeginRegistration(input, "old-password", "google-token"); err != nil {
		t.Fatal(err)
	}
	google, err := repo.GetOrCreateGoogleUser(input.Email, "Google", "user", "google-password")
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.ConfirmRegistration("google-token"); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("Google race: %v", err)
	}
	kept, err := repo.GetUserByEmail(input.Email)
	if err != nil || kept.ID != google.ID || kept.PasswordHash != "google-password" || kept.AccountType != "user" {
		t.Fatalf("Google account overwritten: %+v %v", kept, err)
	}
}
