import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchCards } from "@/lib/api";
import { cardToActivity, fetchCatalogFromApi, toCardQuery } from "@/lib/api-server";
import { defaultFilters } from "@/lib/filters";

/** Ровно тот JSON, который отдаёт `models.Card` после `rows.Scan` в repository.SearchCards. */
const goCard = {
  id: "17",
  name: "Художественная студия «Палитра»",
  org_id: 0,
  city: "Тирасполь",
  age: { min: 6, max: 12 },
  link: null,
  description: null,
  district: null,
  price: null,
  category: null,
};

const fetchMock = vi.fn();

/** Каждый вызов обязан отдавать новый Response: тело читается один раз. */
function respondWith(body: unknown, status = 200) {
  fetchMock.mockImplementation(async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8080";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe("cardToActivity", () => {
  it("переносит то, что бэкенд действительно отдаёт", () => {
    const activity = cardToActivity(goCard);
    expect(activity.id).toBe("17");
    expect(activity.slug).toBe("17");
    expect(activity.title).toBe(goCard.name);
    expect(activity.description).toBe("");
  });

  it("не выдумывает фото, адреса, группы и цены", () => {
    const activity = cardToActivity(goCard);
    expect(activity.photos).toEqual([]);
    expect(activity.locations).toEqual([]);
    expect(activity.groups).toEqual([]);
  });
});

describe("toCardQuery", () => {
  it("превращает слаг города в имя, которое фильтрует SQL", () => {
    expect(toCardQuery({ ...defaultFilters, city: "tiraspol" }).city_name).toBe("Тирасполь");
  });

  it("не подставляет имя для неизвестного города", () => {
    expect(toCardQuery({ ...defaultFilters, city: "ne-gorod" }).city_name).toBeUndefined();
  });

  it("отдаёт возраст числом и не отдаёт пустой фильтр", () => {
    expect(toCardQuery({ ...defaultFilters, age: "8" }).age).toBe(8);
    expect(toCardQuery(defaultFilters).age).toBeUndefined();
  });
});

describe("fetchCatalogFromApi", () => {
  it("досчитывает поиск локально, потому что в SQL условие закомментировано", async () => {
    respondWith([goCard, { ...goCard, id: "18", name: "Футбол «Чемпион»" }]);
    const result = await fetchCatalogFromApi({ ...defaultFilters, q: "палитра" });
    expect(result.total).toBe(1);
    expect(result.results[0].activity.id).toBe("17");
  });

  it("нормализует ё в обоих направлениях", async () => {
    respondWith([{ ...goCard, name: "Секция «Ёлочка»" }]);
    expect((await fetchCatalogFromApi({ ...defaultFilters, q: "елочка" })).total).toBe(1);
    expect((await fetchCatalogFromApi({ ...defaultFilters, q: "ёлочка" })).total).toBe(1);
  });

  it("возвращает CatalogResult с пустым match, когда групп ещё нет", async () => {
    respondWith([goCard]);
    const { results } = await fetchCatalogFromApi(defaultFilters);
    expect(results[0].match).toEqual({ groupId: "", locationId: "" });
  });
});

describe("fetchCards", () => {
  it("собирает запрос только из непустых параметров", async () => {
    respondWith([]);
    await fetchCards({ city_name: "Бендеры", age: undefined, q: "" });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api/cards");
    expect(url.searchParams.toString()).toBe("city_name=%D0%91%D0%B5%D0%BD%D0%B4%D0%B5%D1%80%D1%8B");
  });

  it("бросает ApiError с кодом ответа", async () => {
    respondWith("внутренняя ошибка сервера", 500);
    await expect(fetchCards()).rejects.toMatchObject({ status: 500, name: "ApiError" });
  });

  it("не превращает недоступный бэкенд в пустой каталог", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchCards()).rejects.toBeInstanceOf(ApiError);
  });
});
