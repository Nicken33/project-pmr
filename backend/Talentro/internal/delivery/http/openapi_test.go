package deliveryhttp

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"talentro/internal/delivery/http/handlers"
	"talentro/internal/repository"
)

// Тест сверяет docs/openapi.yaml с реальной таблицей маршрутов chi. Специация
// §6.1 живёт отдельно от кода и расходится с ним молча: новый путь забывают в
// описании, старый убирают из обработчика — и мобильный клиент генерирует
// запросы в несуществующий эндпоинт. Здесь расхождение валит go test.
//
// Блок paths вычитывается напрямую, без YAML-библиотеки: нужны ровно ключи
// первого уровня и имена методов под ними, а разводить ради этого dependency в
// модуле незачем.
func TestOpenAPICoversRoutes(t *testing.T) {
	spec := openapiOperations(t, findOpenAPISpec(t))

	router := chi.NewRouter()
	RegisterRoutes(
		router,
		handlers.NewCatalogHandler(repository.New(nil)),
		handlers.NewHealthHandler(nil),
		testAuthHandler(t),
	)

	got := map[string]bool{}
	if err := chi.Walk(router, func(method, route string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		got[method+" "+route] = true
		return nil
	}); err != nil {
		t.Fatalf("обход маршрутов: %v", err)
	}

	missing := []string{}
	for op := range spec {
		if !got[op] {
			missing = append(missing, op)
		}
	}
	sort.Strings(missing)
	if len(missing) > 0 {
		t.Errorf("операций в openapi.yaml, которых нет в маршрутах: %v — путь придуман, а не реализован", missing)
	}

	extra := []string{}
	for op := range got {
		if !spec[op] {
			extra = append(extra, op)
		}
	}
	sort.Strings(extra)
	if len(extra) > 0 {
		t.Errorf("маршрутов, не описанных в openapi.yaml: %v — обнови спецификацию или убери маршрут", extra)
	}
}

// findOpenAPISpec идёт вверх от рабочей директории теста: go test запускает
// бинарник из каталога пакета, а репозиторий cloned и как отдельное дерево, и
// как worktree, поэтому фиксированное «../../../…» отработается на втором же
// переезде.
func findOpenAPISpec(t *testing.T) string {
	t.Helper()

	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("не определена рабочая директория: %v", err)
	}
	for i := 0; i < 8; i++ {
		candidate := filepath.Join(dir, "docs", "openapi.yaml")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	t.Fatal("docs/openapi.yaml не найден ни рядом, ни выше по дереву — тест читает спецификацию относительно рабочей директории")
	return ""
}

var httpMethods = map[string]bool{
	"get": true, "put": true, "post": true, "delete": true,
	"patch": true, "head": true, "options": true, "trace": true,
}

// openapiOperations возвращает множество «МЕТОД /путь» из блока paths. Пустое
// множество означало бы сломанный разбор, а не «спецификация без маршрутов»:
// chi-таблица заведомо непустая, и сверка выше это ловит.
func openapiOperations(t *testing.T, path string) map[string]bool {
	t.Helper()

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("не прочитан %s: %v", path, err)
	}

	ops := map[string]bool{}
	seen := map[string]bool{}
	current := ""
	inPaths := false

scan:
	for _, raw := range strings.Split(string(data), "\n") {
		line := strings.TrimRight(raw, "\r")

		if !inPaths {
			// До блока paths значим только сам заголовок: комментарии, info,
			// servers и tags описаниями маршрутов не являются.
			if line == "paths:" {
				inPaths = true
			}
			continue
		}

		if strings.TrimSpace(line) == "" || strings.HasPrefix(line, "#") {
			continue
		}

		indent := len(line) - len(strings.TrimLeft(line, " "))
		key, rest, ok := strings.Cut(strings.TrimSpace(line), ":")
		if !ok {
			continue
		}

		switch {
		case indent == 0:
			break scan // следующий раздел документа — блок paths закончился
		case indent == 2 && strings.HasPrefix(key, "/"):
			if seen[key] {
				t.Errorf("дубликат пути %q в блоке paths — вторая запись не читается", key)
			}
			seen[key] = true
			current = key
			if rest != "" {
				t.Errorf("у пути %q содержимое должно начинаться со следующей строки, получили %q", key, rest)
			}
		case indent == 2:
			t.Errorf("в блоке paths ожидаются пути с отступом 2, а встретилось %q", line)
		case indent == 4 && httpMethods[key] && rest == "":
			if current == "" {
				t.Errorf("метод %q без пути над ним", key)
				continue
			}
			ops[strings.ToUpper(key)+" "+current] = true
		}
	}

	if !inPaths {
		t.Fatalf("в %s нет блока paths: на нулевом отступе", path)
	}
	if len(ops) == 0 {
		t.Errorf("из %s не извлечено ни одной операции — блок paths пуст или разобран неверно", path)
	}
	return ops
}
