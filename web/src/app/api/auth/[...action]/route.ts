import { authBaseUrl } from "@/lib/api";
import {
  NO_SNIFF,
  isRedirect,
  safeContentType,
  sessionCookieHeader,
  siteHintHeaders,
} from "@/lib/proxy";

/**
 * Прокси входа на тот же origin, что и сайт.
 *
 * Кука сессии — HttpOnly, поэтому браузер не отдаст её JavaScript'у и не
 * приложит к запросу на другой порт: `SameSite=Lax` ходы между origin не
 * перевозит. Пока фронт и бэкенд живут на разных хостах стенда, единственный
 * способ завести и отправить куку — идти через Next, а Next уже знает адрес
 * бэкенда и пересылает `Set-Cookie` посетителю.
 *
 * Белый список имён нужен, чтобы прокси нельзя было превратить в свободный
 * пересылающий адрес: `params` распаковывает `%2F`, и без проверки запрос ушёл
 * бы на произвольный путь того же бэкенда.
 *
 * Свои ошибки прокси пишет тем же конвертом §9, что и бэкенд
 * (`{error:{code,message}}`): форма читает `error.message`, и без него посетитель
 * увидел бы сырой JSON. Тело ответа бэкенда пересылается как есть — оно и так
 * в этом конверте.
 */

const ALLOWED = new Set(["google", "tester", "me", "logout", "login", "register"]);

/** Google- JWT (~2 КиБ) и токен тестировщика здесь единственные тела; больше — не наше. */
const MAX_AUTH_BODY = 16 << 10;

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ action: string[] }> };

export async function GET(request: Request, context: Context) {
  return relay(request, await context.params, "GET");
}

export async function POST(request: Request, context: Context) {
  return relay(request, await context.params, "POST");
}

/**
 * Протокол, по которому посетитель дошёл до витрины. Бэкенд по нему решает,
 * ставить на куке `Secure`. Значение приходит из заголовка, который клиент может
 * подставить сам, поэтому наружу уходит только `http` или `https` — остальное
 * было бы попыткой продиктовать бэкенду произвольную строку.
 */
function forwardedProto(request: Request): "http" | "https" {
  const declared = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase();
  if (declared === "https" || declared === "http") return declared;
  return new URL(request.url).protocol === "https:" ? "https" : "http";
}

async function relay(
  request: Request,
  { action }: { action: string[] },
  method: "GET" | "POST",
): Promise<Response> {
  const [name] = action ?? [];
  if (!name || action.length !== 1 || !ALLOWED.has(name)) {
    return Response.json(
      { error: { code: 404, message: "Неизвестный метод авторизации" } },
      { status: 404 },
    );
  }

  const base = authBaseUrl();
  if (base === "") {
    return Response.json(
      {
        error: {
          code: 503,
          message: "Сервер авторизации не настроен — обратитесь к администратору",
        },
      },
      { status: 503 },
    );
  }

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    if (body.length > MAX_AUTH_BODY) {
      return Response.json(
        { error: { code: 413, message: "Слишком длинный запрос входа" } },
        { status: 413 },
      );
    }
  }

  const sessionCookie = sessionCookieHeader(request.headers.get("cookie"));

  const requestHeaders = new Headers({
    accept: "application/json",
    // Бэкенд по этому заголовку решает, ставить на куке Secure. Без него за
    // обратным прокси https-сессия выходила бы как http.
    "x-forwarded-proto": forwardedProto(request),
    // Признаки браузера для CSRF-защиты бэкенда (`SameSiteGuard`). Не перешлём —
    // бэкенд видел бы вход без origin и никогда не отказывал бы чужому сайту:
    // прокси стоит между браузером и API и по умолчанию слепит этот рубеж.
    // Заголовок едет только если браузер его прислал (см. `siteHintHeaders`).
    ...siteHintHeaders(request.headers),
    ...(sessionCookie ? { cookie: sessionCookie } : {}),
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
  });

  const upstream = await fetch(`${base}/api/auth/${name}`, {
    method,
    headers: requestHeaders,
    body,
    cache: "no-store",
    // Редирект от auth-среза не сопровождаем: при переходе на другой host fetch
    // повторил бы запрос с кукой сессии, а адрес перехода назначает не витрина.
    redirect: "manual",
  }).catch(() => null);

  if (!upstream || isRedirect(upstream.status)) {
    return Response.json(
      { error: { code: 502, message: "Сервер авторизации недоступен" } },
      { status: 502 },
    );
  }

  // Ответ посетителю собирается в отдельном Headers: заголовки запроса к бэкенду
  // (его кука, accept, x-forwarded-proto) уходить в браузер не должны.
  const replyHeaders = new Headers({
    "content-type": safeContentType(upstream.headers.get("content-type")),
    ...NO_SNIFF,
  });
  // 429 без Retry-After превращается в «попробуйте позже» вслепую: форма не
  // может сказать, сколько ждать, и посетитель долбит вход, углубляя блок.
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) replyHeaders.set("retry-after", retryAfter);
  for (const cookie of readSetCookies(upstream.headers)) replyHeaders.append("set-cookie", cookie);

  if (upstream.status === 204) return new Response(null, { status: 204, headers: replyHeaders });
  const text = await upstream.text();
  return new Response(text === "" ? null : text, { status: upstream.status, headers: replyHeaders });
}

function readSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === "function") return withGetter.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}
