package handlers

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

func (h *AuthHandler) UploadOrganizationCover(w http.ResponseWriter, r *http.Request) {
	userID, _ := currentIdentity(r)
	id := strconv.FormatInt(userID, 10)
	if !h.limiter.allow("organization-cover:"+id, 20, time.Hour) {
		writeAPIError(w, http.StatusTooManyRequests, "rate_limited", "слишком много загрузок")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxActivityPhotoSize+(1<<20))
	if err := r.ParseMultipartForm(maxActivityPhotoSize); err != nil {
		var limit *http.MaxBytesError
		if errors.As(err, &limit) {
			writeAPIError(w, http.StatusRequestEntityTooLarge, "file_too_large", "обложка должна быть не больше 10 МиБ")
		} else {
			writeAPIError(w, http.StatusBadRequest, "invalid_upload", "не удалось прочитать загруженный файл")
		}
		return
	}
	defer r.MultipartForm.RemoveAll()

	file, header, err := r.FormFile("file")
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "missing_file", "прикрепи обложку в поле file")
		return
	}
	defer file.Close()
	if header.Size > maxActivityPhotoSize {
		writeAPIError(w, http.StatusRequestEntityTooLarge, "file_too_large", "обложка должна быть не больше 10 МиБ")
		return
	}

	dir := filepath.Join("organizations", id)
	path, err := storeReviewPhoto(h.mediaDir, dir, file)
	switch {
	case errors.Is(err, errReviewPhotoFormat):
		writeAPIError(w, http.StatusUnsupportedMediaType, "unsupported_file", "поддерживаются JPG, PNG и WebP")
		return
	case errors.Is(err, errReviewPhotoSize):
		writeAPIError(w, http.StatusRequestEntityTooLarge, "file_too_large", "обложка должна быть не больше 10 МиБ")
		return
	case err != nil:
		log.Printf("UploadOrganizationCover: %v", err)
		writeAPIError(w, http.StatusInternalServerError, "storage_error", "не удалось сохранить обложку")
		return
	}

	previous, err := h.repo.SetOrganizationCover(userID, path)
	if err != nil {
		_ = os.Remove(filepath.Join(h.mediaDir, filepath.FromSlash(path)))
		if errors.Is(err, sql.ErrNoRows) {
			writeAPIError(w, http.StatusNotFound, "not_found", "сначала создай профиль организации")
		} else {
			log.Printf("SetOrganizationCover: %v", err)
			writeAPIError(w, http.StatusInternalServerError, "upload_failed", "не удалось привязать обложку к организации")
		}
		return
	}
	if previous != nil {
		old := filepath.Clean(filepath.FromSlash(*previous))
		if filepath.Dir(old) == dir && old != filepath.FromSlash(path) {
			if err := os.Remove(filepath.Join(h.mediaDir, old)); err != nil && !os.IsNotExist(err) {
				log.Printf("UploadOrganizationCover: удаление старой обложки: %v", err)
			}
		}
	}
	writeJSON(w, map[string]string{"cover_path": path})
}
