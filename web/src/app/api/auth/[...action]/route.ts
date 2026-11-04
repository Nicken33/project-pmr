import { authBaseUrl } from "@/lib/api";

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
 */

const ALLOWED = new Set(["google", "tester", "me", "logout"]);

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ action: string[] }> };

export async function GET(request: Request, context: Context) {
  return relay(request, await context.params, "GET");
}

export async function POST(request: Request, context: Context) {
  return relay(request, await context.params, "POST");
}

async function relay(
  request: Request,
  { action }: { action: string[] },
  method: "GET" | "POST",
): Promise<Response> {
  const [name] = action ?? [];
  if (!name || action.length !== 1 || !ALLOWED.has(name)) {
    return Response.json({ error: "Неизвестный метод авторизации" }, { status: 404 });
  }

  const base = authBaseUrl();
  if (base === "") {
    return Response.json(
      { error: "Сервер авторизации не настроен — обратитесь к администратору" },
      { status: 503 },
    );
  }

  const visitorCookie = request.headers.get("cookie") ?? "";
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(/:$/, "");

  const requestHeaders = new Headers({
    accept: "application/json",
    // Бэкенд по этому заголовку решает, ставить на куке Secure. Без него за
    // обратным прокси https-сессия выходила бы как http.
    "x-forwarded-proto": forwardedProto,
    ...(visitorCookie ? { cookie: visitorCookie } : {}),
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
  });

  const upstream = await fetch(`${base}/api/auth/${name}`, {
    method,
    headers: requestHeaders,
    body: method === "POST" ? await request.text() : undefined,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) {
    return Response.json({ error: "Сервер авторизации недоступен" }, { status: 502 });
  }

  // Ответ посетителю собирается в отдельном Headers: заголовки запроса к бэкенду
  // (его кука, accept, x-forwarded-proto) уходить в браузер не должны.
  const replyHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) replyHeaders.set("content-type", contentType);
  for (const cookie of readSetCookies(upstream.headers)) replyHeaders.append("set-cookie", cookie);

  if (upstream.status === 204) return new Response(null, { status: 204, headers: replyHeaders });
  return new Response(await upstream.text(), { status: upstream.status, headers: replyHeaders });
}

function readSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === "function") return withGetter.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}
