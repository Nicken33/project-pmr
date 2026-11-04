#!/usr/bin/env node
/**
 * Приёмочная проверка иконок категорий Talentro.
 *
 * Что проверяет:
 *   1. GET /api/v1/categories: у каждой категории непустой `icon`;
 *   2. каждое имя иконки из API и из `database/init.sql` есть в `iconMap`
 *      (`web/src/components/ui/Icon.tsx`) и не ведёт к заглушке `Shapes`;
 *   3. верхний уровень совпадает с планом дизайнера (`web/src/lib/data.ts`)
 *      по Lucide-компоненту, а не только по строке: `paw` и `paw-print` — OK,
 *      `map` и `mountain` — расхождение;
 *   4. верхнеуровневые иконки уникальны (дубли второго уровня — предупреждение);
 *   5. SSR-разметка `http://localhost:3000/`: отсутствие `lucide-shapes` и
 *      наличие ожидаемых `lucide-*` классов верхнего уровня. Если стенд
 *      недоступен, проверка HTML пропускается (не провал), но помечается.
 *
 * Запуск (из корня репозитория или откуда угодно):
 *   node docs/acceptance/check-category-icons.mjs
 *   node docs/acceptance/check-category-icons.mjs --api=http://localhost:8080/api/v1/categories --web=http://localhost:3000/
 *
 * Env: CATEGORIES_API_URL, WEB_URL.
 * Зависимостей нет, нужен Node 24 (нативный fetch, AbortSignal.timeout).
 * Exit code: 0 — провалов нет; 1 — есть расхождения; 2 — не удалось
 * прочитать локальные файлы (Icon.tsx / init.sql) и проверка невозможна.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ICON_TSX = path.join(ROOT, "web", "src", "components", "ui", "Icon.tsx");
const INIT_SQL = path.join(ROOT, "database", "init.sql");
const TIMEOUT_MS = Number(process.env.ICON_CHECK_TIMEOUT_MS ?? 10_000);

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const API_URL =
  argValue("api") ?? process.env.CATEGORIES_API_URL ?? "http://localhost:8080/api/v1/categories";
const WEB_URL = argValue("web") ?? process.env.WEB_URL ?? "http://localhost:3000/";

/**
 * План дизайнера, верхний уровень (`web/src/lib/data.ts` -> superCategories).
 * `apiSlug` — slug из живого API/БД, `designSlug` — slug мока дизайнера.
 * `component`/`lucide` — что обязано получиться после iconMap.
 */
const DESIGNER_TOP_LEVEL = [
  { apiSlug: "creative-arts", designSlug: "tvorchestvo", icon: "palette", component: "Palette", lucide: "lucide-palette" },
  { apiSlug: "sport-fitness", designSlug: "sport", icon: "dumbbell", component: "Dumbbell", lucide: "lucide-dumbbell" },
  { apiSlug: "tech-games", designSlug: "tech", icon: "cpu", component: "Cpu", lucide: "lucide-cpu" },
  { apiSlug: "learning-kids", designSlug: "education", icon: "graduation-cap", component: "GraduationCap", lucide: "lucide-graduation-cap" },
  { apiSlug: "animals-nature", designSlug: "nature", icon: "paw-print", component: "PawPrint", lucide: "lucide-paw-print" },
  { apiSlug: "travel-outdoor", designSlug: "travel", icon: "mountain", component: "Mountain", lucide: "lucide-mountain" },
  { apiSlug: "practical-skills", designSlug: "practical", icon: "wrench", component: "Wrench", lucide: "lucide-wrench" },
  { apiSlug: "social-activity", designSlug: "social", icon: "users", component: "Users", lucide: "lucide-users" },
  { apiSlug: "other", designSlug: "other", icon: "layout-grid", component: "LayoutGrid", lucide: "lucide-layout-grid" },
];

const failures = [];
const warnings = [];
const notes = [];
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);
const note = (message) => notes.push(message);

async function fetchText(url, { what }) {
  const started = Date.now();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
  });
  const text = await response.text();
  return { response, text, ms: Date.now() - started, what };
}

async function readLocalFiles() {
  try {
    const [iconSource, sqlSource, iconStat, sqlStat] = await Promise.all([
      readFile(ICON_TSX, "utf8"),
      readFile(INIT_SQL, "utf8"),
      stat(ICON_TSX),
      stat(INIT_SQL),
    ]);
    return {
      iconSource,
      sqlSource,
      iconHash: createHash("sha256").update(iconSource).digest("hex"),
      sqlHash: createHash("sha256").update(sqlSource).digest("hex"),
      iconMtime: iconStat.mtime.toISOString(),
      sqlMtime: sqlStat.mtime.toISOString(),
    };
  } catch (error) {
    console.error(`НЕ УДАЛОСЬ прочитать локальные файлы: ${error.message}`);
    console.error(`  ожидались: ${ICON_TSX}`);
    console.error(`             ${INIT_SQL}`);
    process.exit(2);
  }
}

