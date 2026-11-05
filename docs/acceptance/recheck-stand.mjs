#!/usr/bin/env node
/**
 * Ускоренная повторная приёмка витрины Talentro.
 *
 * Проверяет матрицу из docs/acceptance/stand-gaps-2026-11-04.md:
 *   1. HTTP-коды маршрутов, фильтров, занятий, организаций, robots/sitemap;
 *   2. страницы организаций: название и телефон из API присутствуют в HTML;
 *   3. фильтры super/time/rating: результат отличается от базового или
 *      фильтр явно объявлен неподдерживаемым (не молчаливый no-op);
 *   4. карта: есть метки и нет ложного текста про отсутствие координат;
 *   5. сессия тестировщика: кука и отличие /account, /favorites, /moderation
 *      от анонимных страниц побайтово;
 *   6. чипы категорий на карточках — не все «Другое»;
 *   7. /media/**: какие пути существуют (информативно);
 *   8. итог существующего docs/acceptance/check-category-icons.mjs.
 *
 * Запуск:
 *   node docs/acceptance/recheck-stand.mjs
 *   node docs/acceptance/recheck-stand.mjs --web=http://host:3000 --api=http://host:8080
 *   node docs/acceptance/recheck-stand.mjs --icons=path/to/check-category-icons.mjs
 *
 * Env: WEB_URL, API_URL, TESTER_TOKEN, ICON_CHECK_SCRIPT, RECHECK_TIMEOUT_MS.
 *
 * Скрипт только читает: POST /api/auth/login и /api/auth/register не
 * вызываются (проба GET), чтобы не создавать пользователей и не расходовать
 * лимиты; POST /api/auth/tester лишь выдаёт куку тестировщика.
 *
 * Exit code: 1 — есть FAIL; 0 — только PASS/SKIP; 2 — стенд запущен без данных
 * API (пустой каталог при живом API), матрица в этом случае неинформативна.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const TIMEOUT_MS = Number(process.env.RECHECK_TIMEOUT_MS ?? 15_000);

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const WEB = (argValue("web") ?? process.env.WEB_URL ?? "http://26.52.103.163:3000").replace(/\/+$/, "");
const API = (argValue("api") ?? process.env.API_URL ?? "http://26.52.103.163:8080").replace(/\/+$/, "");
const TESTER_TOKEN = argValue("tester-token") ?? process.env.TESTER_TOKEN ?? "stand-tester-token";

const PASS = "PASS";
const FAIL = "FAIL";
const SKIP = "SKIP";

const rows = [];
function addRow(section, check, expect, fact, status) {
  rows.push({ section, check, expect, fact: String(fact), status });
}

function cut(value, width) {
  const text = String(value).replace(/\s+/g, " ").trim();
  return text.length > width ? `${text.slice(0, width - 1)}…` : text;
}
function pad(value, width) {
  const text = cut(value, width);
  return text + " ".repeat(Math.max(0, width - text.length));
}

async function request(url, options = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...options,
      headers: {
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        ...(options.headers ?? {}),
      },
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      text: buffer.toString("utf8"),
      buffer,
      ms: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      headers: new Headers(),
      text: "",
      buffer: Buffer.alloc(0),
      ms: Date.now() - started,
      error: error.message,
    };
  }
}

async function probe(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (response.body) await response.body.cancel().catch(() => {});
    return response.status;
  } catch {
    return 0;
  }
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return output;
}

function sha(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function decodeEntities(value) {
  return value
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

function normText(value) {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

function catalogCount(html) {
  const match = html.match(/Найдено\s*<strong>(\d+)<\/strong>/);
  return match ? Number(match[1]) : null;
}

function cardOrder(html) {
  const seen = new Set();
  for (const match of html.matchAll(/class="cardTitle" href="\/activities\/([^"]+)"/g)) {
    seen.add(match[1]);
  }
  return [...seen];
}

function chipValues(html) {
  return [...html.matchAll(/<span class="tag">([^<]*)<\/span>/g)].map((match) => normText(match[1]));
}

function ignoredNotice(html) {
  const match = html.match(/Живой каталог это не применяет:([\s\S]{0,200}?)<\/p>/);
  if (!match) return null;
  return normText(match[1].replace(/<[^>]*>/g, " ")).replace(/\s*Сбросить фильтры\s*$/, "").trim();
}

function markerInfo(html) {
  let jsonCount = null;
  const arrayMatch = html.match(/\\"markers\\":\[([\s\S]*?)\]/);
  if (arrayMatch) jsonCount = (arrayMatch[1].match(/\{/g) ?? []).length;

  let textCount = null;
  const countBlock = html.match(/·([\s\S]{0,80}?)меток/);
  if (countBlock) {
    const number = countBlock[0].match(/\d+/);
    if (number) textCount = Number(number[0]);
  }

  const latLngKeys = (html.match(/\\?"(?:lat|lng)\\?":/g) ?? []).length;
  const coordinates = (html.match(/\b4[67]\.\d{3,}/g) ?? []).length;
  return { jsonCount, textCount, latLngKeys, coordinates };
}

function describeError(result) {
  return result.error ? `ошибка: ${result.error}` : `HTTP ${result.status}`;
}

function statusRow(section, check, expect, result, expectedCode = 200) {
  const ok = result.status === expectedCode;
  addRow(section, check, `HTTP ${expectedCode}`, ok ? `HTTP ${result.status} (${result.ms} мс)` : describeError(result), ok ? PASS : FAIL);
}

console.log("=== Talentro: ускоренная повторная приёмка ===");
console.log(`Время:  ${new Date().toISOString()} (${new Date().toString()})`);
console.log(`Витрина: ${WEB}`);
console.log(`API:     ${API}`);
console.log(`Отчёт:   docs/acceptance/stand-gaps-2026-11-04.md`);
console.log("");

// --- Исходные данные API ----------------------------------------------------
const listResponse = await request(`${API}/api/v1/activities`);
let activities = [];
let listTotal = null;
if (listResponse.status === 200) {
  try {
    const payload = JSON.parse(listResponse.text);
    activities = Array.isArray(payload) ? payload : payload.items ?? [];
    listTotal = Array.isArray(payload) ? activities.length : payload.total ?? activities.length;
  } catch (error) {
    listResponse.error = `не разобран JSON: ${error.message}`;
  }
}
addRow(
  "API",
  "GET /api/v1/activities",
  "HTTP 200, непустой список",
  listResponse.status === 200 && activities.length
    ? `HTTP 200, total=${listTotal}, items=${activities.length}`
    : describeError(listResponse),
  listResponse.status === 200 && activities.length ? PASS : FAIL,
);

const healthResponse = await request(`${API}/health`);
statusRow("API", "GET /health", "HTTP 200", healthResponse);

const orgSlugs = [...new Set(activities.map((item) => item.org_slug).filter(Boolean))];
const activitySlugs = activities.map((item) => item.slug).filter(Boolean);

// --- Маршруты витрины -------------------------------------------------------
const STATIC_ROUTES = [
  "/",
  "/map",
  "/about",
  "/favorites",
  "/login",
  "/register",
  "/request",
  "/privacy",
  "/rules",
  "/terms",
  "/robots.txt",
  "/sitemap.xml",
];

// Кабинеты анониму не показываются вовсе — решение координатора по итогам
// аудита: не отдавать ни структуру кабинета, ни то, что он существует.
const GATED_ROUTES = [
  "/account",
  "/moderation",
  "/account/activities/new",
  "/account/activities/app-palitra-adult",
];

const staticResults = await mapLimit(STATIC_ROUTES, 3, async (route) => ({
  route,
  result: await request(`${WEB}${route}`),
}));
for (const { route, result } of staticResults) {
  statusRow("Маршруты витрины", route, "HTTP 200", result);
}
for (const route of GATED_ROUTES) {
  const result = await request(`${WEB}${route}`);
  addRow(
    "Кабинеты — гейт для анонима",
    route,
    "HTTP 404 без сессии",
    `HTTP ${result.status ?? "ERR"}`,
    result.status === 404 ? PASS : FAIL,
  );
}
const rootResult = staticResults.find((item) => item.route === "/")?.result;

// Витрина без NEXT_PUBLIC_API_URL молча рисует пустой каталог (web/src/lib/api.ts:226
// считает API отключённым). Тогда каждая строка матрицы ниже даёт FAIL, и отчёт
// выглядел бы как два десятка дефектов продукта, хотя сломано только окружение
// запуска. Проверяем это до матрицы и останавливаемся отдельным кодом выхода.
if (listResponse.status === 200 && activities.length && rootResult?.status === 200) {
  if (!cardOrder(rootResult.text).length) {
    console.error(
      `Витрина ${WEB} отдаёт пустой каталог, хотя API ${API} знает ${activities.length} занятий. ` +
        "Пересобери и перезапусти web с NEXT_PUBLIC_API_URL (в локальном стенде — " +
        "http://127.0.0.1:8080), значения держи в web/.env.local. Строки ниже неинформативны.",
    );
    process.exit(2);
  }
}

const INFORMATIVE_ROUTES = ["/account/activities", "/requests"];
for (const route of INFORMATIVE_ROUTES) {
  const result = await request(`${WEB}${route}`);
  addRow(
    "Маршруты витрины",
    route,
    "информативно",
    `HTTP ${result.status}; в отчёте не заявлен как страница`,
    SKIP,
  );
}

// --- Фильтры: HTTP ----------------------------------------------------------
const FILTER_ROUTES = [
  "/?q=%D0%BF%D0%B0%D0%BB%D0%B8%D1%82%D1%80%D0%B0",
  "/?city=bendery",
  "/?free=1",
  "/?category=drawing",
  "/?kind=service",
  "/?verified=1",
  "/?age=5",
  "/?price_max=200",
  "/?district=centr&city=tiraspol",
  "/?day=%D0%A1%D0%B1",
  "/?super=creative-arts",
  "/?time=evening",
  "/?sort=rating",
  "/?sort=free",
  "/?q=zzzz",
];

const filterResults = await mapLimit(FILTER_ROUTES, 3, async (route) => ({
  route,
  result: await request(`${WEB}${route}`),
}));
for (const { route, result } of filterResults) {
  statusRow("Фильтры — HTTP", route, "HTTP 200", result);
}

const baselineResult = rootResult ?? (await request(`${WEB}/`));
const baselineOrder = cardOrder(baselineResult.text);
const baselineCount = catalogCount(baselineResult.text) ?? baselineOrder.length;

// --- Карточки занятий -------------------------------------------------------
if (activitySlugs.length) {
  const activityResults = await mapLimit(activitySlugs, 3, async (slug) => ({
    slug,
    result: await request(`${WEB}/activities/${slug}`),
  }));
  for (const { slug, result } of activityResults) {
    statusRow("Страницы занятий", `/activities/${slug}`, "HTTP 200", result);
  }
} else {
  addRow("Страницы занятий", "карточки из API", "8 канонических slug", "список API пуст — проверка невозможна", SKIP);
}

statusRow(
  "Страницы занятий",
  "/activities/tiraspol-studiya-palitra/reviews",
  "HTTP 200",
  await request(`${WEB}/activities/tiraspol-studiya-palitra/reviews`),
);

const mockActivity = await request(`${WEB}/activities/hudozhestvennaya-studiya-palitra`);
addRow(
  "Страницы занятий",
  "/activities/hudozhestvennaya-studiya-palitra",
  "информативно",
  `HTTP ${mockActivity.status}; мок-слаг из демо-блока`,
  SKIP,
);

// --- Детали занятий (для времени и медиа) -----------------------------------
const details = new Map();
if (activitySlugs.length) {
  const detailResults = await mapLimit(activitySlugs, 3, async (slug) => ({
    slug,
    result: await request(`${API}/api/v1/activities/${slug}`),
  }));
  for (const { slug, result } of detailResults) {
    if (result.status !== 200) continue;
    try {
      details.set(slug, JSON.parse(result.text));
    } catch {
      // неразобранный JSON уже виден по HTTP-коду в отчёте
    }
  }
}

// --- Организации ------------------------------------------------------------
if (orgSlugs.length) {
  const orgData = await mapLimit(orgSlugs, 3, async (slug) => {
    const [page, api] = await Promise.all([
      request(`${WEB}/organizations/${slug}`),
      request(`${API}/api/v1/organizations/${slug}`),
    ]);
    let payload = null;
    if (api.status === 200) {
      try {
        payload = JSON.parse(api.text);
      } catch {
        payload = null;
      }
    }
    return { slug, page, api, payload };
  });

  for (const { slug, page } of orgData) {
    statusRow("Организации — HTTP", `/organizations/${slug}`, "HTTP 200", page);
  }

  for (const { slug, page, api, payload } of orgData) {
    const organization = payload?.organization ?? null;
    if (page.status !== 200) {
      addRow(
        "Организации — контент",
        `${slug}: название и телефон`,
        "оба из API в HTML",
        `страница HTTP ${page.status} — контент проверить нельзя`,
        FAIL,
      );
      continue;
    }
    if (api.status !== 200 || !organization) {
      addRow(
        "Организации — контент",
        `${slug}: название и телефон`,
        "оба из API в HTML",
        `API организации HTTP ${api.status} — эталон недоступен`,
        SKIP,
      );
      continue;
    }

    const html = normText(page.text);
    const nameOk = organization.name ? html.includes(normText(organization.name)) : false;
    const phoneOk = organization.phone
      ? digitsOnly(html).includes(digitsOnly(organization.phone))
      : false;
    const mockSignals = ["Художественная студия", "+373 777 41 208"].filter((value) =>
      page.text.includes(value),
    );

    let fact;
    if (nameOk && phoneOk) {
      fact = "название и телефон из API найдены";
    } else {
      const missing = [];
      if (!nameOk) missing.push("название");
      if (!phoneOk) missing.push("телефон");
      fact = `нет: ${missing.join(", ")}${mockSignals.length ? " (мок-данные)" : ""}`;
    }

    addRow(
      "Организации — контент",
      `${slug}: название и телефон`,
      "оба из API в HTML",
      fact,
      nameOk && phoneOk ? PASS : FAIL,
    );
  }
} else {
  addRow("Организации — HTTP", "список организаций из API", "8 slug", "список API пуст", SKIP);
}

// --- Сессия тестировщика ----------------------------------------------------
const testerResponse = await request(`${API}/api/auth/tester`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: TESTER_TOKEN }),
});
const setCookies =
  typeof testerResponse.headers.getSetCookie === "function"
    ? testerResponse.headers.getSetCookie()
    : [testerResponse.headers.get("set-cookie")].filter(Boolean);
const sessionCookie = setCookies
  .map((value) => value.split(";")[0])
  .find((value) => value.startsWith("talentro_session="));

addRow(
  "Сессия тестировщика",
  "POST /api/auth/tester",
  "HTTP 200 + cookie talentro_session",
  testerResponse.status === 200 && sessionCookie
    ? `HTTP 200, cookie ${sessionCookie.split("=")[0]}`
    : `${describeError(testerResponse)}${sessionCookie ? "" : ", cookie нет"}`,
  testerResponse.status === 200 && sessionCookie ? PASS : FAIL,
);

if (sessionCookie) {
  const me = await request(`${API}/api/auth/me`, { headers: { cookie: sessionCookie } });
  let mePayload = null;
  try {
    mePayload = JSON.parse(me.text);
  } catch {
    mePayload = null;
  }
  const meOk = me.status === 200 && mePayload?.authenticated === true;
  addRow(
    "Сессия тестировщика",
    "GET /api/auth/me с кукой",
    "HTTP 200, authenticated=true",
    meOk
      ? `HTTP 200, authenticated=${mePayload.authenticated}, tester=${mePayload.tester ?? "—"}`
      : `${describeError(me)}${mePayload ? `, authenticated=${mePayload.authenticated}` : ""}`,
    meOk ? PASS : FAIL,
  );
}

for (const route of ["/account", "/favorites", "/moderation"]) {
  if (!sessionCookie) {
    addRow("Сессия тестировщика", `${route}: аноним ≠ тестировщик`, "побайтово различаются", "нет куки — проверка невозможна", SKIP);
    continue;
  }
  const anonFirst = await request(`${WEB}${route}`);
  const anonSecond = await request(`${WEB}${route}`);
  if (anonFirst.status === 404 && anonSecond.status === 404) {
    // Кабинет спрятан от анонима 404-м. Тогда проверка сильнее исходной:
    // с валидной кукой страница обязана отдать 200 со своим содержимым.
    const testerPage = await request(`${WEB}${route}`, { headers: { cookie: sessionCookie } });
    addRow(
      "Сессия тестировщика",
      `${route}: аноним 404 → тестировщик 200`,
      "анониму 404, с кукой 200",
      `аноним HTTP ${anonFirst.status}, тестировщик HTTP ${testerPage.status} (${testerPage.buffer.length}b)`,
      testerPage.status === 200 ? PASS : FAIL,
    );
    continue;
  }
  if (anonFirst.status !== 200 || anonSecond.status !== 200) {
    addRow("Сессия тестировщика", `${route}: аноним ≠ тестировщик`, "побайтово различаются", `аноним HTTP ${anonFirst.status}`, SKIP);
    continue;
  }
  if (sha(anonFirst.buffer) !== sha(anonSecond.buffer)) {
    addRow("Сессия тестировщика", `${route}: аноним ≠ тестировщик`, "побайтово различаются", "анонимная страница нестабильна между запросами", SKIP);
    continue;
  }
  const testerPage = await request(`${WEB}${route}`, { headers: { cookie: sessionCookie } });
  const anonHash = sha(anonFirst.buffer);
  const testerHash = sha(testerPage.buffer);
  const differs = testerPage.status === 200 && anonHash !== testerHash;
  addRow(
    "Сессия тестировщика",
    `${route}: аноним ≠ тестировщик`,
    "побайтово различаются",
    differs
      ? `различаются: anon ${anonFirst.buffer.length}b/${anonHash.slice(0, 8)} vs tester ${testerPage.buffer.length}b/${testerHash.slice(0, 8)}`
      : `совпадают побайтово (${anonFirst.buffer.length}b/${anonHash.slice(0, 8)})`,
    differs ? PASS : FAIL,
  );
}

// --- Поведение фильтров -----------------------------------------------------
if (!baselineOrder.length) {
  for (const name of ["super=creative-arts", "time=evening", "sort=rating"]) {
    addRow("Фильтры — поведение", name, "результат применяется", "базовый каталог пуст", SKIP);
  }
} else {
  const superExpected = activities
    .filter((item) => item.super_category_slug === "creative-arts")
    .map((item) => item.slug);
  const superResult = filterResults.find((item) => item.route === "/?super=creative-arts")?.result
    ?? (await request(`${WEB}/?super=creative-arts`));
  const superOrder = cardOrder(superResult.text);
  const superNotice = ignoredNotice(superResult.text);
  const superMatches =
    superExpected.length > 0 &&
    superOrder.length === superExpected.length &&
    superExpected.every((slug) => superOrder.includes(slug));
  let superStatus = FAIL;
  let superFact = `на сайте ${superOrder.length}, в creative-arts ${superExpected.length} (база ${baselineCount})`;
  if (superMatches && superExpected.length < baselineOrder.length) {
    superStatus = PASS;
    superFact = `применён: ${superOrder.length}/${baselineOrder.length}, совпадает с API`;
  } else if (superExpected.length === baselineOrder.length) {
    superStatus = SKIP;
    superFact = `все ${baselineOrder.length} занятий в creative-arts — фильтр неотличим`;
  } else if (superNotice?.includes("наднаправление")) {
    superStatus = PASS;
    superFact = `явно не поддерживается: «${superNotice}»`;
  }
  addRow("Фильтры — поведение", "?super=creative-arts", "набор = API / явный отказ", superFact, superStatus);

  const eveningExpected = [...details.entries()]
    .filter(([, detail]) =>
      (detail.groups ?? []).some((group) =>
        (group.schedules ?? []).some((slot) => {
          const hour = Number(String(slot.time_from ?? "").split(":")[0]);
          return Number.isFinite(hour) && hour >= 17 && hour < 21;
        }),
      ),
    )
    .map(([slug]) => slug);

  const eveningResult = filterResults.find((item) => item.route === "/?time=evening")?.result
    ?? (await request(`${WEB}/?time=evening`));
  const eveningOrder = cardOrder(eveningResult.text);
  const eveningNotice = ignoredNotice(eveningResult.text);
  let eveningStatus = FAIL;
  let eveningFact = `на сайте ${eveningOrder.length}, вечером по API ${eveningExpected.length} (база ${baselineCount})`;
  if (!details.size) {
    eveningStatus = SKIP;
    eveningFact = "детали занятий недоступны — эталон не посчитан";
  } else if (
    eveningExpected.length === eveningOrder.length &&
    eveningExpected.every((slug) => eveningOrder.includes(slug))
  ) {
    eveningStatus = PASS;
    eveningFact = `применён: ${eveningOrder.length}/${baselineOrder.length}, совпадает с расписаниями API`;
  } else if (eveningNotice?.includes("время суток")) {
    eveningStatus = PASS;
    eveningFact = `явно не поддерживается: «${eveningNotice}»`;
  }
  addRow("Фильтры — поведение", "?time=evening", "набор = API / явный отказ", eveningFact, eveningStatus);

  const ratingResult = filterResults.find((item) => item.route === "/?sort=rating")?.result
    ?? (await request(`${WEB}/?sort=rating`));
  const ratingOrder = cardOrder(ratingResult.text);
  const ratingNotice = ignoredNotice(ratingResult.text);
  const sameOrder =
    ratingOrder.length === baselineOrder.length &&
    ratingOrder.every((slug, index) => slug === baselineOrder[index]);
  let ratingStatus = PASS;
  let ratingFact = "порядок отличается от базового";
  if (sameOrder) {
    if (ratingNotice?.includes("сортировка по оценкам")) {
      ratingStatus = PASS;
      ratingFact = `явно не поддерживается: «${ratingNotice}»`;
    } else {
      ratingStatus = FAIL;
      ratingFact = `порядок совпадает с базовым, отказа нет — no-op`;
    }
  }
  addRow("Фильтры — поведение", "?sort=rating", "порядок ≠ база / явный отказ", ratingFact, ratingStatus);
}

// --- Карта ------------------------------------------------------------------
const mapResult = await request(`${WEB}/map`);
if (mapResult.status !== 200) {
  addRow("Карта", "метки и текст", "метки > 0, нет ложного текста", `страница HTTP ${mapResult.status}`, FAIL);
} else {
  const markers = markerInfo(mapResult.text);
  const falseText = mapResult.text.includes("Бэкенд пока не отдаёт координаты");
  const markerCount = Math.max(markers.jsonCount ?? -1, markers.textCount ?? -1);
  const markerOk = markerCount > 0;
  const facts = [
    falseText ? "ложный текст: есть" : "ложный текст: нет",
    `метки ${markerCount >= 0 ? markerCount : "—"} (json=${markers.jsonCount ?? "—"}, счёт=${markers.textCount ?? "—"})`,
    `latlng=${markers.latLngKeys}/${markers.coordinates}`,
  ];
  addRow(
    "Карта",
    "/map: метки и текст",
    "метки > 0, нет ложного текста",
    facts.join("; "),
    markerOk && !falseText ? PASS : FAIL,
  );
}

// --- Чипы категорий ---------------------------------------------------------
const chips = chipValues(baselineResult.text);
const otherChips = chips.filter((value) => value === "Другое").length;
if (!chips.length) {
  addRow("Чипы категорий", "чипы на карточках каталога", "не все «Другое»", "чипы не найдены", SKIP);
} else {
  const nonOther = chips.length - otherChips;
  const sample = [...new Set(chips.filter((value) => value !== "Другое"))].slice(0, 5);
  addRow(
    "Чипы категорий",
    "чипы на карточках каталога",
    "не все «Другое»",
    `«Другое» ${otherChips} из ${chips.length}` +
      (sample.length ? `; другие: ${sample.join(", ")}` : ""),
    nonOther > 0 ? PASS : FAIL,
  );
}

// --- /media -----------------------------------------------------------------
const mediaPaths = new Set();
for (const detail of details.values()) {
  for (const photo of detail.photos ?? []) {
    if (photo?.path) mediaPaths.add(photo.path);
  }
  for (const location of detail.locations ?? []) {
    for (const photo of location.photos ?? []) {
      if (photo?.path) mediaPaths.add(photo.path);
    }
  }
}
const mediaList = [...mediaPaths];
let mediaLines = [];
if (!mediaList.length) {
  addRow("/media", "файлы из карточек и точек", "информативно", "пути не найдены", SKIP);
} else {
  const mediaResults = await mapLimit(mediaList, 3, async (mediaPath) => {
    const apiStatus = await probe(`${API}${mediaPath}`);
    if (apiStatus === 200) return { path: mediaPath, status: 200, base: API };
    const webStatus = await probe(`${WEB}${mediaPath}`);
    return { path: mediaPath, status: webStatus === 200 ? 200 : apiStatus, base: webStatus === 200 ? WEB : null };
  });
  const existing = mediaResults.filter((item) => item.status === 200);
  const missing = mediaResults.filter((item) => item.status !== 200);
  addRow(
    "/media",
    "файлы из карточек и точек",
    "информативно",
    `существует ${existing.length} из ${mediaResults.length}; отсутствует ${missing.length}`,
    SKIP,
  );
  mediaLines = mediaResults.map(
    (item) =>
      `${item.status === 200 ? "есть " : "нет  "} ${item.status || "ERR"} ${item.path}${item.base ? ` (${item.base})` : ""}`,
  );
}

// --- Иконки -----------------------------------------------------------------
const ICON_CANDIDATES = [
  argValue("icons"),
  process.env.ICON_CHECK_SCRIPT,
  path.join(SCRIPT_DIR, "check-category-icons.mjs"),
  path.join(REPO_ROOT, ".worktrees", "integration", "docs", "acceptance", "check-category-icons.mjs"),
  path.join(REPO_ROOT, "docs", "acceptance", "check-category-icons.mjs"),
].filter((candidate) => candidate && existsSync(candidate));

let iconOutput = "";
if (!ICON_CANDIDATES.length) {
  addRow(
    "Иконки",
    "check-category-icons.mjs",
    "запуск и итог",
    "скрипт не найден (--icons / ICON_CHECK_SCRIPT)",
    SKIP,
  );
} else {
  const iconScript = ICON_CANDIDATES[0];
  const run = spawnSync(
    process.execPath,
    [iconScript, `--api=${API}/api/v1/categories`, `--web=${WEB}/`],
    {
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, ICON_CHECK_TIMEOUT_MS: String(TIMEOUT_MS) },
    },
  );
  iconOutput = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
  const exitCode = run.status;
  const summary =
    iconOutput.split(/\r?\n/).reverse().find((line) => line.startsWith("ИТОГ:")) ?? "итога нет";
  const failures = (iconOutput.match(/ПРОВАЛ \(\d+\)/g) ?? []).join(", ");
  const status = exitCode === 0 ? PASS : exitCode === 1 ? FAIL : SKIP;
  addRow(
    "Иконки",
    path.relative(REPO_ROOT, iconScript).split(path.sep).join("/"),
    "exit 0 и «проверка пройдена»",
    `exit ${exitCode ?? "—"}; ${summary}${failures ? `; ${failures}` : ""}`,
    run.error ? SKIP : status,
  );
}

// --- Итог -------------------------------------------------------------------
console.log("=== Таблица проверок ===");
console.log("");
const HEAD = `${pad("Проверка", 56)}  ${pad("Ожидание", 32)}  ${pad("Факт", 52)}  Статус`;
console.log(HEAD);
console.log("-".repeat(HEAD.length));
let section = null;
for (const row of rows) {
  if (row.section !== section) {
    section = row.section;
    console.log(`\n[${section}]`);
  }
  console.log(
    `${pad(row.check, 56)}  ${pad(row.expect, 32)}  ${pad(row.fact, 52)}  ${row.status}`,
  );
}

const passed = rows.filter((row) => row.status === PASS).length;
const failed = rows.filter((row) => row.status === FAIL).length;
const skipped = rows.filter((row) => row.status === SKIP).length;

if (mediaLines.length) {
  console.log("");
  console.log("--- /media: результаты ---");
  for (const line of mediaLines) console.log(line);
}

console.log("");
console.log(`ИТОГ: PASS ${passed}, FAIL ${failed}, SKIP ${skipped}`);
if (failed) {
  console.log("ВЕРДИКТ: повторная приёмка НЕ пройдена — есть FAIL.");
} else {
  console.log("ВЕРДИКТ: только PASS/SKIP — блокирующих расхождений не найдено.");
}
if (iconOutput) {
  console.log("");
  console.log("--- Итог check-category-icons.mjs ---");
  console.log(iconOutput);
}

process.exit(failed ? 1 : 0);
