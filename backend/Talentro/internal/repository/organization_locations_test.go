package repository

import (
	"database/sql"
	"errors"
	"os"
	"testing"
)

func TestDeleteOrganizationLocationPostgres(t *testing.T) {
	dsn := os.Getenv("TALENTRO_SEARCH_TEST_DSN")
	if dsn == "" {
		t.Skip("set TALENTRO_SEARCH_TEST_DSN for PostgreSQL tests")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	// Temporary tables remain on this one connection, never touching real tables.
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`CREATE TEMP TABLE organizations (id bigint PRIMARY KEY, owner_id bigint);
 CREATE TEMP TABLE locations (id bigint PRIMARY KEY, organization_id bigint REFERENCES organizations(id));
 CREATE TEMP TABLE age_groups (id bigint PRIMARY KEY, location_id bigint REFERENCES locations(id) ON DELETE CASCADE);
 INSERT INTO organizations VALUES (1, 10), (2, 20);
 INSERT INTO locations VALUES (101,1), (102,1), (201,2);
 INSERT INTO age_groups VALUES (1,102);`)
	if err != nil {
		t.Fatal(err)
	}
	repo := New(db)
	if err := repo.DeleteOrganizationLocation(10, 201); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("foreign location: %v", err)
	}
	if err := repo.DeleteOrganizationLocation(10, 102); !errors.Is(err, ErrOrganizationLocationInUse) {
		t.Fatalf("linked location: %v", err)
	}
	var groups int
	if err := db.QueryRow(`SELECT count(*) FROM age_groups`).Scan(&groups); err != nil || groups != 1 {
		t.Fatalf("groups lost: %d %v", groups, err)
	}
	if err := repo.DeleteOrganizationLocation(10, 101); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteOrganizationLocation(10, 101); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("deleted location: %v", err)
	}
	if err := repo.DeleteOrganizationLocation(99, 201); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("unknown owner: %v", err)
	}
	var remaining int
	if err := db.QueryRow(`SELECT count(*) FROM locations`).Scan(&remaining); err != nil || remaining != 2 {
		t.Fatalf("remaining=%d err=%v", remaining, err)
	}
}