/**
 * `const iconMap: Record<string, LucideIcon> = { key: Component, ... };`
 * Ключ может быть идентификатором, в кавычках (дефисы) или в апострофах.
 */
function parseIconMap(source) {
  const start = source.search(/(?:export\s+)?const\s+iconMap\b/);
  if (start === -1) throw new Error("в Icon.tsx не найден `const iconMap`");
  const open = source.indexOf("{", start);
  const end = source.indexOf("};", open);
  if (open === -1 || end === -1) throw new Error("не удалось выделить тело `iconMap`");
  const body = source.slice(open + 1, end);
  const entries = new Map();
  const pattern =
    /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*))\s*:\s*([A-Za-z_$][\w$]*)\s*,/gm;
  for (const match of body.matchAll(pattern)) {
    const key = match[1] ?? match[2] ?? match[3];
    entries.set(key, match[4]);
  }
  if (entries.size < 20) {
    throw new Error(`в iconMap распознано только ${entries.size} записей — парсер сломан?`);
  }
  return entries;
}

/** Все строки INSERT INTO categories (...) VALUES (...) до ON CONFLICT. */
function parseInitSql(source) {
  const start = source.search(/INSERT\s+INTO\s+categories\s*\([^)]*\)\s*VALUES/i);
  if (start === -1) throw new Error("в database/init.sql не найден INSERT INTO categories");
  const conflict = source.indexOf("ON CONFLICT", start);
  const section = source.slice(start, conflict === -1 ? undefined : conflict);
  const rows = [];
  const pattern =
    /\(\s*(\d+)\s*,\s*(NULL|\d+)\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'(activity|service|both)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*\)/g;
  for (const match of section.matchAll(pattern)) {
    rows.push({
      id: Number(match[1]),
      parentId: match[2] === "NULL" ? null : Number(match[2]),
      name: match[3],
      slug: match[4],
      kind: match[5],
      icon: match[6],
      order: Number(match[7]),
    });
  }
  if (rows.length < 40) {
    throw new Error(`в init.sql распознано только ${rows.length} категорий — парсер сломан?`);
  }
  return rows;
}

function flattenApi(rows) {
  const flat = [];
  const tops = [];
  for (const row of rows) {
    const top = {
      ...row,
      level: 1,
      parentSlug: null,
      children: Array.isArray(row.children) ? row.children : [],
    };
    tops.push(top);
    flat.push(top);
    for (const child of top.children) {
      flat.push({ ...child, level: 2, parentSlug: top.slug });
    }
  }
  return { flat, tops };
}

function groupBy(values, keyFn) {
  const map = new Map();
  for (const value of values) {
    const key = keyFn(value);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }
  return map;
}

function listSlugs(items) {
  return items.map((item) => `${item.slug} («${item.name}», icon=${item.icon || "∅"})`).join(", ");
}

const ts = new Date();
console.log("=== Talentro: приёмка иконок категорий ===");
console.log(`Время:        ${ts.toISOString()} (${ts.toString()})`);
console.log(`Репозиторий:  ${ROOT}`);
console.log(`API:          ${API_URL}`);
console.log(`Стенд:        ${WEB_URL}`);
console.log("");

const local = await readLocalFiles();
let iconMap;
let initRows;
try {
  iconMap = parseIconMap(local.iconSource);
  initRows = parseInitSql(local.sqlSource);
} catch (error) {
  console.error(`НЕ УДАЛОСЬ разобрать исходники: ${error.message}`);
  process.exit(2);
}

console.log("--- Источники истины ---");
console.log(`Icon.tsx:   ${local.iconHash.slice(0, 12)}  mtime=${local.iconMtime}  записей iconMap=${iconMap.size}`);
console.log(`init.sql:   ${local.sqlHash.slice(0, 12)}  mtime=${local.sqlMtime}  категорий=${initRows.length}`);
console.log("");

// --- 1. API -----------------------------------------------------------------
let api = null;
try {
  const { response, text, ms } = await fetchText(API_URL, { what: "API" });
  console.log(`API: HTTP ${response.status} за ${ms} мс, ${text.length} байт`);
  if (!response.ok) {
    fail(`API ${API_URL} ответил HTTP ${response.status}`);
  } else {
    api = JSON.parse(text);
    if (!Array.isArray(api)) fail("API вернул не массив категорий");
  }
} catch (error) {
  fail(`API ${API_URL} недоступен: ${error.message}`);
}

