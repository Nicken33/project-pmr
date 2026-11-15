// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Shapes } from "lucide-react";
import { describe, expect, it } from "vitest";
import { categories as designCategories, superCategories } from "@/lib/data";
import { iconMap } from "./Icon";

/**
 * Имена иконок приходят из двух источников: канонические короткие значения
 * (`run`, `book`, `paw`) — из `database/init.sql` и живого API, имена мока
 * (`book-open`, `paw-print`) — из `src/lib/data.ts`. Любое имя, которого нет в
 * `iconMap`, рисуется заглушкой `Shapes`, и полоса категорий выглядит как ряд
 * одинаковых квадратов. Тест ловит такие пробелы до сборки.
 */

/** Ищем `database/init.sql`, не полагаясь на cwd: от теста вверх до корня и от cwd. */
function findInitSql(): string {
  const candidates: string[] = [];
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 10; depth += 1) {
    candidates.push(path.join(dir, "database", "init.sql"));
    candidates.push(path.join(dir, "..", "database", "init.sql"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  candidates.push(path.resolve(process.cwd(), "database", "init.sql"));
  candidates.push(path.resolve(process.cwd(), "..", "database", "init.sql"));

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (existsSync(resolved)) return resolved;
  }
  throw new Error(
    `database/init.sql not found; checked:\n${candidates.map((item) => path.resolve(item)).join("\n")}`,
  );
}

/** Все значения колонки `icon` из INSERT в categories (до ON CONFLICT). */
function iconsFromInitSql(): string[] {
  const sql = readFileSync(findInitSql(), "utf8");
  const start = sql.search(/INSERT\s+INTO\s+categories\s*\([^)]*\)\s*VALUES/i);
  expect(start, "INSERT INTO categories (...) VALUES not found in database/init.sql").toBeGreaterThan(
    -1,
  );
  const end = sql.indexOf("ON CONFLICT", start);
  const section = sql.slice(start, end === -1 ? undefined : end);
  return [...section.matchAll(/'(?:both|service)'\s*,\s*'([^']+)'/g)].map((match) => match[1]);
}

const initIcons = iconsFromInitSql();
const designIcons = designCategories.map((category) => category.icon);
const designSuperIcons = superCategories.map((category) => category.icon);

describe("iconMap: database/init.sql", () => {
  it("парсит достаточно строк, чтобы тест не был пустым", () => {
    expect(initIcons.length).toBeGreaterThan(40);
    expect(new Set(initIcons).size).toBeGreaterThan(20);
  });

  it("каждое имя из init.sql есть в карте", () => {
    const missing = [...new Set(initIcons)].filter((name) => !(name in iconMap));
    expect(missing).toEqual([]);
  });

  it("ни одно имя из init.sql не рисуется заглушкой Shapes", () => {
    const fallbacks = [...new Set(initIcons)].filter((name) => iconMap[name] === Shapes);
    expect(fallbacks).toEqual([]);
  });
});

describe("iconMap: моки дизайнера (src/lib/data.ts)", () => {
  it("каждое имя из мока есть в карте", () => {
    const missing = [...new Set(designIcons)].filter((name) => !(name in iconMap));
    expect(missing).toEqual([]);
  });

  it("ни одно имя из мока не рисуется заглушкой Shapes", () => {
    const fallbacks = [...new Set(designIcons)].filter((name) => iconMap[name] === Shapes);
    expect(fallbacks).toEqual([]);
  });

  it("верхний уровень совпадает с планом дизайнера и даёт разные картинки", () => {
    expect([...designSuperIcons].sort()).toEqual(
      [
        "cpu",
        "dumbbell",
        "graduation-cap",
        "layout-grid",
        "mountain",
        "palette",
        "paw-print",
        "users",
        "wrench",
      ].sort(),
    );
    expect(designSuperIcons.every((name) => name in iconMap && iconMap[name] !== Shapes)).toBe(true);
    const distinct = new Set(designSuperIcons.map((name) => iconMap[name]));
    expect(distinct.size).toBe(designSuperIcons.length);
  });
});

describe("iconMap: алиасы канона и мока", () => {
  it.each([
    ["paw", "paw-print"],
    ["dots", "layout-grid"],
    ["book", "book-open"],
    ["chef", "chef-hat"],
    ["hands", "hand-heart"],
    ["fist", "shield"],
    ["water", "waves"],
    ["run", "footprints"],
    ["yoga", "activity"],
    ["gym", "accessibility"],
    ["cube", "box"],
    ["globe", "languages"],
    ["speech", "message-circle"],
    ["logic", "puzzle"],
    ["tool", "toolbox"],
    ["saw", "hammer"],
    ["dance", "person-standing"],
  ])("%s и %s ведут к одному компоненту", (canonical, mock) => {
    expect(iconMap[canonical]).toBeDefined();
    expect(iconMap[canonical]).toBe(iconMap[mock]);
  });

  it("визуально разные имена ведут к разным компонентам", () => {
    const distinctPairs: Array<[string, string]> = [
      ["palette", "dumbbell"],
      ["dumbbell", "cpu"],
      ["cpu", "graduation-cap"],
      ["paw-print", "mountain"],
      ["mountain", "wrench"],
      ["users", "layout-grid"],
      ["basketball", "volleyball"],
      ["water", "run"],
      ["book", "speech"],
    ];
    for (const [left, right] of distinctPairs) {
      expect(iconMap[left], `${left} missing`).toBeDefined();
      expect(iconMap[right], `${right} missing`).toBeDefined();
      expect(iconMap[left], `${left} and ${right} must differ`).not.toBe(iconMap[right]);
    }
  });

  it("старые и новые значения верхнего уровня (миграция backend) резолвятся", () => {
    // backend приводит animals-nature → paw-print, travel-outdoor → mountain,
    // social-activity → users, other → layout-grid; витрина обязана рисовать оба набора.
    const pairs: Array<[string, string]> = [
      ["paw", "paw-print"],
      ["map", "mountain"],
      ["hands", "users"],
      ["dots", "layout-grid"],
    ];
    for (const [legacy, planned] of pairs) {
      expect(iconMap[legacy], `${legacy} missing`).not.toBe(Shapes);
      expect(iconMap[planned], `${planned} missing`).not.toBe(Shapes);
    }
    expect(iconMap.paw).toBe(iconMap["paw-print"]);
    expect(iconMap.dots).toBe(iconMap["layout-grid"]);
    expect(iconMap.map).toBeDefined();
    expect(iconMap.mountain).toBeDefined();
    expect(iconMap.hands).not.toBe(Shapes);
    expect(iconMap.users).not.toBe(Shapes);
  });
});
