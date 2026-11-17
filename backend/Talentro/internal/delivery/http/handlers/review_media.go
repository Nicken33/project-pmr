package handlers

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"talentro/internal/repository"
)

var errReviewPhotoFormat = errors.New("поддерживаются JPG, PNG и WebP")
var errReviewPhotoSize = errors.New("фото больше 10 МиБ")

func storeReviewPhoto(dir, relativeDir string, source io.Reader) (string, error) {
	header := make([]byte, 512)
	n, err := io.ReadFull(source, header)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return "", err
	}
	ext, ok := activityPhotoExtension(header[:n])
	if !ok {
		return "", errReviewPhotoFormat
	}
	if err := os.MkdirAll(filepath.Join(dir, relativeDir), 0750); err != nil {
		return "", err
	}
	for attempt := 0; attempt < 5; attempt++ {
		var token [16]byte
		if _, err := rand.Read(token[:]); err != nil {
			return "", err
		}
		path := filepath.ToSlash(filepath.Join(relativeDir, hex.EncodeToString(token[:])+ext))
		full := filepath.Join(dir, filepath.FromSlash(path))
		dst, err := os.OpenFile(full, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0640)
		if os.IsExist(err) {
			continue
		}
		if err != nil {
			return "", err
		}
		written, copyErr := io.Copy(dst, io.LimitReader(io.MultiReader(bytes.NewReader(header[:n]), source), maxActivityPhotoSize+1))
		closeErr := dst.Close()
		if copyErr != nil || closeErr != nil || written > maxActivityPhotoSize {
			_ = os.Remove(full)
			if written > maxActivityPhotoSize {
				return "", errReviewPhotoSize
			}
			return "", fmt.Errorf("сохранение фотографии: %w", errors.Join(copyErr, closeErr))
		}
		return path, nil
	}
	return "", fmt.Errorf("не удалось создать файл")
}

func (h *AuthHandler) UploadReviewMedia(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		writeAPIError(w, 400, "invalid_id", "некорректный id отзыва")
		return
	}
	userID, _ := currentIdentity(r)
	if err := h.repo.CanUploadReviewMedia(userID, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeAPIError(w, 404, "not_found", "доступный отзыв не найден у этого пользователя")
		} else {
			log.Printf("CanUploadReviewMedia: %v", err)
			writeAPIError(w, 500, "internal_error", "не удалось проверить отзыв")
		}
		return
	}
	if !h.limiter.allow("review-media:"+strconv.FormatInt(userID, 10), 30, time.Hour) {
		writeAPIError(w, 429, "rate_limited", "слишком много загрузок")
		return
	}
	kind := "photo"
	limit := int64(maxActivityPhotoSize)
	if chi.URLParam(r, "kind") == "videos" {
		kind = "video"
		limit = maxVideoSize
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit+(1<<20))
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
		writeAPIError(w, 413, "invalid_upload", "не удалось прочитать файл или превышен размер")
		return
	}
	defer r.MultipartForm.RemoveAll()
	file, header, err := r.FormFile("file")
	if err != nil {
		writeAPIError(w, 400, "missing_file", "прикрепите файл в поле file")
		return
	}
	defer file.Close()
	if header.Size <= 0 || header.Size > limit {
		writeAPIError(w, 413, "file_too_large", "превышен допустимый размер файла")
		return
	}
	caption := optionalFormText(r.FormValue("caption"))
	if caption != nil && utf8.RuneCountInString(*caption) > 255 {
		writeAPIError(w, 400, "invalid_fields", "подпись не должна превышать 255 символов")
		return
	}
	relativeDir := filepath.Join("reviews", strconv.FormatInt(id, 10))
	var path string
	if kind == "video" {
		path, err = storeVideo(h.mediaDir, relativeDir, file, header.Size)
	} else {
		path, err = storeReviewPhoto(h.mediaDir, relativeDir, file)
	}
	if err != nil {
		log.Printf("StoreReviewMedia: %v", err)
		if errors.Is(err, errReviewPhotoFormat) {
			writeAPIError(w, 415, "invalid_media", err.Error())
		} else if errors.Is(err, errReviewPhotoSize) {
			writeAPIError(w, 413, "file_too_large", err.Error())
		} else {
			var fileErr *os.PathError
			if errors.As(err, &fileErr) {
				writeAPIError(w, 500, "storage_error", "не удалось сохранить файл на сервере")
			} else {
				writeAPIError(w, 400, "invalid_media", "не удалось сохранить файл: проверьте формат и размер")
			}
		}
		return
	}
	full := filepath.Join(h.mediaDir, filepath.FromSlash(path))
	keep := false
	defer func() {
		if !keep {
			_ = os.Remove(full)
		}
	}()
	if kind == "video" {
		if err := validateVideo(full); err != nil {
			if errors.Is(err, errFFprobeUnavailable) {
				writeAPIError(w, 500, "video_validation_unavailable", "проверка видео недоступна")
			} else {
				writeAPIError(w, 415, "invalid_video", err.Error())
			}
			return
		}
	}
	media, err := h.repo.AddReviewMedia(userID, id, kind, path, caption)
	if errors.Is(err, repository.ErrReviewMediaLimit) {
		writeAPIError(w, 409, "media_limit", err.Error())
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		writeAPIError(w, 404, "not_found", "доступный отзыв не найден у этого пользователя")
		return
	}
	if err != nil {
		log.Printf("AddReviewMedia: %v", err)
		writeAPIError(w, 500, "upload_failed", "не удалось привязать файл к отзыву")
		return
	}
	keep = true
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, media)
}

func (h *AuthHandler) DeleteReviewMedia(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	mid, mediaErr := strconv.ParseInt(chi.URLParam(r, "mediaID"), 10, 64)
	if err != nil || mediaErr != nil || id <= 0 || mid <= 0 {
		writeAPIError(w, 400, "invalid_id", "некорректный id")
		return
	}
	userID, _ := currentIdentity(r)
	path, err := h.repo.DeleteReviewMedia(userID, id, mid)
	if errors.Is(err, sql.ErrNoRows) {
		writeAPIError(w, 404, "not_found", "файл не найден у вашего отзыва")
		return
	}
	if err != nil {
		log.Printf("DeleteReviewMedia: %v", err)
		writeAPIError(w, 500, "internal_error", "не удалось удалить файл")
		return
	}
	local := filepath.FromSlash(path)
	if filepath.IsLocal(local) {
		if err := os.Remove(filepath.Join(h.mediaDir, local)); err != nil && !os.IsNotExist(err) {
			log.Printf("DeleteReviewMedia file: %v", err)
		}
	}
	w.WriteHeader(http.StatusNoContent)
}