let flattened = [];
if (Array.isArray(api)) {
  const { flat, tops } = flattenApi(api);
  flattened = flat;
  console.log(`API: верхний уровень=${tops.length}, всего строк=${flat.length}`);

  // 1a. Непустой icon у каждой строки API.
  const empty = flat.filter((row) => typeof row.icon !== "string" || row.icon.trim() === "");
  if (empty.length) fail(`пустой/отсутствующий icon у категорий API: ${listSlugs(empty)}`);

  // 1b. API-строки против init.sql (бэкенд собирает дерево и может терять детей).
  const apiSlugs = new Set(flat.map((row) => row.slug));
  const missingFromApi = initRows.filter((row) => !apiSlugs.has(row.slug));
  if (missingFromApi.length) {
    fail(
      `API не отдал ${missingFromApi.length} категорий из init.sql (проверить нельзя): ` +
        missingFromApi.map((row) => row.slug).join(", "),
    );
  }
  const initSlugs = new Set(initRows.map((row) => row.slug));
  const extraInApi = flat.filter((row) => !initSlugs.has(row.slug));
  if (extraInApi.length) warn(`в API есть категории, которых нет в init.sql: ${listSlugs(extraInApi)}`);

  // --- 2. iconMap ------------------------------------------------------------
  for (const plan of DESIGNER_TOP_LEVEL) {
    if (!iconMap.has(plan.icon)) fail(`iconMap: нет канонического имени плана "${plan.icon}"`);
    else if (iconMap.get(plan.icon) === "Shapes") {
      fail(`iconMap: каноническое имя плана "${plan.icon}" ведёт к заглушке Shapes`);
    }
  }

  const apiIcons = [...new Set(flat.map((row) => row.icon).filter(Boolean))];
  const initIcons = [...new Set(initRows.map((row) => row.icon).filter(Boolean))];
  for (const [source, names] of [
    ["API", apiIcons],
    ["init.sql", initIcons],
  ]) {
    const missing = names.filter((name) => !iconMap.has(name));
    if (missing.length) fail(`iconMap: нет имён из ${source}: ${missing.join(", ")}`);
    const fallbacks = names.filter((name) => iconMap.get(name) === "Shapes");
    if (fallbacks.length) fail(`iconMap: имена из ${source} ведут к заглушке Shapes: ${fallbacks.join(", ")}`);
  }

  // 2a. init.sql — источник истины для нового стенда. Если он разошёлся с
  // живой БД, миграция живёт только на сервере и повторится баг.
  const initTopBySlug = new Map(initRows.filter((row) => row.parentId === null).map((row) => [row.slug, row]));
  const initBySlug = new Map(initRows.map((row) => [row.slug, row]));
  const drifted = flat
    .filter((row) => initBySlug.has(row.slug) && initBySlug.get(row.slug).icon !== row.icon)
    .map((row) => `${row.slug}: init.sql=${initBySlug.get(row.slug).icon}, API=${row.icon}`);
  if (drifted.length) {
    warn(
      `живая БД разошлась с database/init.sql (${drifted.length} строк) — ` +
        `на новом стенде из init.sql будет другой набор иконок:\n` +
        drifted.map((line) => `    ${line}`).join("\n"),
    );
  }
  for (const plan of DESIGNER_TOP_LEVEL) {
    const initTop = initTopBySlug.get(plan.apiSlug);
    if (!initTop) {
      warn(`init.sql: нет верхнеуровневой категории ${plan.apiSlug}`);
      continue;
    }
    const initComponent = iconMap.get(initTop.icon) ?? null;
    if (initComponent !== plan.component) {
      warn(
        `init.sql: ${plan.apiSlug} icon="${initTop.icon}" -> ${initComponent ?? "нет в iconMap"}, ` +
          `план "${plan.icon}" -> ${plan.component}; нужна миграция/правка init.sql`,
      );
    }
  }

  // --- 3. Верхний уровень против плана дизайнера -----------------------------
  const topBySlug = new Map(tops.map((row) => [row.slug, row]));
  const unknownTop = tops.filter((row) => !DESIGNER_TOP_LEVEL.some((plan) => plan.apiSlug === row.slug));
  if (unknownTop.length) warn(`внеплановые верхнеуровневые категории API: ${listSlugs(unknownTop)}`);

  const topResolved = [];
  for (const plan of DESIGNER_TOP_LEVEL) {
    const actual = topBySlug.get(plan.apiSlug);
    if (!actual) {
      fail(`верхний уровень: нет категории ${plan.apiSlug} в API (план: ${plan.icon})`);
      continue;
    }
    const component = iconMap.get(actual.icon) ?? null;
    const designerComponent = iconMap.get(plan.icon) ?? null;
    if (designerComponent === null) {
      fail(`iconMap: каноническое имя плана "${plan.icon}" отсутствует (${plan.apiSlug})`);
    } else if (designerComponent === "Shapes") {
      fail(`iconMap: каноническое имя плана "${plan.icon}" ведёт к Shapes (${plan.apiSlug})`);
    }
    if (component === null) {
      fail(`${plan.apiSlug}: icon="${actual.icon}" отсутствует в iconMap`);
    } else if (component !== designerComponent) {
      fail(
        `${plan.apiSlug}: API icon="${actual.icon}" -> ${component}, ` +
          `план "${plan.icon}" -> ${designerComponent} (разные картинки)`,
      );
    }
    topResolved.push({ plan, actual, component, matches: component === designerComponent });
  }

  // 3b. Верхнеуровневые картинки обязаны быть уникальными.
  const resolved = topResolved.filter((row) => row.component);
  for (const [component, group] of groupBy(resolved, (row) => row.component)) {
    if (group.length > 1) {
      fail(
        `верхний уровень: ${component} повторяется у ${group.length} категорий: ` +
          group.map((row) => `${row.actual.slug}(icon=${row.actual.icon})`).join(", "),
      );
    }
  }

  // 3c. Дубли второго уровня — предупреждение (дизайнер тоже повторяет иконки).
  const children = flat.filter((row) => row.level === 2 && row.icon);
  const childDuplicates = [...groupBy(children, (row) => iconMap.get(row.icon) ?? row.icon)]
    .filter(([, group]) => group.length > 1);
  if (childDuplicates.length) {
    warn(
      `второй уровень: ${childDuplicates.length} групп одинаковых картинок:\n` +
        childDuplicates
          .map(
            ([component, group]) =>
              `    ${component}: ${group.map((row) => `${row.slug}(${row.icon})`).join(", ")}`,
          )
          .join("\n"),
    );
  }
}

