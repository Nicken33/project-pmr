package handlers

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
)

const maxVideoSize int64 = 50 << 20 // 50 МБ
const maxVideoDuration = time.Minute

var errFFprobeUnavailable = errors.New("ffprobe не установлен")

func storeVideo(mediaDir, relativeDir string, source io.Reader, declaredSize int64) (string, error) {
	if declaredSize <= 0 || declaredSize > maxVideoSize {
		return "", fmt.Errorf("размер видео должен быть не больше 50 МБ")
	}
	relativeDir = filepath.Clean(relativeDir)
	if !filepath.IsLocal(relativeDir) {
		return "", fmt.Errorf("некорректная папка для видео")
	}

	targetDir := filepath.Join(mediaDir, relativeDir)
	if err := os.MkdirAll(targetDir, 0750); err != nil {
		return "", fmt.Errorf("не удалось создать папку для видео: %w", err)
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
			filepath.Join(relativeDir, hex.EncodeToString(randomName)+".mp4"),
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

func validateVideo(path string) error {
	ffprobePath, err := exec.LookPath("ffprobe")
	if err != nil {
		return errFFprobeUnavailable
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	cmd := exec.CommandContext(
		ctx,
		ffprobePath,
		"-v", "error",
		"-show_entries", "stream=codec_type,codec_name:format=duration",
		"-of", "json",
		path,
	)

	output, err := cmd.Output()
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return fmt.Errorf("проверка видео заняла слишком много времени")
		}
		return fmt.Errorf("файл не удалось прочитать как видео")
	}

	var metadata struct {
		Streams []struct {
			Type  string `json:"codec_type"`
			Codec string `json:"codec_name"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(output, &metadata); err != nil {
		return fmt.Errorf("не удалось прочитать данные видео")
	}

	videoFound := false
	for _, stream := range metadata.Streams {
		switch stream.Type {
		case "video":
			videoFound = true
			if stream.Codec != "h264" {
				return fmt.Errorf("видео должно быть в кодеке H.264")
			}
		case "audio":
			if stream.Codec != "aac" {
				return fmt.Errorf("звук должен быть в кодеке AAC")
			}
		}
	}

	if !videoFound {
		return fmt.Errorf("в файле не найден видеопоток")
	}

	duration, err := strconv.ParseFloat(metadata.Format.Duration, 64)
	if err != nil || duration <= 0 {
		return fmt.Errorf("не удалось определить длительность видео")
	}
	if duration > maxVideoDuration.Seconds() {
		return fmt.Errorf("длительность видео не должна превышать 60 секунд")
	}

	return nil
}
