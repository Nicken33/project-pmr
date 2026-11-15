import { describe, expect, it } from "vitest";
import { activities, categories } from "@/lib/data";
import {
  activeFilterCount,
  catalogMarkers,
  categoriesForSuper,
  countBySuper,
  defaultFilters,
  filterCatalog,
  filtersToParams,
  formatAge,
  formatPrice,
  formatSchedule,
  getActivityBySlug,
  getCategory,
  getCity,
  getDistrictsForCity,
  getDistrict,
  parseFilters,
} from "@/lib/filters";
import type { Activity, AgeGroup, FilterState } from "@/lib/types";

const PALITRA_SLUG = "hudozhestvennaya-studiya-palitra";
const TIRASPOL = "tiraspol";
const CENTR = "centr";

function palitra(): Activity {
  const activity = activities.find((a) => a.slug === PALITRA_SLUG);
  expect(activity).toBeDefined();
  return activity as Activity;
}

describe("fixtures", () => {
  it("act-palitra exists with a group and a tiraspol/centr location", () => {
    const p = palitra();
    expect(p.categorySlug).toBe("risovanie");
    expect(p.superSlug).toBe("tvorchestvo");
    expect(p.groups.length).toBeGreaterThan(0);
    expect(
      p.locations.some(
        (l) => l.citySlug === TIRASPOL && l.districtSlug === CENTR,
      ),
    ).toBe(true);
  });

  it("resolver helpers return known records", () => {
    expect(getCity(TIRASPOL)?.slug).toBe(TIRASPOL);
    expect(getDistrict(CENTR)?.slug).toBe(CENTR);
    expect(getDistrictsForCity(TIRASPOL).map((d) => d.slug)).toContain(CENTR);
    expect(getActivityBySlug(PALITRA_SLUG)?.id).toBe("act-palitra");
    expect(getCategory("risovanie")?.superSlug).toBe("tvorchestvo");
  });
});

describe("parseFilters", () => {
  it("returns defaultFilters for empty params", () => {
    expect(parseFilters({})).toEqual(defaultFilters);
  });

  it("parses scalar, boolean and comma-separated array params", () => {
    const result = parseFilters({
      q: "Рисование",
      city: TIRASPOL,
      category: "risovanie",
      district: "centr, balka",
      age: "6",
      price_max: "2000",
      free: "1",
      sort: "rating",
      view: "list",
      near: "1",
      radius: "5000",
      kind: "activity",
      format: "offline",
      verified: "1",
      day: "РЎР±",
      time: "morning",
    } as Record<string, string | string[] | undefined>);

    expect(result.q).toBe("Рисование");
    expect(result.city).toBe(TIRASPOL);
    expect(result.category).toBe("risovanie");
    expect(result.district).toEqual(["centr", "balka"]);
    expect(result.age).toBe("6");
    expect(result.priceMax).toBe("2000");
    expect(result.free).toBe(true);
    expect(result.sort).toBe("rating");
    expect(result.view).toBe("list");
    expect(result.near).toBe(true);
    expect(result.radius).toBe("5000");
    expect(result.kind).toBe("activity");
    expect(result.format).toBe("offline");
    expect(result.verified).toBe(true);
    expect(result.day).toBe("РЎР±");
    expect(result.time).toBe("morning");
  });

  it("parses district passed as an array", () => {
    const result = parseFilters({
      district: ["centr", "balka"],
    } as Record<string, string | string[] | undefined>);
    expect(result.district).toEqual(["centr", "balka"]);
  });

  it("falls back to relevance for an unknown sort", () => {
    expect(
      parseFilters({ sort: "bogus" } as Record<
        string,
        string | string[] | undefined
      >).sort,
    ).toBe("relevance");
  });
});
describe("filtersToParams", () => {
  it("omits empty/default values", () => {
    expect(filtersToParams(defaultFilters).toString()).toBe("");
    expect(filtersToParams(defaultFilters).get("q")).toBeNull();
    expect(filtersToParams(defaultFilters).get("city")).toBeNull();
  });

  it("serializes active filters and keeps defaults out", () => {
    const filters: FilterState = {
      ...defaultFilters,
      q: "Рисование",
      city: TIRASPOL,
      district: [CENTR],
      free: true,
      near: true,
    };
    const params = filtersToParams(filters);
    expect(params.get("q")).toBe("Рисование");
    expect(params.get("city")).toBe(TIRASPOL);
    expect(params.get("district")).toBe(CENTR);
    expect(params.get("free")).toBe("1");
    expect(params.get("near")).toBe("1");
    expect(params.get("radius")).toBe("3000");
    // default sort/view must not be emitted
    expect(params.get("sort")).toBeNull();
    expect(params.get("view")).toBeNull();
  });
});

