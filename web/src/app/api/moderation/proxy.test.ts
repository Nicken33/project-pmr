// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, pickQuery, resolveUpstream } from "./[...action]/route";

/**
 * Прокси кабинета модерации (`/api/moderation/*`) — единственная дверь из браузера
 * в `/api/v1/moderation/*`. Он обязан уметь ровно шесть форм пути и никакой другой:
 * `params` распаковывает `%2F`, поэтому без белого списка прокси стал бы свободным
 * пересылающим адресом того же бэкенда под кукой модератора.
 *
 * Среда — node: ответ сервера Next читает заголовки `set-cookie` и `vary` именно из
 * серверного рантайма, а браузерный Headers часть из них отбрасывает.
 */

type Params = { params: Promise<{ action: string[] }> };

function request(url: string, init?: RequestInit) {
  return new Request(`http://site.local${url}`, init);
}

function context(...action: string[]): Params {
  return { params: Promise.resolve({ action }) };
}

const upstream = vi.fn();

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://backend.local:8080";
  upstream.mockReset();
  vi.stubGlobal("fetch", upstream);
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL;
  vi.unstubAllGlobals();
});

describe("белый список путей", () => {
  it.each(["queue", "journal", "reports"])("список %s уходит на канонический путь", (name) => {
    expect(resolveUpstream([name])).toBe(`/api/v1/moderation/${name}`);
  });

  it("решение по анкете и по жалобе — только с числовым id", () => {
    expect(resolveUpstream(["decision", "application", "42"])).toBe(
      "/api/v1/moderation/applications/42/decision",
    );
    expect(resolveUpstream(["decision", "report", "7"])).toBe(
      "/api/v1/moderation/reports/7/decision",
    );
    expect(resolveUpstream(["decision", "application", "42/extra"])).toBeNull();
    expect(resolveUpstream(["decision", "application", "-1"])).toBeNull();
    expect(resolveUpstream(["decision", "application", "1e9"])).toBeNull();
  });

  it("чужие сегменты и обходы каталогов отклоняются до fetch", () => {
    for (const action of [
      [],
      ["admin"],
      [".."],
      ["..", "..", "users"],
      ["queue", "extra"],
      ["decision", "applications", "1"],
      ["decision", "application", "1", "extra"],
      ["queue", "?"],
      [""]
    ]) {
      expect(resolveUpstream(action)).toBeNull();
    }
  });

  it("отклонённый путь не доходит до бэкенда", async () => {
    const response = await GET(request("/api/moderation/../users"), context("..", "users"));
    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe("разрешённые параметры списка", () => {
  it("page, limit и статус — те, что принимает сервер", () => {
    expect(pickQuery("?page=2&limit=50&status=pending")).toBe("?page=2&limit=50&status=pending");
    expect(pickQuery("?status=open")).toBe("?status=open");
  });

  it("чужие параметры и нечисловые страницы вырезаются", () => {
    expect(pickQuery("?page=1&sort=price&offset=99")).toBe("?page=1");
    expect(pickQuery("?page=-1&limit=1e9&status=hidden;drop")).toBe("");
    expect(pickQuery("")).toBe("");
  });
});

describe("пересылка запроса", () => {
  it("без адреса API кабинет говорит, что серверной очереди нет", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const response = await GET(request("/api/moderation/queue"), context("queue"));
    expect(response.status).toBe(503);
    expect((await response.json()).error.message).toContain("Серверной очереди модерации нет");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("в бэкенд идёт одна кука — сессия модератора", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    await GET(
      request("/api/moderation/queue?page=1", {
        headers: {
          cookie: "next_router_preference=x; talentro_session=secret; _ga=analytics",
          authorization: "Bearer visitor",
        },
      }),
      context("queue"),
    );
    const init = upstream.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("cookie")).toBe("talentro_session=secret");
    expect(headers.get("authorization")).toBeNull();
  });

  it("POST на список не проходит, POST решения — проходит", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    const blocked = await POST(request("/api/moderation/queue", { method: "POST", body: "{}" }), context("queue"));
    expect(blocked.status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();

    await POST(
      request("/api/moderation/decision/application/3", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }),
      context("decision", "application", "3"),
    );
    expect(upstream.mock.calls[0][0]).toBe(
      "http://backend.local:8080/api/v1/moderation/applications/3/decision",
    );
  });

  it("тело решения длиннее серверного лимита не буферизуется", async () => {
    const response = await POST(
      request("/api/moderation/decision/application/3", {
        method: "POST",
        body: "x".repeat((8 << 10) + 1),
      }),
      context("decision", "application", "3"),
    );
    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("редирект бэкенда не сопровождается и не уезжает наружу", async () => {
    upstream.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://elsewhere.local/" } }),
    );
    const response = await GET(request("/api/moderation/queue"), context("queue"));
    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });

  it("ответ бэкенда возвращается как есть, но приватно и с nosniff", async () => {
    upstream.mockResolvedValue(
      new Response('{"items":[],"total":0,"page":1,"limit":20}', {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
    );
    const response = await GET(
      request("/api/moderation/queue?status=pending&page=1"),
      context("queue"),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"total":0');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    // Адрес запроса к бэкенду не должен уезжать посетителю.
    expect([...response.headers.keys()].sort()).toEqual([
      "cache-control",
      "content-type",
      "vary",
      "x-content-type-options",
    ]);
  });

  it("не-json ответ сервера не отдаётся как разметка", async () => {
    upstream.mockResolvedValue(
      new Response("<html>прокси внутрь прокси</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const response = await GET(request("/api/moderation/queue"), context("queue"));
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  it("конверт ошибки 403 доходит до клиента целым", async () => {
    upstream.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 403, message: "нужна роль модератора" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    const response = await GET(request("/api/moderation/queue"), context("queue"));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 403, message: "нужна роль модератора" } });
  });
});

describe("признаки браузера для CSRF-защиты", () => {
  /**
   * Второй рубеж CSRF стоит на бэкенде (`same_site.go`) и смотрит на `Origin` и
   * `Sec-Fetch-Site` на методах, меняющих данные. Решение модератора — ровно такой
   * POST под кукой сессии, и до сервера доходят только те признаки, которые
   * перешлёт этот прокси. Пустая строка вместо отсутствующего заголовка сломала бы
   * серверный путь: бэкенд разбирает пустой `Origin` как «чужой».
   */
  function sentHeaders(): Headers {
    return new Headers((upstream.mock.calls[0][1] as RequestInit).headers);
  }

  it("чужой origin и sec-fetch-site доезжают до решения модератора", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    await POST(
      request("/api/moderation/decision/application/3", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
        headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      }),
      context("decision", "application", "3"),
    );
    expect(sentHeaders().get("origin")).toBe("https://evil.example");
    expect(sentHeaders().get("sec-fetch-site")).toBe("cross-site");
  });

  it("признаков не было — в бэкенд не уходит ни заголовок, ни пустая строка", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    await GET(request("/api/moderation/queue"), context("queue"));
    expect(sentHeaders().has("origin")).toBe(false);
    expect(sentHeaders().has("sec-fetch-site")).toBe(false);
    expect([...sentHeaders().keys()].sort()).toEqual(["accept"]);
  });

  it("присланный пустым заголовок не пересылается", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    await GET(request("/api/moderation/queue", { headers: { origin: "" } }), context("queue"));
    expect(sentHeaders().has("origin")).toBe(false);
  });

  it("пересланные признаки не возвращаются посетителю", async () => {
    upstream.mockResolvedValue(new Response("{}", { status: 200 }));
    const response = await POST(
      request("/api/moderation/decision/application/3", {
        method: "POST",
        body: JSON.stringify({ action: "reject" }),
        headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      }),
      context("decision", "application", "3"),
    );
    expect(response.headers.get("origin")).toBeNull();
    expect(response.headers.get("sec-fetch-site")).toBeNull();
  });
});
