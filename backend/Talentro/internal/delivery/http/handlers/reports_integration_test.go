package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"

	"github.com/go-chi/chi/v5"
	"talentro/internal/models"
	"talentro/internal/repository"
)

// Optional integration suite; run only against the dedicated disposable database.
func TestReportsReviewsAndMediaIntegration(t *testing.T) {
	dsn := os.Getenv("TALENTRO_REPORTS_TEST_DSN")
	if dsn == "" {
		t.Skip("disposable PostgreSQL DSN not set")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var name string
	if err := db.QueryRow(`SELECT current_database()`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "talentro_reports_test" {
		t.Fatal("refusing to reset any database except talentro_reports_test")
	}
	_, err = db.Exec(`DROP SCHEMA public CASCADE;CREATE SCHEMA public;
 CREATE TABLE users(id BIGINT PRIMARY KEY,name text NOT NULL);
 CREATE TABLE organizations(id BIGINT PRIMARY KEY,owner_id BIGINT REFERENCES users);
 CREATE TABLE activities(id BIGINT PRIMARY KEY,organization_id BIGINT REFERENCES organizations,owner_id BIGINT REFERENCES users,name text,slug text,status text,is_active boolean,rejection_reason text);
 CREATE TABLE age_groups(id BIGINT PRIMARY KEY,activity_id BIGINT REFERENCES activities,location_id BIGINT);
 CREATE TABLE reviews(id BIGSERIAL PRIMARY KEY,activity_id BIGINT NOT NULL REFERENCES activities,author_id BIGINT NOT NULL REFERENCES users,text text NOT NULL,status text NOT NULL DEFAULT 'published',hidden_reason text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT different_constraint_name UNIQUE(activity_id,author_id),
 CHECK((status='published' AND hidden_reason IS NULL) OR (status='hidden_by_report' AND hidden_reason IS NOT NULL)));
 CREATE TABLE media(id BIGSERIAL PRIMARY KEY,activity_id BIGINT REFERENCES activities,location_id BIGINT,media_type text NOT NULL DEFAULT 'photo',path text NOT NULL,caption text,sort_order int NOT NULL DEFAULT 0);
 INSERT INTO users VALUES(1,'owner'),(2,'reader'),(3,'reader'),(4,'moderator');
 INSERT INTO organizations VALUES(1,1);
 INSERT INTO activities VALUES(1,1,1,'Activity','activity','published',true,NULL);`)
	if err != nil {
		t.Fatal(err)
	}
	migration, err := os.ReadFile("../../../../../../database/migrations/005_reports_review_media.sql")
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err := db.Exec(string(migration)); err != nil {
			t.Fatalf("migration run %d: %v", i, err)
		}
	}
	repo := repository.New(db)
	first, err := repo.CreateActivityReview(2, 1, "first review")
	if err != nil {
		t.Fatal(err)
	}
	second, err := repo.CreateActivityReview(3, 1, "second review")
	if err != nil {
		t.Fatal(err)
	}
	if first.ID == second.ID {
		t.Fatal("different authors must get distinct reviews")
	}
	if _, err := repo.CreateActivityReview(2, 1, "duplicate"); !errors.Is(err, repository.ErrReviewAlreadyExists) {
		t.Fatalf("duplicate: %v", err)
	}
	if _, err := repo.CreateActivityReview(1, 1, "own"); !errors.Is(err, repository.ErrCannotReviewOwnActivity) {
		t.Fatalf("own: %v", err)
	}
	if _, err := repo.AddReviewMedia(3, first.ID, "photo", "reviews/no.jpg", nil); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("foreign media write: %v", err)
	}
	photo, err := repo.AddReviewMedia(2, first.ID, "photo", "reviews/1/a.jpg", nil)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 4; i++ {
		if _, err := repo.AddReviewMedia(2, first.ID, "photo", fmt.Sprintf("reviews/1/%d.jpg", i), nil); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := repo.AddReviewMedia(2, first.ID, "photo", "overflow.jpg", nil); !errors.Is(err, repository.ErrReviewMediaLimit) {
		t.Fatalf("photo limit: %v", err)
	}
	if _, err := repo.AddReviewMedia(2, first.ID, "video", "reviews/1/a.mp4", nil); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.AddReviewMedia(2, first.ID, "video", "overflow.mp4", nil); !errors.Is(err, repository.ErrReviewMediaLimit) {
		t.Fatalf("video limit: %v", err)
	}
	list, err := repo.ListActivityReviews(1, 1, 20)
	if err != nil || list.Total != 2 {
		t.Fatalf("reviews: %v %#v", err, list)
	}
	found := false
	for _, v := range list.Items {
		if v.ID == first.ID {
			found = len(v.Photos) == 5 && len(v.Videos) == 1
		}
	}
	if !found {
		t.Fatal("media must round-trip in public review list")
	}
	input := models.ReportInput{TargetType: "review", TargetID: first.ID, Reason: "abuse", Detail: "details"}
	report, err := repo.CreateReport(3, input)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.CreateReport(3, input); !errors.Is(err, repository.ErrReportExists) {
		t.Fatalf("duplicate report: %v", err)
	}
	mediaReport, err := repo.CreateReport(3, models.ReportInput{TargetType: "media", TargetID: photo.ID, Reason: "photo"})
	if err != nil {
		t.Fatal(err)
	}
	cardReport, err := repo.CreateReport(2, models.ReportInput{TargetType: "card", TargetID: 1, Reason: "card"})
	if err != nil {
		t.Fatal(err)
	}
	queue, err := repo.ListReports("review", "open", 1, 20)
	if err != nil || queue.Total != 1 || len(queue.Items) != 1 {
		t.Fatalf("separate queue: %v %#v", err, queue)
	}
	if _, err := repo.DecideReport(4, mediaReport.ID, "hide", "bad media"); err != nil {
		t.Fatal(err)
	}
	list, err = repo.ListActivityReviews(1, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range list.Items {
		if v.ID == first.ID && len(v.Photos) != 4 {
			t.Fatal("hidden photo still listed")
		}
	}
	if _, err := repo.DecideReport(4, report.ID, "hide", "abuse"); err != nil {
		t.Fatal(err)
	}
	list, err = repo.ListActivityReviews(1, 1, 20)
	if err != nil || list.Total != 1 {
		t.Fatalf("hidden review still listed: %v", err)
	}
	if _, err := repo.DecideReport(4, report.ID, "dismiss", ""); !errors.Is(err, repository.ErrReportDecided) {
		t.Fatalf("decision conflict: %v", err)
	}
	if _, err := repo.DecideReport(4, report.ID, "hide", "same"); err != nil {
		t.Fatal("idempotent decision:", err)
	}
	if _, err := repo.DecideReport(4, cardReport.ID, "hide", "bad card"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.ListActivityReviews(1, 1, 20); !errors.Is(err, repository.ErrActivityNotReviewable) {
		t.Fatal("hidden activity remains public", err)
	}

	// Role authorization and error mapping over actual HTTP handlers.
	h := NewAuthHandler(repo, "test-secret-at-least-32-characters", t.TempDir())
	router := chi.NewRouter()
	router.With(h.RequireAuth, h.RequireRole("moderator")).Get("/reports", h.Reports)
	for _, tc := range []struct {
		role string
		id   int64
		want int
	}{{"user", 2, 403}, {"moderator", 4, 200}} {
		// RequireAuth reads the role from the database, not from a possibly stale JWT.
		if _, err := db.Exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type text;UPDATE users SET email='reader@example.com',account_type='user';UPDATE users SET account_type='moderator' WHERE id=4;CREATE TABLE IF NOT EXISTS blocks(user_id bigint,revoked_at timestamptz,expires_at timestamptz);`); err != nil {
			t.Fatal(err)
		}
		token, err := h.issueToken(models.User{ID: tc.id, AccountType: tc.role})
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest("GET", "/reports", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Fatalf("role %s: %d %s", tc.role, w.Code, w.Body.String())
		}
	}
	// Own and duplicate review errors must remain specific HTTP responses.
	reviewRouter := chi.NewRouter()
	reviewRouter.With(h.RequireAuth).Post("/activities/{id}/reviews", h.CreateActivityReview)
	for _, tc := range []struct {
		id   int64
		want int
	}{{1, 403}, {2, 409}} {
		token, _ := h.issueToken(models.User{ID: tc.id})
		req := httptest.NewRequest("POST", "/activities/1/reviews", bytes.NewBufferString(`{"text":"review"}`))
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		reviewRouter.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Fatalf("review author %d: got %d want %d: %s", tc.id, w.Code, tc.want, w.Body.String())
		}
	}
	// A public user cannot upload files to another user's review; no file is written.
	if _, err := db.Exec(`UPDATE activities SET status='published';UPDATE reviews SET status='published',hidden_reason=NULL`); err != nil {
		t.Fatal(err)
	}
	upload := chi.NewRouter()
	upload.With(h.RequireAuth).Post("/reviews/{id}/{kind:photos|videos}", h.UploadReviewMedia)
	token, _ := h.issueToken(models.User{ID: 3})
	req := httptest.NewRequest("POST", fmt.Sprintf("/reviews/%d/photos", first.ID), bytes.NewBufferString("unused"))
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	upload.ServeHTTP(w, req)
	if w.Code != 404 {
		t.Fatalf("foreign upload HTTP: %d", w.Code)
	}
	if entries, err := os.ReadDir(h.mediaDir); err != nil || len(entries) != 0 {
		t.Fatal("foreign upload created files", err)
	}
	// Storage enforces the actual byte limit, not only the declared upload size.
	data := append([]byte{0xff, 0xd8, 0xff}, make([]byte, maxActivityPhotoSize)...)
	if _, err := storeReviewPhoto(h.mediaDir, "reviews/1", bytes.NewReader(data)); err == nil {
		t.Fatal("oversized photo accepted")
	}
	files, _ := filepath.Glob(filepath.Join(h.mediaDir, "reviews/1/*"))
	if len(files) != 0 {
		t.Fatal("failed upload left files")
	}
	// Real multipart photo -> file on disk -> public review JSON -> deletion.
	var freshID int64
	if err := db.QueryRow(`INSERT INTO reviews(activity_id,author_id,text) VALUES(1,4,'photo test') RETURNING id`).Scan(&freshID); err != nil {
		t.Fatal(err)
	}
	routerUpload := chi.NewRouter()
	routerUpload.With(h.RequireAuth).Post("/reviews/{id}/{kind:photos|videos}", h.UploadReviewMedia)
	routerUpload.With(h.RequireAuth).Delete("/reviews/{id}/media/{mediaID}", h.DeleteReviewMedia)
	ownerToken, _ := h.issueToken(models.User{ID: 4})
	uploadFile := func(kind, filename string, data []byte) models.ReviewMedia {
		t.Helper()
		var body bytes.Buffer
		form := multipart.NewWriter(&body)
		part, err := form.CreateFormFile("file", filename)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(data); err != nil {
			t.Fatal(err)
		}
		if err := form.Close(); err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest("POST", fmt.Sprintf("/reviews/%d/%s", freshID, kind), &body)
		req.Header.Set("Authorization", "Bearer "+ownerToken)
		req.Header.Set("Content-Type", form.FormDataContentType())
		w := httptest.NewRecorder()
		routerUpload.ServeHTTP(w, req)
		if w.Code != 201 {
			t.Fatalf("upload %s: %d %s", kind, w.Code, w.Body.String())
		}
		var media models.ReviewMedia
		if err := json.Unmarshal(w.Body.Bytes(), &media); err != nil {
			t.Fatal(err)
		}
		if _, err := os.Stat(filepath.Join(h.mediaDir, media.Path)); err != nil {
			t.Fatal("uploaded file absent", err)
		}
		return media
	}
	var jpegData bytes.Buffer
	if err := jpeg.Encode(&jpegData, image.NewRGBA(image.Rect(0, 0, 8, 8)), nil); err != nil {
		t.Fatal(err)
	}
	uploaded := uploadFile("photos", "photo.jpg", jpegData.Bytes())
	if ffmpeg, err := exec.LookPath("ffmpeg"); err == nil {
		path := filepath.Join(t.TempDir(), "tiny.mp4")
		output, err := exec.Command(ffmpeg, "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=32x32:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", path).CombinedOutput()
		if err != nil {
			t.Fatalf("video fixture: %v %s", err, output)
		}
		video, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		uploadFile("videos", "tiny.mp4", video)
	}
	req = httptest.NewRequest("DELETE", fmt.Sprintf("/reviews/%d/media/%d", freshID, uploaded.ID), nil)
	req.Header.Set("Authorization", "Bearer "+ownerToken)
	w = httptest.NewRecorder()
	routerUpload.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatalf("delete: %d %s", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(h.mediaDir, uploaded.Path)); !os.IsNotExist(err) {
		t.Fatal("deleted photo remains on disk", err)
	}

	// Concurrent uploads must not exceed the per-review quota.
	var wg sync.WaitGroup
	outcomes := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := repo.AddReviewMedia(4, freshID, "photo", fmt.Sprintf("reviews/concurrent-%d.jpg", i), nil)
			outcomes <- err
		}(i)
	}
	wg.Wait()
	close(outcomes)
	accepted := 0
	for err := range outcomes {
		if err == nil {
			accepted++
		} else if !errors.Is(err, repository.ErrReviewMediaLimit) {
			t.Fatal(err)
		}
	}
	if accepted != 5 {
		t.Fatalf("concurrent quota accepted %d uploads, want 5", accepted)
	}
}
