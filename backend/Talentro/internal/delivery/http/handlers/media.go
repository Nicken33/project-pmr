package handlers

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"talentro/internal/repository"
)

const maxActivityPhotoSize = 10 << 20 // 10 МБ

func (h *AuthHandler) UploadActivityPhoto(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxActivityPhotoSize+(1<<20))

	if err := r.ParseMultipartForm(maxActivityPhotoSize); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid_upload", "не удалось прочитать загруженный файл")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	activityID, err := strconv.ParseInt(r.FormValue("activity_id"), 10, 64)
	if err != nil || activityID <= 0 {
		writeAPIError(w, http.StatusBadRequest, "invalid_activity_id", "укажи корректный activity_id")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, "missing_file", "прикрепи фотографию в поле file")
		return
	}
	defer file.Close()

	if header.Size == 0 || header.Size > maxActivityPhotoSize {
		writeAPIError(w, http.StatusRequestEntityTooLarge, "file_too_large", "файл должен быть не больше 10 МБ")
		return
	}

	signature := make([]byte, 512)
	n, readErr := io.ReadFull(file, signature)
	if readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF {
		writeAPIError(w, http.StatusBadRequest, "invalid_file", "не удалось прочитать файл")
		return
	}

	extension, ok := activityPhotoExtension(signature[:n])
	if !ok {
		writeAPIError(w, http.StatusUnsupportedMediaType, "unsupported_file", "поддерживаются фотографии JPG, PNG и WebP")
		return
	}

	ownerID, _ := currentIdentity(r)

	activityDir := filepath.Join(h.mediaDir, "activities", strconv.FormatInt(activityID, 10))
	if err := os.MkdirAll(activityDir, 0750); err != nil {
		writeAPIError(w, http.StatusInternalServerError, "storage_error", "не удалось подготовить хранилище")
		return
	}

	randomName := make([]byte, 16)
	if _, err := rand.Read(randomName); err != nil {
		writeAPIError(w, http.StatusInternalServerError, "storage_error", "не удалось создать имя файла")
		return
	}

	filename := hex.EncodeToString(randomName) + extension
	relativePath := filepath.ToSlash(filepath.Join("activities", strconv.FormatInt(activityID, 10), filename))
	fullPath := filepath.Join(h.mediaDir, filepath.FromSlash(relativePath))

	destination, err := os.OpenFile(fullPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0640)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, "storage_error", "не удалось сохранить фотографию")
		return
	}

	_, copyErr := io.Copy(destination, io.MultiReader(bytes.NewReader(signature[:n]), file))
	closeErr := destination.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(fullPath)
		writeAPIError(w, http.StatusInternalServerError, "storage_error", "не удалось сохранить фотографию")
		return
	}

	caption := optionalFormText(r.FormValue("caption"))
	sourceURL := optionalFormText(r.FormValue("source_url"))
	license := optionalFormText(r.FormValue("license"))

	photo, err := h.repo.AddOwnedActivityPhoto(
		ownerID,
		activityID,
		relativePath,
		caption,
		sourceURL,
		license,
	)
	if errors.Is(err, sql.ErrNoRows) {
		_ = os.Remove(fullPath)
		writeAPIError(w, http.StatusNotFound, "not_found", "секция не найдена у этого владельца")
		return
	}
	if err != nil {
		_ = os.Remove(fullPath)
		writeAPIError(w, http.StatusInternalServerError, "upload_failed", "не удалось привязать фотографию к секции")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, photo)
}

func activityPhotoExtension(data []byte) (string, bool) {
	if len(data) >= 3 &&
		data[0] == 0xff &&
		data[1] == 0xd8 &&
		data[2] == 0xff {
		return ".jpg", true
	}

	if len(data) >= 8 &&
		bytes.Equal(data[:8], []byte{137, 80, 78, 71, 13, 10, 26, 10}) {
		return ".png", true
	}

	if len(data) >= 12 &&
		string(data[:4]) == "RIFF" &&
		string(data[8:12]) == "WEBP" {
		return ".webp", true
	}

	return "", false
}

func optionalFormText(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

var _ = fmt.Sprintf
var _ = repository.ErrCardNotFound
