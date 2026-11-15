#!/usr/bin/env node
// docs/acceptance/moderation-proxy-check.mjs — проверка кабинета модерации
// поверх витринного прокси, а не напрямую на :8080.
//
// Матрица `moderation-smoke.sh` идёт curl'ом на сам бэкенд и потому не видит
// путь браузера: Next → `/api/moderation/*` → бэкенд. Там три вещи, которые в
// smoke-матрице проверить негде: пересылка куки сессии, белый список сегментов
// прокси и приватность ответа. Этот скрипт закрывает именно их.
//
// Серверы скрипт НЕ поднимает и в базе не меняет: модераторская кука получается
// тем же входом, что и в smoke-прогоне (аккаунт `MOD_EMAIL`), а роль ему даёт
// `docs/acceptance/moderation-smoke.sh`. Без повышенного аккаунта живая очередь
// отвечает 403 — скрипт так и пишет, вместо того чтобы молча проходить.
//
// Запуск (по умолчанию — стенд координатора: витрина :3000, API :8080):
//   node docs/acceptance/moderation-proxy-check.mjs
//   SITE=http://127.0.0.1:3011 BACKEND=http://127.0.0.1:8082 \
//     MOD_EMAIL=coord-mod-check@example.test MOD_PASSWORD='…' \
//     node docs/acceptance/moderation-proxy-check.mjs
//
// Формат вывода — как в smoke-прогонах: OKE совпало, IMEY расхождение, SKIP не
// с чем проверять. Код выхода 0, только если нет IMEY.