describe("activeFilterCount", () => {
  it("returns 0 for default filters", () => {
    expect(activeFilterCount(defaultFilters)).toBe(0);
  });

  it("counts independent active filters", () => {
    expect(
      activeFilterCount({ ...defaultFilters, q: "x", city: TIRASPOL }),
    ).toBe(2);
    expect(
      activeFilterCount({ ...defaultFilters, category: "risovanie" }),
    ).toBe(1);
    expect(
      activeFilterCount({ ...defaultFilters, superCategory: "tvorchestvo" }),
    ).toBe(1);
    // category and superCategory are mutually exclusive in the count
    expect(
      activeFilterCount({
        ...defaultFilters,
        category: "risovanie",
        superCategory: "tvorchestvo",
      }),
    ).toBe(1);
  });
});

describe("formatPrice", () => {
  it("returns a placeholder when there is no group", () => {
    expect(formatPrice(undefined)).toBe("Цена не указана");
  });

  it("formats a paid group price", () => {
    const group = palitra().groups[0];
    const out = formatPrice(group as AgeGroup);
    expect(out).toContain(String(group.priceFrom));
    expect(out).not.toBe("Р‘РµСЃРїР»Р°С‚РЅРѕ");
  });
});

describe("formatAge", () => {
  it("returns an empty string when there is no group", () => {
    expect(formatAge(undefined)).toBe("");
  });

  it("formats an age range", () => {
    const group = palitra().groups[0] as AgeGroup;
    const out = formatAge(group);
    expect(out).toContain(String(group.ageFrom));
    expect(out).toContain(String(group.ageTo));
    expect(out).toContain("лет");
  });
});

describe("formatSchedule", () => {
  it("returns an empty string when there is no group", () => {
    expect(formatSchedule(undefined)).toBe("");
  });

  it("formats schedule rows", () => {
    const group = palitra().groups[0] as AgeGroup;
    const out = formatSchedule(group);
    expect(out).toContain("10:00");
    expect(out).toContain("11:15");
    expect(out).toContain("Сб");
  });
});

describe("countBySuper", () => {
  it("counts activities per super category", () => {
    const counts = countBySuper();
    expect(counts["tvorchestvo"]).toBeGreaterThan(0);
    expect(counts["tvorchestvo"]).toBe(
      activities.filter((a) => a.superSlug === "tvorchestvo").length,
    );
  });

  it("sums to the source length for a custom source", () => {
    const subset = activities.slice(0, 5);
    const counts = countBySuper(subset);
    expect(
      Object.values(counts).reduce((sum, value) => sum + value, 0),
    ).toBe(5);
  });
});

describe("categoriesForSuper", () => {
  it("returns categories belonging to a super category", () => {
    const found = categoriesForSuper("tvorchestvo");
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((c) => c.superSlug === "tvorchestvo")).toBe(true);
  });

  it("returns all categories for an empty super slug", () => {
    expect(categoriesForSuper("")).toEqual(categories);
  });
});

describe("filterCatalog", () => {
  it("returns results for default filters", () => {
    const results = filterCatalog(defaultFilters);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(activities.length);
  });

  it("filters by city", () => {
    const results = filterCatalog({ ...defaultFilters, city: TIRASPOL });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((r) =>
        r.activity.locations.some((l) => l.citySlug === TIRASPOL),
      ),
    ).toBe(true);
  });

  it("filters by category slug", () => {
    const results = filterCatalog({
      ...defaultFilters,
      category: "risovanie",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((r) => r.activity.categorySlug === "risovanie"),
    ).toBe(true);
  });
});

describe("catalogMarkers", () => {
  it("produces a map marker for act-palitra in tiraspol/centr", () => {
    const markers = catalogMarkers({
      ...defaultFilters,
      city: TIRASPOL,
      district: [CENTR],
    });
    const marker = markers.find(
      (m) =>
        m.activitySlug === PALITRA_SLUG && m.locationId === "loc-palitra-centr",
    );
    expect(marker).toBeDefined();
    expect(marker?.citySlug).toBe(TIRASPOL);
    expect(marker?.districtTitle).toBeDefined();
    expect(marker?.groupTitle).toBeDefined();
    expect(typeof marker?.lat).toBe("number");
    expect(typeof marker?.lng).toBe("number");
  });
});
