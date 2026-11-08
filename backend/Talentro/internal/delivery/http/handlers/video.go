package handlers

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const maxVideoSize int64 = 50 << 20 // 50 МБ

func storeVideo(mediaDir string, source io.Reader, declaredSize int64) (string, error) {
	if declaredSize <= 0 || declaredSize > maxVideoSize {
		return "", fmt.Errorf("размер видео должен быть не больше 50 МБ")
	}

	// У обычного MP4 в начале файла есть метка ftyp.
	header := make([]byte, 12)
	n, err := io.ReadFull(source, header)
	if err != nil || n != len(header) || string(header[4:8]) != "ftyp" {
		return "", fmt.Errorf("поддерживаются файлы MP4")
	}

	var destination *os.File
	var relativePath string
	var fullPath string

	for attempt := 0; attempt < 5; attempt++ {
		randomName := make([]byte, 16)
		if _, err := rand.Read(randomName); err != nil {
			return "", fmt.Errorf("не удалось создать имя файла: %w", err)
		}

		relativePath = filepath.ToSlash(
			filepath.Join("videos", hex.EncodeToString(randomName)+".mp4"),
		)
		fullPath = filepath.Join(mediaDir, filepath.FromSlash(relativePath))

		destination, err = os.OpenFile(
			fullPath,
			os.O_WRONLY|os.O_CREATE|os.O_EXCL,
			0640,
		)
		if err == nil {
			break
		}
		if !os.IsExist(err) {
			return "", fmt.Errorf("не удалось создать файл видео: %w", err)
		}
	}

	if destination == nil {
		return "", fmt.Errorf("не удалось подобрать свободное имя для видео")
	}

	stored := false
	defer func() {
		if !stored {
			_ = os.Remove(fullPath)
		}
	}()

	written, copyErr := io.Copy(
		destination,
		io.LimitReader(
			io.MultiReader(bytes.NewReader(header), source),
			maxVideoSize+1,
		),
	)
	closeErr := destination.Close()

	if copyErr != nil {
		return "", fmt.Errorf("не удалось сохранить видео: %w", copyErr)
	}
	if closeErr != nil {
		return "", fmt.Errorf("не удалось закрыть файл видео: %w", closeErr)
	}
	if written > maxVideoSize {
		return "", fmt.Errorf("видео больше 50 МБ")
	}

	stored = true
	return relativePath, nil
}
