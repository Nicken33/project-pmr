package handlers

import (
	"testing"
	"time"

	"talentro/internal/models"
)

func TestArgon2PasswordHash(t *testing.T) {
	hash, err := hashPassword("correct-horse-battery")
	if err != nil {
		t.Fatalf("hashPassword: %v", err)
	}
	if !verifyPassword("correct-horse-battery", hash) {
		t.Fatal("verifyPassword rejected the correct password")
	}
	if verifyPassword("wrong-password", hash) {
		t.Fatal("verifyPassword accepted an incorrect password")
	}
}

func TestSignedTokenValidation(t *testing.T) {
	h := NewAuthHandler(nil, "0123456789abcdef0123456789abcdef")
	token, err := h.issueToken(models.User{ID: 42, AccountType: "user"})
	if err != nil {
		t.Fatalf("issueToken: %v", err)
	}
	claims, err := h.parseToken(token)
	if err != nil {
		t.Fatalf("parseToken: %v", err)
	}
	if claims.UserID != 42 || claims.Role != "user" || claims.Expiry <= time.Now().Unix() {
		t.Fatalf("unexpected claims: %#v", claims)
	}
	if _, err := h.parseToken(token + "x"); err == nil {
		t.Fatal("parseToken accepted a tampered token")
	}
}
