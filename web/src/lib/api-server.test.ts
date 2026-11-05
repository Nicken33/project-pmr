import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchActivities } from "@/lib/api";
import type {
  ApiActivity,
  ApiActivityDetail,
  ApiCategory,
  ApiGroup,
  ApiLocation,
  ApiOrganization,
  ApiPlace,
} from "@/lib/api";
import {
  activityToCard,
  detailToActivity,
  fetchCatalogFromApi,
  fetchDictionariesFromApi,
  fetchDistrictsForCity,
  organizationFromDetail,
  toActivityQuery,
  unsupportedFilters,
  type Places,
} from "@/lib/api-server";
import { defaultFilters } from "@/lib/filters";

/**
 * Адаптер канонического `/api/v1` → модель витрины (§7).
 *
 * Проверяем то, за что иначе заплатит посетитель: null не превращается в
 * выдуманный ноль, поля, которого в контракте нет, не берутся «из мока», а в
 * запрос не попадает параметр, на котором бэкенд отвечает 400.
 */

const places: Places = {
  cities: [
    { slug: "tiraspol", title: "Тирасполь", order: 0 },
    { slug: "bendery", title: "Бендеры", order: 0 },
  ],
  districts: [{ slug: "central", citySlug: "tiraspol", title: "Центр" }],
};

/** Плоская строка списка — `models.Card` после `rows.Scan` в `SearchActivities`. */
function apiActivity(over: Partial<ApiActivity> = {}): ApiActivity {
  return {
    id: "17",
    slug: "tiraspol-studiya-palitra",
    name: "Художественная студия «Палитра»",
    kind: "activity",
    org_id: 3,
    city: "Тирасполь",
    age: { min: 6, max: 12 },
    link: null,
    description: null,
    district: "Центр",
    price: 300,
    category: "Рисование",
    org_slug: "studiya-palitra",
    org_name: "Студия «Палитра»",
    org_type: "студия",
    phone: "+373 533 12345",
    address: "ул. 250-летия Тирасполя, 22",
    lat: 46.8439,
    lng: 29.6384,
    location_id: 5,
    location_name: "Кабинет 2",
    group_id: 9,
    group_name: "Младшая группа",
    price_to: null,
    price_period: "month",
    seats: 12,
    category_id: 4,
    category_slug: "risovanie",
    super_category: "Творчество",
    super_category_slug: "tvorchestvo",
    format: "offline",
    lesson_type: "group",
    status: "published",
    verified: false,
    photo: null,
    groups_count: 1,
    locations_count: 1,
    updated_at: "2026-10-01T09:00:00Z",
    ...over,
  };
}

/** Группа, о которой ничего не известно: ни возраста, ни цены, ни названия. */
const emptyGroup: ApiGroup = {
  id: 9,
  name: null,
  age_from: null,
  age_to: null,
  price_from: null,
  price_to: null,
  price_period: null,
  location_id: 5,
  seats: null,
  schedules: [
    { weekday: 1, time_from: "17:00", time_to: "18:30", note: null, seats: null },
    { weekday: 7, time_from: "11:00", time_to: "12:00", note: "Открытый урок", seats: 8 },
    { weekday: 8, time_from: "11:00", time_to: "12:00", note: null, seats: null },
  ],
};

const point: ApiLocation = {
  id: 5,
  name: "Кабинет 2",
  city: "Тирасполь",
  district: "Центр",
  address: "ул. 250-летия Тирасполя, 22",
  lat: null,
  lng: null,
  phone: null,
  contacts_verified_at: null,
  groups_count: 1,
  photos: [],
};

/**
 * `models.Organization` — единственная дата сверки в контракте это
 * `contacts_verified_at`; её отсутствие адаптер не имеет права заполнять.
 */
function apiOrganization(over: Partial<ApiOrganization> = {}): ApiOrganization {
  return {
    id: 3,
    slug: "studiya-palitra",
    name: "Студия «Палитра»",
    type: "студия",
    description: null,
    phone: "+373 533 12345",
    email: null,
    site: null,
    address: null,
    city: null,
    contacts_verified_at: null,
    ...over,
  };
}