const SITE = (process.env.SITE ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const BACKEND = (process.env.BACKEND ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
const EMAIL = process.env.MOD_EMAIL ?? "coord-mod-check@example.test";
const PASSWORD = process.env.MOD_PASSWORD ?? "проверочный-пароль-2026";

let pass = 0;
let fail = 0;
let skip = 0;

const oke = (name, got) => {
  console.log(`OKE\t${name} — ${got}`);
  pass += 1;
};
const imey = (name, want, got) => {
  console.log(`IMEY\t${name} — ждали ${want}, имею ${got}`);
  fail += 1;
};
const skipped = (name, why) => {
  console.log(`SKIP\t${name} — ${why}`);
  skip += 1;
};

/** Кука сессии из ответа входа: ровно одна пара `name=value`, как её читает бэкенд. */
function sessionCookie(response) {
  const list =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  for (const entry of list) {
    const pair = entry.split(";")[0].trim();
    if (pair.startsWith("talentro_session=")) return pair;
  }
  return "";
}

async function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

/** Живой вход модератора: регистрация (если аккаунта нет) и вход на бэкенде. */
async function moderatorCookie() {
  await postJson(`${BACKEND}/api/auth/register`, {
    email: EMAIL,
    password: PASSWORD,
    name: "Проверка прокси",
  }).catch(() => null);
  const login = await postJson(`${BACKEND}/api/auth/login`, {
    email: EMAIL,
    password: PASSWORD,
  }).catch(() => null);
  if (!login) return "";
  return sessionCookie(login);
}

async function get(path, cookie) {
  return fetch(`${SITE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
    cache: "no-store",
  });
}

function headerList(response) {
  const pairs = [];
  response.headers.forEach((value, name) => pairs.push(`${name}: ${value}`));
  return pairs.join(" | ");
}

/**
 * row <подпись> <ждали> <получили>
 */
function row(name, want, got) {
  if (String(got) === String(want)) oke(name, got);
  else imey(name, want, got);
}

const cookie = await moderatorCookie();
if (!cookie) {
  skipped(
    "кука модератора",
    `вход на ${BACKEND} не получен — поднимите бэкенд и витрину, задайте MOD_EMAIL/MOD_PASSWORD`,
  );
}

// 1. Очередь под живой модераторской кукой через прокси витрины.
if (cookie) {
  const response = await get("/api/moderation/queue?page=1&limit=5", cookie).catch(() => null);
  if (!response) {
    imey("очередь через прокси", "ответ витрины", `${SITE} не отвечает`);
  } else {
    const text = await response.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    row("очередь через прокси — код", 200, response.status);
    if (response.status === 403) {
      console.log(
        "\tПодсказка: аккаунт проверки есть, но роли модератора нет — сначала bash docs/acceptance/moderation-smoke.sh (он повышает и отзывает роль).",
      );
    }
    if (payload && typeof payload.total === "number" && Array.isArray(payload.items)) {
      oke("форма списка", `items=${payload.items.length} total=${payload.total}`);
    } else {
      imey("форма списка", "{items,total,page,limit}", text.slice(0, 120));
    }
    const cache = response.headers.get("cache-control") ?? "";
    const vary = response.headers.get("vary") ?? "";
    row("очередь не кэшируется на chung'e", "private, no-store", cache);
    row("ответ привязан к куке", "Cookie", vary);
  }
}

// 2. Журнал и жалобы — те же три списка, тот же путь.
for (const name of ["journal", "reports"]) {
  if (!cookie) {
    skipped(`список ${name}`, "нет куки модератора");
    continue;
  }
  const response = await get(`/api/moderation/${name}?page=1&limit=5`, cookie).catch(() => null);
  row(`список ${name} — код`, 200, response ? response.status : "нет ответа");
}

// 3. Анониму прокси отвечает 401 бэкенда, а не пустой очередью.
{
  const response = await get("/api/moderation/queue?page=1&limit=5", "").catch(() => null);
  row("анониму в очереди", 401, response ? response.status : "нет ответа");
  if (response) {
    const body = await response.text();
    if (body.includes("items")) imey("аноним не получает очередь", "без items", body.slice(0, 80));
    else oke("аноним не получает очередь", "тело без items");
  }
}

// 4. POST решения проходит прокси и упирается в серверную валидацию: отказ без
//    причины — 400 с полем `reason`. Ничего не записывается: сервер проверяет тело
//    до обращения к заявке, поэтому id может быть любой.
if (cookie) {
  const response = await fetch(`${SITE}/api/moderation/decision/application/1`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "reject" }),
    redirect: "manual",
  }).catch(() => null);
  row("отказ без причины через прокси", 400, response ? response.status : "нет ответа");
  if (response) {
    const text = await response.text();
    if (/"reason"/.test(text)) oke("400 указывает поле", "есть fields.reason");
    else imey("400 указывает поле", "fields.reason", text.slice(0, 120));
  }
} else {
  skipped("отказ без причины", "нет куки модератора");
}

// 5. Белый список: обход каталогами и чужое имя не должны доходить до бэкенда.
// `%2e%2e` а не `..`: разбор URL схлопнул бы `..` ещё до отправки, и проверка
// белого списка потеряла бы смысл.
for (const path of ["/api/moderation/%2e%2e/users", "/api/moderation/admin", "/api/moderation/queue/x"]) {
  const response = await get(path, cookie || "").catch(() => null);
  const status = response ? response.status : "нет ответа";
  if (status === 404) oke(`прокси не пересылает ${path}`, 404);
  else imey(`прокси не пересылает ${path}`, 404, status);
}

// 6. Ответ прокси не должен раскрывать адрес бэкенда.
{
  const response = await get("/api/moderation/queue?page=1&limit=1", cookie || "").catch(() => null);
  if (!response) {
    skipped("заголовки прокси", `${SITE} не отвечает`);
  } else {
    const headers = headerList(response);
    if (headers.includes(BACKEND.replace(/^https?:\/\//, ""))) {
      imey("адрес бэкенда не уезжает наружу", "без хоста бэкенда", headers);
    } else {
      oke("адрес бэкенда не уезжает наружу", headers.slice(0, 120));
    }
  }
}

console.log(`\tИтого: OKE ${pass}, IMEY ${fail}, SKIP ${skip}`);
process.exit(fail ? 1 : 0);
