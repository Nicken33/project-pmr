import { authBaseUrl } from "@/lib/api";
import {
  NO_SNIFF,
  SESSION_COOKIE,
  bearerAuthHeader,
  clientIpHeaders,
  isRedirect,
  safeContentType,
  sessionCookieHeader,
  sessionTokenFromCookie,
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
 * Адаптер совместимости:
 * Если бэкенд использует `/api/v1/auth/*` и `/api/v1/me` с JWT токенами (как Go Talentro),
 * прокси автоматически пробует этот путь при 404, сохраняет токен в куку `talentro_session`
 * и подставляет `Authorization: Bearer <token>`.
 */

const ALLOWED = new Set(["google", "tester", "me", "logout", "login", "register"]);
const ALLOWED_PATHS = new Set(["password-reset/request", "password-reset/confirm"]);

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
  const actionPath = (action ?? []).join("/");
  const isAllowed = (action?.length === 1 && ALLOWED.has(name)) || ALLOWED_PATHS.has(actionPath);
  if (!name || !isAllowed) {
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

  const rawCookie = request.headers.get("cookie");
  const sessionCookie = sessionCookieHeader(rawCookie);
  const bearerHeader = bearerAuthHeader(rawCookie);

  const requestHeaders = new Headers({
    accept: "application/json",
    "x-forwarded-proto": forwardedProto(request),
    ...siteHintHeaders(request.headers),
    ...clientIpHeaders(request.headers),
    ...(sessionCookie ? { cookie: sessionCookie } : {}),
    ...bearerHeader,
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
  });

  // Обработка сброса пароля напрямую через /api/v1/auth/*
  if (ALLOWED_PATHS.has(actionPath)) {
    const upstream = await fetch(`${base}/api/v1/auth/${actionPath}`, {
      method,
      headers: requestHeaders,
      body,
      cache: "no-store",
      redirect: "manual",
    }).catch(() => null);

    if (!upstream || isRedirect(upstream.status)) {
      return Response.json(
        { error: { code: 502, message: "Сервер авторизации недоступен" } },
        { status: 502 },
      );
    }

    const replyHeaders = new Headers({
      "content-type": safeContentType(upstream.headers.get("content-type")),
      "cache-control": "private, no-store",
      vary: "Cookie",
      ...NO_SNIFF,
    });
    const text = await upstream.text();
    return new Response(text === "" ? null : text, {
      status: upstream.status,
      headers: replyHeaders,
    });
  }

  // Сначала пробуем канонический путь
  let targetUrl = `${base}/api/auth/${name}`;
  let upstream = await fetch(targetUrl, {
    method,
    headers: requestHeaders,
    body,
    cache: "no-store",
    redirect: "manual",
  }).catch(() => null);

  // Если бэкенд ответил 404 на /api/auth/*, пробуем префикс /api/v1/*
  if (upstream && upstream.status === 404) {
    const v1Path =
      name === "login" || name === "register"
        ? `${base}/api/v1/auth/${name}`
        : name === "me"
          ? `${base}/api/v1/me`
          : null;

    if (v1Path) {
      const v1Upstream = await fetch(v1Path, {
        method,
        headers: requestHeaders,
        body,
        cache: "no-store",
        redirect: "manual",
      }).catch(() => null);
      if (v1Upstream) upstream = v1Upstream;
    }
  }

  if (!upstream || isRedirect(upstream.status)) {
    return Response.json(
      { error: { code: 502, message: "Сервер авторизации недоступен" } },
      { status: 502 },
    );
  }

  const isSecure = forwardedProto(request) === "https";
  const replyHeaders = new Headers({
    "content-type": safeContentType(upstream.headers.get("content-type")),
    ...NO_SNIFF,
  });

  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) replyHeaders.set("retry-after", retryAfter);

  for (const cookie of readSetCookies(upstream.headers)) replyHeaders.append("set-cookie", cookie);

  // Если это выход, дополнительно сбрасываем куку
  if (name === "logout") {
    replyHeaders.append(
      "set-cookie",
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure ? "; Secure" : ""}`,
    );
  }

  // Если login или register вернул токен в JSON, сохраняем его в куку сессии
  if (upstream.ok && (name === "login" || name === "register")) {
    const text = await upstream.text();
    try {
      const json = JSON.parse(text) as { token?: string; user?: unknown };
      if (json && typeof json.token === "string" && json.token) {
        replyHeaders.append(
          "set-cookie",
          `${SESSION_COOKIE}=${encodeURIComponent(json.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${isSecure ? "; Secure" : ""}`,
        );
      }
    } catch {
      // Игнорируем ошибку парсинга
    }
    return new Response(text === "" ? null : text, { status: upstream.status, headers: replyHeaders });
  }

  // Если /api/v1/me вернул пользователя в формате Go бэкенда, дополняем SessionState
  if (upstream.ok && name === "me") {
    const text = await upstream.text();
    try {
      const user = JSON.parse(text) as {
        id?: string | number;
        email?: string;
        name?: string;
        account_type?: string;
        authenticated?: boolean;
      };
      if (user && user.authenticated === undefined && user.id !== undefined) {
        const sessionState = {
          authenticated: true,
          tester: false,
          role: user.account_type ?? "user",
          name: user.name ?? "",
          email: user.email ?? "",
          id: String(user.id),
        };
        return Response.json(sessionState, { status: 200, headers: replyHeaders });
      }
    } catch {
      // Игнорируем ошибку парсинга
    }
    return new Response(text === "" ? null : text, { status: upstream.status, headers: replyHeaders });
  }

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
