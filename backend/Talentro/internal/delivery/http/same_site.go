package deliveryhttp

import (
	"net"
	"net/http"
	"net/url"
	"strings"

	"talentro/internal/httpx"
)

// SameSiteGuard отказывает запросам, которые браузер отправил с чужого сайта,
// если эти запросы выдают или снимают куку сессии.
//
// До этого вход держался на одном признаке: `SameSite=Lax` не прикладывает куку
// к POST с чужой страницы. Признак рабочий, но единственный — и проверяется он
// только в браузере жертвы. Здесь добавляется второй, независимый: браузер сам
// сообщает, откуда ушёл запрос (`Origin`), и какова его принадлежность
// (`Sec-Fetch-Site`). Теперь отказ не зависит от одной настройки куки.
//
// Запрос без обоих заголовков проходит. Их не присылают curl, приёмочная
// матрица и серверный прокси витрины (`web/src/app/api/auth/[...action]/route.ts`
// пересылает только `x-forwarded-proto` и `cookie`): это не браузер, приложить
// чужую куку сам он не может, и ломать ему вход — значит терять покрытие
// эндпоинтов, а не получать защиту.
func SameSiteGuard(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !mutatesSession(r.Method) {
				next.ServeHTTP(w, r)
				return
			}
			if fromCrossSiteBrowser(r, allowed) {
				httpx.WriteError(w, httpx.NewError(http.StatusForbidden, "запрос с чужого сайта", nil))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// mutatesSession — методы, на которых браузер прикладывает куку при переходе с
// чужой страницы: POST проходит с `SameSite=Lax` (в отличие от GET он не
// «навигация»), поэтому именно они и под угрозой. GET и OPTIONS здесь ни при
// чём: первый ничего не меняет, второй обслуживает CORS до этой прослойки.
func mutatesSession(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	}
	return false
}

// fromCrossSiteBrowser — ответ на вопрос «ушёл ли этот запрос с чужого сайта».
// Отказывается при любом прямом признаке; отсутствие признаков — не признак.
func fromCrossSiteBrowser(r *http.Request, allowed map[string]struct{}) bool {
	if strings.EqualFold(strings.TrimSpace(r.Header.Get("Sec-Fetch-Site")), "cross-site") {
		return true
	}

	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return false
	}
	if _, ok := allowed[origin]; ok {
		return false
	}

	// Дальше сравниваем хосты, а не origin целиком: `http://localhost:3000` и
	// `http://localhost:8080` — одно место в смысле SameSite, и витрина на
	// другом порту (стенд без обратного прокси) не должна выглядеть чужой.
	// Схема и порт учитываются только в ALLOWED_ORIGINS, где их вписывает тот,
	// кто знает топологию.
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Hostname() == "" {
		// `Origin: null` (изолированный iframe без allow-same-origin) и мусор:
		// принадлежность сайту снята намеренно, принимать её за свою нечем.
		return true
	}
	return !strings.EqualFold(parsed.Hostname(), hostOnly(r.Host))
}

// hostOnly — хост заголовка Host без порта. IPv6 в скобках («[::1]:8080»)
// разбирается SplitHostPort; голый «[::1]» — нет, поэтому скобки снимаются
// руками, иначе сравнение с hostname из Origin вечно расходилось бы.
func hostOnly(host string) string {
	if h, _, err := net.SplitHostPort(host); err == nil {
		return strings.ToLower(h)
	}
	return strings.ToLower(strings.Trim(host, "[]"))
}