function apiDetail(over: Partial<ApiActivityDetail> = {}): ApiActivityDetail {
  return {
    ...apiActivity(),
    organization: apiOrganization(),
    locations: [point],
    groups: [emptyGroup],
    photos: [
      { path: "/media/palitra-1.jpg", caption: null, source_url: null, author: null, order_num: 1 },
      { path: "/media/palitra-2.jpg", caption: null, source_url: null, author: null, order_num: 2 },
    ],
    videos: [],
    ...over,
  };
}

const city: ApiPlace = { id: 1, slug: "tiraspol", name: "Тирасполь" };
const district: ApiPlace = { id: 2, slug: "central", name: "Центр", city_id: 1 };

const categoryTree: ApiCategory[] = [
  {
    id: 1,
    slug: "tvorchestvo",
    name: "Творчество",
    kind: "both",
    icon: "palette",
    order_num: 1,
    children: [
      { id: 4, slug: "risovanie", name: "Рисование", kind: "activity", icon: "brush", order_num: 0 },
      {
        id: 7,
        slug: "remeslo",
        name: "Народное ремесло",
        kind: "челнок",
        icon: "scissors",
        order_num: 2,
      },
    ],
  },
];

const dictionaries = {
  "/api/v1/categories": categoryTree,
  "/api/v1/cities": [city],
  "/api/v1/districts": [district],
};

const fetchMock = vi.fn();

