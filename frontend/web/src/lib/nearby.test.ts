import { describe, expect, it } from "vitest";
import { NEARBY_SIZE, selectNearby } from "@/lib/nearby";
import { defaultFilters } from "@/lib/filters";
import type { Activity, FilterState } from "@/lib/types";

function card(slug: string, over: Partial<Activity> = {}): Activity {
  return {
    slug,
    title: slug,
    categorySlug: "",
    superSlug: "",
    votesPlus: 0,
    ...over,
  } as Activity;
}

describe("selectNearby", () => {
  it("режет по лимиту и не додумывает недостающие карточки", () => {
    const pool = [card("a"), card("b")];
    expect(selectNearby(pool).map((item) => item.slug)).toEqual(["a", "b"]);
    expect(selectNearby([])).toEqual([]);
  });

  it("канон идёт как есть: берём первые три из выдачи без фильтров", () => {
    const pool = [card("1"), card("2"), card("3"), card("4")];
    expect(selectNearby(pool).map((item) => item.slug)).toEqual(["1", "2", "3"]);
    expect(NEARBY_SIZE).toBe(3);
  });

  it("демо: сначала то же направление, порядок по голосам", () => {
    const scope = { ...defaultFilters, category: "drawing" } as FilterState;
    const pool = [
      card("sport", { categorySlug: "sport", votesPlus: 99 }),
      card("draw-low", { categorySlug: "drawing", votesPlus: 1 }),
      card("draw-high", { categorySlug: "drawing", votesPlus: 5 }),
    ];
    expect(selectNearby(pool, { scope }).map((item) => item.slug)).toEqual([
      "draw-high",
      "draw-low",
    ]);
  });

  it("демо: направление по наднаправлению, а без совпадений — весь пул", () => {
    const bySuper = { ...defaultFilters, superCategory: "creative-arts" } as FilterState;
    const pool = [
      card("art", { superSlug: "creative-arts", votesPlus: 2 }),
      card("sport", { superSlug: "sport-fitness", votesPlus: 50 }),
    ];
    expect(selectNearby(pool, { scope: bySuper }).map((item) => item.slug)).toEqual(["art"]);

    const noMatch = { ...defaultFilters, category: "нет-такого" } as FilterState;
    expect(selectNearby(pool, { scope: noMatch }).map((item) => item.slug)).toEqual([
      "sport",
      "art",
    ]);
  });

  it("демо: релевантных меньше трёх — показываем столько, сколько есть", () => {
    const scope = { ...defaultFilters, category: "drawing" } as FilterState;
    const pool = [card("only", { categorySlug: "drawing" }), card("other", { categorySlug: "sport" })];
    expect(selectNearby(pool, { scope })).toHaveLength(1);
  });
});
