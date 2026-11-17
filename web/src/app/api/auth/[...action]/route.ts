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

const ALLOWED = new Set(["google", "tester", "me", "logout", "login", "register", "token"]);
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

  if (name === "token") {
    const rawCookie = request.headers.get("cookie");
    const token = sessionTokenFromCookie(rawCookie);
    return Response.json({ token: token || null }, { headers: { "cache-control": "private, no-store", vary: "Cookie", ...NO_SNIFF } });
  }

  if (name === "logout" && method === "POST") {
    return Response.json({ authenticated: false }, { headers: {
      "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${forwardedProto(request) === "https" ? "; Secure" : ""}`,
      "cache-control": "private, no-store", vary: "Cookie", ...NO_SNIFF,
    }});
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
    ...(base.includes("ngrok") ? { "ngrok-skip-browser-warning": "true" } : {}),
  });

  // Обработка сброса пароля напрямую через /api/v1/auth/*
  if (ALLOWED_PATHS.has(actionPath)) {
    let upstream = await fetch(`${base}/api/v1/auth/${actionPath}`, {
      method,
      headers: requestHeaders,
      body,
      cache: "no-store",
      redirect: "manual",
    }).catch((err) => {
      console.error(`[auth-proxy error] ${base}/api/v1/auth/${actionPath}:`, err);
      return null;
    });

    if (upstream && isRedirect(upstream.status)) {
      const location = upstream.headers.get("location");
      if (location) {
        try {
          const resolved = new URL(location, `${base}/api/v1/auth/${actionPath}`);
          if (resolved.hostname === new URL(base).hostname) {
            const redirected = await fetch(resolved.toString(), {
              method,
              headers: requestHeaders,
              body,
              cache: "no-store",
              redirect: "manual",
            }).catch(() => null);
            if (redirected) upstream = redirected;
          }
        } catch {
          // ignore
        }
      }
    }

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
  const targetUrl = `${base}/api/auth/${name}`;
  let upstream = await fetch(targetUrl, {
    method,
    headers: requestHeaders,
    body,
    cache: "no-store",
    redirect: "manual",
  }).catch((err) => {
    console.error(`[auth-proxy error] ${targetUrl}:`, err);
    return null;
  });

  // Если бэкенд ответил 404, 405, redirect или произошла сетевая ошибка на /api/auth/*, пробуем префикс /api/v1/*
  const v1Path =
    name === "login" || name === "register"
      ? `${base}/api/v1/auth/${name}`
      : name === "me"
        ? `${base}/api/v1/me`
        : null;

  if (v1Path && (!upstream || upstream.status === 404 || upstream.status === 405 || isRedirect(upstream.status))) {
    const v1Upstream = await fetch(v1Path, {
      method,
      headers: requestHeaders,
      body,
      cache: "no-store",
      redirect: "manual",
    }).catch((err) => {
      console.error(`[auth-proxy error] ${v1Path}:`, err);
      return null;
    });
    if (v1Upstream) upstream = v1Upstream;
  }

  // Если upstream вернул редирект на тот же домен (например, http -> https)
  if (upstream && isRedirect(upstream.status)) {
    const location = upstream.headers.get("location");
    if (location) {
      try {
        const resolved = new URL(location, targetUrl);
        if (resolved.hostname === new URL(targetUrl).hostname) {
          const redirected = await fetch(resolved.toString(), {
            method,
            headers: requestHeaders,
            body,
            cache: "no-store",
            redirect: "manual",
          }).catch(() => null);
          if (redirected) upstream = redirected;
        }
      } catch {
        // ignore
      }
    }
  }

  // Для токена тестировщика: если бэкенд не имеет роута (404 / 502 / 503)
  if (name === "tester" && (!upstream || upstream.status === 404)) {
    let providedToken = "";
    try {
      if (body) {
        const parsed = JSON.parse(body) as { token?: string };
        providedToken = (parsed.token ?? "").trim();
      }
    } catch {
      // ignore
    }

    const expectedToken = (process.env.TESTER_TOKEN ?? "").trim();
    if (!expectedToken) {
      return Response.json(
        { error: { code: "service_unavailable", message: "Вход тестировщика не настроен" } },
        { status: 503 },
      );
    }
    if (providedToken && providedToken === expectedToken) {
      const isSecure = forwardedProto(request) === "https";
      const replyHeaders = new Headers({
        "content-type": "application/json",
        ...NO_SNIFF,
      });
      replyHeaders.append(
        "set-cookie",
        `${SESSION_COOKIE}=tester-session-${encodeURIComponent(providedToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${isSecure ? "; Secure" : ""}`,
      );
      return Response.json(
        {
          authenticated: true,
          tester: true,
          role: "tester",
          name: "Тестировщик",
          email: "tester@localhost",
          provider: "token",
        },
        { status: 200, headers: replyHeaders },
      );
    } else {
      return Response.json(
        { error: { code: "invalid_credentials", message: "Неверный токен тестировщика" } },
        { status: 401 },
      );
    }
  }

  // Для google: если бэкенд не поддерживает google OAuth (404)
  if (name === "google" && (!upstream || upstream.status === 404)) {
    return Response.json(
      { error: { code: "not_supported", message: "Вход через Google на этом сервере пока не настроен" } },
      { status: 501 },
    );
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
    "cache-control": "private, no-store",
    vary: "Cookie",
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
  if (upstream.status === 200 && (name === "login" || name === "register" || name === "google")) {
    const text = await upstream.text();
    try {
      const json = JSON.parse(text) as { token?: string; user?: unknown };
      if (json && typeof json.token === "string" && json.token) {
        replyHeaders.append(
          "set-cookie",
          `${SESSION_COOKIE}=${encodeURIComponent(json.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${isSecure ? "; Secure" : ""}`,
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