/** Адаптер заодно читает справочники, поэтому отвечаем по пути, а не «первым подряд». */
function route(handlers: Record<string, unknown>) {
  fetchMock.mockImplementation(async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    if (!(url.pathname in handlers)) {
      throw new Error(`Незапланированный запрос: ${url.pathname}${url.search}`);
    }
    return new Response(JSON.stringify(handlers[url.pathname]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

/** Параметры запроса к каталогу — они и есть контракт с бэкендом. */
function catalogParams(): URLSearchParams | undefined {
  const url = fetchMock.mock.calls
    .map((call) => new URL(String(call[0])))
    .find((call) => call.pathname === "/api/v1/activities");
  return url?.searchParams;
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8081";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe("activityToCard", () => {
  it("берёт город и район из ответа, а slug — из справочника", () => {
    const activity = activityToCard(apiActivity(), places);
    expect(activity.id).toBe("17");
    expect(activity.slug).toBe("tiraspol-studiya-palitra");
    expect(activity.organizationTitle).toBe("Студия «Палитра»");
    expect(activity.locations[0]).toMatchObject({
      citySlug: "tiraspol",
      cityTitle: "Тирасполь",
      districtSlug: "central",
      districtTitle: "Центр",
    });
  });

  it("оставляет возраст и цену null, когда бэкенд их не знает", () => {
    const activity = activityToCard(
      apiActivity({ age: { min: null, max: null }, price: null, price_period: null }),
      places,
    );
    expect(activity.groups[0]).toMatchObject({ ageFrom: null, ageTo: null, priceFrom: null });
    expect(activity.groups[0].pricePeriod).toBeUndefined();
  });

  it("не выдумывает фото, отзывы и голоса", () => {
    const activity = activityToCard(apiActivity(), places);
    expect(activity.photos).toEqual([]);
    expect(activity.reviews).toEqual([]);
    expect(activity.votesPlus).toBe(0);
    expect(activity.votesMinus).toBe(0);
  });

  it("не ставит дату проверки непроверенному занятию", () => {
    expect(activityToCard(apiActivity(), places).verifiedAt).toBeUndefined();
    expect(activityToCard(apiActivity(), places).contactsVerified).toBe(false);
  });

  // §11: `verified` — признак того, что `contacts_verified_at` свежее 90 дней, а
  // не timestamp. Дата редактирования под бейдж «проверено» подставляться не
  // вправе: карточка с `updated_at` 4 ноября показывала «Данные проверены 4
  // ноября», хотя сверка была в октябре, и никто не звонил.
  it("признак `verified` не превращает дату правки в дату проверки", () => {
    const activity = activityToCard(apiActivity({ verified: true }), places);
    expect(activity.contactsVerified).toBe(true);
    expect(activity.verifiedAt).toBeUndefined();
    expect(activity.updatedAt).toBe("2026-10-01T09:00:00Z");
  });

  it("дату проверки организации берёт только из `contacts_verified_at`", () => {
    expect(organizationFromDetail(apiDetail())?.verifiedAt).toBeUndefined();
    expect(
      organizationFromDetail(
        apiDetail({ organization: apiOrganization({ contacts_verified_at: "2026-10-06" }) }),
      )?.verifiedAt,
    ).toBe("2026-10-06");
  });

  it("не сочиняет slug для города, которого нет в справочнике", () => {
    const location = activityToCard(apiActivity({ city: "Слободзея", district: null }), places)
      .locations[0];
    expect(location).toMatchObject({ citySlug: "Слободзея", cityTitle: "Слободзея" });
    expect(location.districtSlug).toBeUndefined();
  });
});

describe("detailToActivity", () => {
  it("превращает weekday в день недели, а строку вне диапазона выбрасывает", () => {
    const group = detailToActivity(apiDetail(), places).groups[0];
    expect(group.schedule).toEqual([
      { day: "Пн", start: "17:00", end: "18:30" },
      { day: "Вс", start: "11:00", end: "12:00", note: "Открытый урок", seats: 8 },
    ]);
  });

  it("переводит price_period в период, который читает человек", () => {
    const groups = detailToActivity(
      apiDetail({
        groups: [
          { ...emptyGroup, price_period: "session" },
          { ...emptyGroup, id: 10, price_period: "course" },
          { ...emptyGroup, id: 11, price_period: "неизвестно" },
        ],
      }),
      places,
    ).groups;
    expect(groups.map((group) => group.pricePeriod)).toEqual(["занятие", "курс", undefined]);
  });

  it("хранит null возраста и цены вместо нулей", () => {
    const group = detailToActivity(apiDetail(), places).groups[0];
    expect(group).toMatchObject({ ageFrom: null, ageTo: null, priceFrom: null });
    expect(group.title).toBeUndefined();
    expect(group.seats).toBeUndefined();
  });

  it("фото берутся списком из ответа, порядок остаётся серверным", () => {
    const activity = detailToActivity(apiDetail(), places);
    expect(activity.photos).toEqual(["/media/palitra-1.jpg", "/media/palitra-2.jpg"]);
    expect(activity.locations[0]).toMatchObject({ lat: 0, lng: 0 });
  });

  it("организацию берёт из вложенного объекта", () => {
    expect(detailToActivity(apiDetail(), places).organizationSlug).toBe("studiya-palitra");
  });
});

describe("toActivityQuery", () => {
  it("отдаёт slug города как city, а день — числом 1..7", () => {
    expect(toActivityQuery({ ...defaultFilters, city: "tiraspol", day: "Пн" })).toMatchObject({
      city: "tiraspol",
      day: 1,
    });
    expect(toActivityQuery({ ...defaultFilters, day: "Вс" }).day).toBe(7);
  });

  it("формат становится online=1/0; пустой формат не отправляется", () => {
    expect(toActivityQuery({ ...defaultFilters, format: "online" }).online).toBe(true);
    expect(toActivityQuery({ ...defaultFilters, format: "offline" }).online).toBe(false);
    expect(toActivityQuery(defaultFilters).online).toBeUndefined();
  });

  it("районы уходят одним полем через запятую", () => {
    expect(toActivityQuery({ ...defaultFilters, district: ["central", "yug"] }).district).toBe(
      "central,yug",
    );
  });

  it("сортировки, которой нет у бэкенда, в запросе не появляется", () => {
    expect(toActivityQuery({ ...defaultFilters, sort: "rating" }).sort).toBeUndefined();
    expect(toActivityQuery({ ...defaultFilters, sort: "free" }).sort).toBe("price");
    expect(toActivityQuery({ ...defaultFilters, sort: "verified" }).sort).toBe("verified");
  });

  it("наднаправление уходит тем же category — канон фильтрует по нему", () => {
    expect(toActivityQuery({ ...defaultFilters, superCategory: "creative-arts" }).category).toBe(
      "creative-arts",
    );
    // Конкретная категория важнее направления.
    expect(
      toActivityQuery({ ...defaultFilters, superCategory: "creative-arts", category: "drawing" })
        .category,
    ).toBe("drawing");
  });

  it("радиус имеет смысл только вместе с центром города", () => {
    const near = toActivityQuery({
      ...defaultFilters,
      city: "tiraspol",
      near: true,
      radius: "5000",
    });
    expect(near.near).toBe("46.8403,29.6433");
    expect(near.radius).toBe(5000);
    expect(toActivityQuery({ ...defaultFilters, near: true, radius: "5000" }).near).toBeUndefined();
    expect(
      toActivityQuery({ ...defaultFilters, city: "tiraspol", radius: "5000" }).radius,
    ).toBeUndefined();
  });

  it("окно страницы передаётся как есть: page и limit", () => {
    expect(toActivityQuery(defaultFilters, 3, 100)).toMatchObject({ page: 3, limit: 100 });
  });
});

describe("unsupportedFilters", () => {
  it("считает неподдерживаемым только то, что действительно выбрано", () => {
    expect(unsupportedFilters(defaultFilters)).toEqual([]);
    // Наднаправление канон фильтрует — оно больше не в списке.
    expect(unsupportedFilters({ ...defaultFilters, superCategory: "creative-arts" })).toEqual([]);
    expect(unsupportedFilters({ ...defaultFilters, time: "evening" })).toContain("time");
    expect(unsupportedFilters({ ...defaultFilters, sort: "rating" })).toContain("sort=rating");
  });

  // Порядок по близости канон не считает: `near` сужает выборку, но не сортирует
  // её (`cardOrder` в `repository/catalog.go`). «Сначала ближние» не становится
  // честным от того, что переключатель «рядом» включён.
  it("сортировку по близости не считает поддержанной даже вместе с «рядом»", () => {
    expect(unsupportedFilters({ ...defaultFilters, sort: "near", near: true })).toContain(
      "sort=near",
    );
  });

  it("«сначала новые» не подменяет сортировкой по правке", () => {
    expect(unsupportedFilters({ ...defaultFilters, sort: "new" })).toContain("sort=new");
    expect(toActivityQuery({ ...defaultFilters, sort: "new" }).sort).toBeUndefined();
  });

  it("«рядом» без города не отправляется и показывается как неприменённый фильтр", () => {
    expect(toActivityQuery({ ...defaultFilters, near: true }).near).toBeUndefined();
    expect(unsupportedFilters({ ...defaultFilters, near: true })).toContain("near");
    // С городом, у которого есть центр отсчёта, фильтр настоящий — жаловаться на
    // него нельзя: это был бы второй обман, только в обратную сторону.
    expect(unsupportedFilters({ ...defaultFilters, near: true, city: "tiraspol" })).toEqual([]);
    expect(
      toActivityQuery({ ...defaultFilters, near: true, city: "tiraspol", radius: "3000" }),
    ).toMatchObject({ near: "46.8403,29.6433", radius: 3000 });
  });
});

describe("fetchCatalogFromApi", () => {
  it("берёт группу и точку из строки ответа, а не пересчитывает их на фронте", async () => {
    route({
      ...dictionaries,
      "/api/v1/activities": { items: [apiActivity()], total: 1, page: 1, limit: 20 },
    });
    const result = await fetchCatalogFromApi(defaultFilters);
    expect(result.results[0].match).toEqual({ groupId: "9", locationId: "5" });
    expect(result.total).toBe(1);
    expect(result.pages).toBe(1);
  });

  it("считает страницы от общего числа, а не от длины страницы", async () => {
    route({
      ...dictionaries,
      "/api/v1/activities": { items: [apiActivity()], total: 45, page: 1, limit: 20 },
    });
    expect((await fetchCatalogFromApi(defaultFilters)).pages).toBe(3);
  });

  it("просит только те параметры, которые бэкенд применяет", async () => {
    route({
      ...dictionaries,
      "/api/v1/activities": { items: [], total: 0, page: 1, limit: 100 },
    });
    await fetchCatalogFromApi(
      {
        ...defaultFilters,
        city: "tiraspol",
        day: "Пн",
        format: "offline",
        sort: "rating",
        near: true,
      },
      1,
      100,
    );
    const params = catalogParams();
    expect(params?.get("city")).toBe("tiraspol");
    expect(params?.get("day")).toBe("1");
    expect(params?.get("online")).toBe("0");
    expect(params?.get("near")).toBe("46.8403,29.6433");
    expect(params?.get("limit")).toBe("100");
    expect(params?.has("sort")).toBe(false);
    expect(params?.has("time")).toBe(false);
  });

  it("не подмешивает моки, когда бэкенд молчит: ошибку видит вызывающий", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchCatalogFromApi(defaultFilters)).rejects.toMatchObject({ status: 0 });
  });
});

describe("fetchActivities", () => {
  it("кодит булевы фильтры как 1 и 0: «online=0» и «без online» значат разное", async () => {
    route({ "/api/v1/activities": { items: [], total: 0, page: 1, limit: 20 } });
    await fetchActivities({ free: false, online: false, verified: true });
    const params = catalogParams();
    expect(params?.get("free")).toBe("0");
    expect(params?.get("online")).toBe("0");
    expect(params?.get("verified")).toBe("1");
  });

  it("бросает ApiError с кодом ответа", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":{"code":400,"message":"проверь поля"}}', { status: 400 }),
    );
    await expect(fetchActivities({ sort: "updated" })).rejects.toMatchObject({
      status: 400,
      name: "ApiError",
    });
  });

  // Конверт §9 (`internal/httpx/response.go`) — единственный источник текста
  // ошибки. Голый статус заставлял витрину врать: «Ответ 400 от
  // /api/v1/activities» вместо причины, которую сервер назвал сам.
  it("читает сообщение из конверта ошибки, а не выводит его из статуса", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        '{"error":{"code":400,"message":"проверь поля","fields":{"sort":"rating ещё не считается"}}}',
        { status: 400, headers: { "content-type": "application/json; charset=utf-8" } },
      ),
    );
    await expect(fetchActivities({ q: "футбол" })).rejects.toThrow(
      "проверь поля: sort — rating ещё не считается",
    );
  });

  it("не ломает текст ошибки, если тело ответа не JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    await expect(fetchActivities()).rejects.toThrow("Ответ 502 от /api/v1/activities");
  });

  it("серверную 500 отдаёт человеческим текстом бэкенда, а не кодом статуса", async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":{"code":500,"message":"серверная ошибка, попробуй позже"}}', {
        status: 500,
      }),
    );
    await expect(fetchCatalogFromApi(defaultFilters)).rejects.toThrow(
      "серверная ошибка, попробуй позже",
    );
  });

  it("не превращает недоступный бэкенд в пустой каталог", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchActivities()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("справочники для real-режима", () => {
  it("разворачивает дерево направлений и не выдумывает kind у неизвестного значения", async () => {
    route({
      "/api/v1/categories": categoryTree,
      "/api/v1/cities": [city, { id: 2, slug: "bendery", name: "Бендеры" }],
    });
    const result = await fetchDictionariesFromApi();
    expect(result.superCategories[0]).toMatchObject({
      slug: "tvorchestvo",
      title: "Творчество",
      shortTitle: "Творчество",
    });
    const drawing = result.categories.find((item) => item.slug === "risovanie");
    expect(drawing).toMatchObject({ kind: "activity", superSlug: "tvorchestvo" });
    // order_num = 0 → порядок из ответа (1-based), а не ноль.
    expect(drawing?.order).toBe(1);
    // «челнок» — не activity/service/both: остаётся both, а не выдуманный тип.
    expect(result.categories.find((item) => item.slug === "remeslo")?.kind).toBe("both");
    expect(result.cities.map((item) => item.slug)).toEqual(["tiraspol", "bendery"]);
  });

  it("районы привязываются к тому городу, ради которого их просили", async () => {
    route({ "/api/v1/districts": [district] });
    expect(await fetchDistrictsForCity("tiraspol")).toEqual([
      { slug: "central", citySlug: "tiraspol", title: "Центр" },
    ]);
  });
});
