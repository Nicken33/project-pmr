// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./[...action]/route";

/**
 * Прокси `/api/auth/*` пересылает куку сессии между браузером и бэкендом, поэтому
 * он обязан уметь ровно шесть имён и никакой другой путь. Эти проверки — про
 * границу: иначе прокси превращается в свободный пересылающий адрес на бэкенде.
 *
 * Среда — node, не jsdom: `Set-Cookie` живёт именно в серверном рантайме Next, а
 * браузерный Headers по спецификации эту куку молча отбрасывают.
 */

type Params = { params: Promise<{ action: string[] }> };

function request(url: string, init?: RequestInit) {
  return new Request(`http://site.local${url}`, init);
}

function context(action: string): Params {
  return { params: Promise.resolve({ action: action.split("/") }) };
}

const upstream = vi.fn();

beforeEach(() => {
  process.env.NEXT_PUBLIC_AUTH_URL = "http://backend.local:8080";
  upstream.mockReset();
  vi.stubGlobal("fetch", upstream);
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_AUTH_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
  vi.unstubAllGlobals();
});

describe("белый список методов", () => {
  it("чужое имя не уходит на бэкенд", async () => {
    const response = await GET(request("/api/auth/admin"), context("admin"));
    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("путь с слешем не разбирается по каталогам", async () => {
    const response = await POST(
      request("/api/auth/me%2F..%2F..%2Fadmin", { method: "POST", body: "{}" }),
      context("me/../admin"),
    );
    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("разрешённые шесть имён доходят до бэкенда", async () => {
    upstream.mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    for (const name of ["google", "tester", "me", "logout", "login", "register"]) {
      await GET(request(`/api/auth/${name}`), context(name));
    }
    expect(upstream.mock.calls.map((call) => call[0].toString())).toEqual([
      "http://backend.local:8080/api/auth/google",
      "http://backend.local:8080/api/auth/tester",
      "http://backend.local:8080/api/auth/me",
      "http://backend.local:8080/api/auth/logout",
      "http://backend.local:8080/api/auth/login",
      "http://backend.local:8080/api/auth/register",
    ]);
  });

  it("login и register везут тело, а не пустой объект", async () => {
    upstream.mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    const body = JSON.stringify({ email: "a@example.test", password: "секрет-1234" });
    await POST(request("/api/auth/login", { method: "POST", body }), context("login"));
    await POST(request("/api/auth/register", { method: "POST", body }), context("register"));
    expect(upstream.mock.calls.map((call) => (call[1] as RequestInit).body)).toEqual([body, body]);
  });
});

describe("пересылка сессии", () => {
  it("без адреса бэкенда — 503, а не пустой ответ", async () => {
    delete process.env.NEXT_PUBLIC_AUTH_URL;
    const response = await GET(request("/api/auth/me"), context("me"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 503, message: expect.stringContaining("не настроен") },
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("кука посетителя и Set-Cookie бэкенда едут через прокси", async () => {
    // Так же, как это делает живой fetch: кука попадает в header list с провода, а
    // не через init Response — инициализация по спецификации её бы отбросила.
    const upstreamHeaders = new Headers({ "content-type": "application/json" });
    upstreamHeaders.append("set-cookie", "talentro_session=abc; HttpOnly; SameSite=Lax");
    upstream.mockResolvedValue(new Response("{}", { status: 200, headers: upstreamHeaders }));
    const response = await POST(
      request("/api/auth/tester", {
        method: "POST",
        body: JSON.stringify({ token: "t" }),
        headers: { cookie: "talentro_session=incoming" },
      }),
      context("tester"),
    );
    const relayed =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie().join("\n")
        : (response.headers.get("set-cookie") ?? "");
    expect(relayed).toContain("talentro_session=abc");
    const forwarded = upstream.mock.calls[0][1] as RequestInit;
    expect(new Headers(forwarded.headers).get("cookie")).toBe("talentro_session=incoming");
    expect(forwarded.body).toBe(JSON.stringify({ token: "t" }));
    // Заголовки запроса к бэкенду не должны возвращаться посетителю: в них его
    // собственная HttpOnly-кука и служебный x-forwarded-proto. `nosniff` прокси
    // добавляет сам — это его заголовок ответа, а не пересланный с бэкенда.
    expect([...response.headers.keys()].sort()).toEqual([
      "content-type",
      "set-cookie",
      "x-content-type-options",
    ]);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("204 от логина не превращается в 200 с телом", async () => {
    upstream.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await POST(
      request("/api/auth/logout", { method: "POST", body: "{}" }),
      context("logout"),
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("429 входа доходит вместе с Retry-After", async () => {
    // Без срока посетитель видел бы «попробуйте позже» вслепую и долбил вход,
    // углубляя блок §12.2; конверт ошибки бэкенда при этом остаётся телом.
    const envelope = JSON.stringify({
      error: { code: 429, message: "слишком много попыток входа, подожди немного" },
    });
    upstream.mockResolvedValue(
      new Response(envelope, {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "58" },
      }),
    );
    const response = await POST(
      request("/api/auth/login", { method: "POST", body: "{}" }),
      context("login"),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("58");
    expect(await response.json()).toMatchObject({ error: { code: 429 } });
  });

  it("недоступный бэкенд — 502 с человеческим текстом", async () => {
    upstream.mockRejectedValue(new Error("connect refused"));
    const response = await GET(request("/api/auth/me"), context("me"));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: 502, message: expect.stringContaining("недоступен") },
    });
  });
});

describe("признаки браузера для CSRF-защиты", () => {
  /**
   * Второй рубеж входа живёт на бэкенде: `SameSiteGuard`
   * (`backend/Talentro/internal/delivery/http/same_site.go`) отказывает
   * POST-запросу с чужого сайта по `Sec-Fetch-Site` или `Origin`. Видит он при
   * этом только то, что довезёт прокси, — браузер ходит в API не напрямую. Поэтому
   * прокси обязан переслать оба признака как есть и молчать, когда их не было:
   * пустой `origin` бэкенд разбирает как «чужой», и мобильный клиент (Flutter Dio
   * приходит без Origin) получил бы 403 на легитимном входе.
   */
  async function headersSentByProxy(incoming: Record<string, string>): Promise<Headers> {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    await POST(request("/api/auth/login", { method: "POST", body: "{}", headers: incoming }), context("login"));
    return new Headers((upstream.mock.calls[0][1] as RequestInit).headers);
  }

  it("чужой origin доезжает до бэкенда нетронутым", async () => {
    const sent = await headersSentByProxy({ origin: "https://evil.example" });
    expect(sent.get("origin")).toBe("https://evil.example");
  });

  it("sec-fetch-site: cross-site доезжает до бэкенда", async () => {
    const sent = await headersSentByProxy({ "sec-fetch-site": "cross-site" });
    expect(sent.get("sec-fetch-site")).toBe("cross-site");
  });

  it("оба признака уходят вместе и ничего не добавляется от себя", async () => {
    const sent = await headersSentByProxy({ origin: "https://evil.example", "sec-fetch-site": "cross-site" });
    expect(sent.get("origin")).toBe("https://evil.example");
    expect(sent.get("sec-fetch-site")).toBe("cross-site");
    // Прокси не подставляет origin витрины: «своего» адреса у серверного хода нет,
    // а подстановка сделала бы междоме́нный запрос похожим на свой.
    expect([...sent.keys()].sort()).toEqual([
      "accept",
      "content-type",
      "origin",
      "sec-fetch-site",
      "x-forwarded-proto",
    ]);
  });

  it("свой origin пересылается так же честно — решение за списком бэкенда", async () => {
    const sent = await headersSentByProxy({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin" });
    expect(sent.get("origin")).toBe("http://localhost:3000");
    expect(sent.get("sec-fetch-site")).toBe("same-origin");
  });

  it("признаков не было — в бэкенд не уходит ни заголовок, ни пустая строка", async () => {
    const sent = await headersSentByProxy({});
    expect(sent.has("origin")).toBe(false);
    expect(sent.has("sec-fetch-site")).toBe(false);
    expect(sent.get("origin")).toBeNull();
    expect(sent.get("sec-fetch-site")).toBeNull();
  });

  it("присланный пустым заголовок не пересылается", async () => {
    const sent = await headersSentByProxy({ origin: "", "sec-fetch-site": "" });
    expect(sent.has("origin")).toBe(false);
    expect(sent.has("sec-fetch-site")).toBe(false);
  });

  it("признаки пересылаются и на GET, где отказа по ним нет", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    await GET(request("/api/auth/me", { headers: { origin: "https://evil.example" } }), context("me"));
    const sent = new Headers((upstream.mock.calls[0][1] as RequestInit).headers);
    expect(sent.get("origin")).toBe("https://evil.example");
  });

  it("отказ чужого сайта доходит до формы целым конвертом §9", async () => {
    // Смысл пересылки именно в этом: бэкенд отказал — посетитель видит текст
    // отказа, а не 502 «сервер недоступен» и не тихий вход.
    upstream.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 403, message: "запрос с чужого сайта", fields: {} } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await POST(
      request("/api/auth/login", {
        method: "POST",
        body: "{}",
        headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      }),
      context("login"),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 403, message: "запрос с чужого сайта", fields: {} },
    });
  });

  it("пересланные признаки не возвращаются посетителю", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    const response = await POST(
      request("/api/auth/login", {
        method: "POST",
        body: "{}",
        headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      }),
      context("login"),
    );
    expect(response.headers.get("origin")).toBeNull();
    expect(response.headers.get("sec-fetch-site")).toBeNull();
  });
});