// --- 4. SSR HTML ------------------------------------------------------------
let htmlClasses = null;
try {
  const { response, text, ms } = await fetchText(WEB_URL, { what: "web" });
  console.log(`HTML: HTTP ${response.status} за ${ms} мс, ${text.length} байт`);
  if (!response.ok) {
    warn(`стенд ${WEB_URL} ответил HTTP ${response.status}; HTML-проверка пропущена`);
  } else {
    const counts = new Map();
    for (const match of text.matchAll(/lucide-[a-z0-9-]+/g)) {
      counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
    }
    htmlClasses = counts;
    console.log(`HTML: уникальных lucide-* классов=${counts.size}`);
    if ((counts.get("lucide-shapes") ?? 0) > 0) {
      fail(`HTML: найден lucide-shapes (${counts.get("lucide-shapes")} шт.) — часть иконок падает в заглушку`);
    }
    for (const plan of DESIGNER_TOP_LEVEL) {
      const count = counts.get(plan.lucide) ?? 0;
      if (count === 0) {
        fail(`HTML: нет ${plan.lucide} (${plan.designSlug}/${plan.apiSlug}, план: ${plan.icon})`);
      }
    }
  }
} catch (error) {
  warn(`стенд ${WEB_URL} недоступен (${error.message}); HTML-проверка пропущена, статическая — выполнена`);
}

// --- 5. Итог ----------------------------------------------------------------
console.log("");
if (htmlClasses) {
  const shown = DESIGNER_TOP_LEVEL.map(
    (plan) => `${plan.lucide}=${htmlClasses.get(plan.lucide) ?? 0}`,
  );
  console.log(`HTML верхний уровень: ${shown.join(", ")}`);
  const travelPlan = DESIGNER_TOP_LEVEL.find((plan) => plan.apiSlug === "travel-outdoor");
  const travelApi = flattened.find((row) => row.slug === "travel-outdoor");
  if (travelApi && iconMap.get(travelApi.icon) === "Map" && htmlClasses.has("lucide-map")) {
    console.log(
      `HTML: lucide-map=${htmlClasses.get("lucide-map")} — это Map для travel-outdoor, а не Mountain из плана (${travelPlan?.icon})`,
    );
  }
}
if (notes.length) {
  console.log("");
  for (const message of notes) console.log(`ПРИМЕЧАНИЕ: ${message}`);
}
if (warnings.length) {
  console.log("");
  for (const message of warnings) console.log(`ПРЕДУПРЕЖДЕНИЕ: ${message}`);
}
if (failures.length) {
  console.log("");
  console.log(`ПРОВАЛ (${failures.length}):`);
  failures.forEach((message, index) => console.log(`  ${index + 1}. ${message}`));
  console.log("");
  console.log("ИТОГ: проверка НЕ пройдена.");
  process.exit(1);
}
console.log("");
console.log("ИТОГ: проверка пройдена.");
process.exit(0);
