import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applications as fixtureApplications,
  blockings as fixtureBlockings,
  contentReports as fixtureReports,
  moderationJournal as fixtureJournal,
  moderationRejectReasons,
  blockReasons,
} from "@/lib/data";
import type { Application, ContentReport } from "@/lib/types";
import {
  applyDecision,
  applyReportDecision,
  groupJournalByDate,
  isOverdue,
  makeBlocking,
  pendingQueue,
  sortQueue,
  validateBlocking,
  validateDecision,
  validateReportDecision,
} from "@/lib/moderation";

// Зафиксированное «сей»: среда, 4 ноября 2026, 12:00 — чтобы расчёт рабочих дней не зависел
// от того, в какой день реально запускается vitest. 3 ноя — понедельник, 2 ноя — воскресенье.
const NOW = "2026-11-04T12:00:00";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

function mkApp(over: Partial<Application> & { id: string }): Application {
  return {
    slug: `slug-${over.id}`,
    title: over.title ?? over.id,
    kind: "activity",
    categorySlug: "risovanie",
    superSlug: "tvorchestvo",
    organizationSlug: "studiya-palitra",
    status: "pending",
    description: "описание",
    format: "offline",
    photos: [],
    locations: [],
    groups: [],
    updatedAt: NOW,
    createdAt: NOW,
    byOwner: true,
    ...over,
  } as Application;
}

describe("sortQueue — дольше всех ждёт, выше (§3.9.1)", () => {
  it("ставит анкеты с самой ранней submittedAt наверх", () => {
    const queue = sortQueue([
      mkApp({ id: "newer", submittedAt: "2026-11-02T09:00:00+03:00" }),
      mkApp({ id: "oldest", submittedAt: "2026-10-20T09:00:00+03:00" }),
      mkApp({ id: "middle", submittedAt: "2026-10-28T09:00:00+03:00" }),
    ]);
    expect(queue.map((row) => row.id)).toEqual(["oldest", "middle", "newer"]);
  });

  it("относит анкеты без submittedAt в конец очереди", () => {
    const queue = sortQueue([
      mkApp({ id: "no-date" }),
      mkApp({ id: "dated", submittedAt: "2026-10-01T09:00:00+03:00" }),
    ]);
    expect(queue.map((row) => row.id)).toEqual(["dated", "no-date"]);
  });

  it("pendingQueue возвращает только анкеты на проверке, отсортированные", () => {
    const queue = pendingQueue([
      mkApp({ id: "p-old", status: "pending", submittedAt: "2026-10-20T09:00:00+03:00" }),
      mkApp({ id: "p-new", status: "pending", submittedAt: "2026-11-02T09:00:00+03:00" }),
      mkApp({ id: "draft", status: "draft" }),
      mkApp({ id: "pub", status: "published" }),
    ]);
    expect(queue.map((row) => row.id)).toEqual(["p-old", "p-new"]);
  });

  it("не мутирует исходный массив", () => {
    const input = [mkApp({ id: "b", submittedAt: "2026-11-01T09:00:00+03:00" }), mkApp({ id: "a", submittedAt: "2026-10-01T09:00:00+03:00" })];
    const snapshot = input.map((row) => row.id);
    sortQueue(input);
    expect(input.map((row) => row.id)).toEqual(snapshot);
  });

  it("реальная очередь фикстур начинается с самой долго ожидающей", () => {
    const queue = pendingQueue(fixtureApplications);
    expect(queue.length).toBeGreaterThan(0);
    // дольше всех ждёт «Школьный туризм» (26 октября), она должна быть выше новичков
    const hikingIdx = queue.findIndex((row) => row.id === "app-hiking-bendery");
    const repIdx = queue.findIndex((row) => row.id === "app-repetitor-math");
    expect(hikingIdx).toBeLessThan(repIdx);
  });
});

describe("isOverdue — подсветка просрочки (§3.9.5)", () => {
  it("просрочка строго при больше 2 рабочих днях", () => {
    // 2 ноя (пн) 12:00 → к среде 4 ноя 12:00 = 2 рабочих дня: не просрочка
    expect(isOverdue(mkApp({ id: "two", submittedAt: "2026-11-02T12:00:00" }))).toBe(false);
    // 1 ноя (вс) 12:00 → пн, вт, ср = 3 рабочих дня: просрочка
    expect(isOverdue(mkApp({ id: "three", submittedAt: "2026-11-01T12:00:00" }))).toBe(true);
  });

  it("анкета без submittedAt не считается просроченной", () => {
    expect(isOverdue(mkApp({ id: "no-date" }))).toBe(false);
  });
});

describe("validateDecision — публикация без причины, отказ с причиной и текстом (§3.9.3)", () => {
  it("публикация не требует причины", () => {
    expect(validateDecision({ action: "publish" }, moderationRejectReasons).ok).toBe(true);
  });

  it("нельзя отклонить без выбранной причины", () => {
    const result = validateDecision({ action: "reject", comment: "нет телефона" }, moderationRejectReasons);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("причину");
  });

  it("нельзя отклонить без свободного текста", () => {
    const result = validateDecision(
      { action: "reject", reason: moderationRejectReasons[0] },
      moderationRejectReasons,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("текст");
  });

  it("причина вне типового списка не принимается", () => {
    const result = validateDecision(
      { action: "reject", reason: "просто не понравилось", comment: "текст" },
      moderationRejectReasons,
    );
    expect(result.ok).toBe(false);
  });

  it("полный отказ валиден", () => {
    const result = validateDecision(
      { action: "reject", reason: moderationRejectReasons[0], comment: "Уточните адрес" },
      moderationRejectReasons,
    );
    expect(result.ok).toBe(true);
  });
});

describe("applyDecision — одно решение на карточку целиком (§3.9.6)", () => {
  const base = [mkApp({ id: "app-1", title: "Керамика", submittedAt: "2026-11-02T09:00:00+03:00" })];

  it("публикация переводит анкету в published", () => {
    const { applications, entry } = applyDecision(
      base,
      "app-1",
      { action: "publish" },
      moderationRejectReasons,
      { actor: "Модератор Talentro", now: NOW, entryId: "mj-new" },
    );
    expect(applications[0].status).toBe("published");
    expect(applications[0].rejectReason).toBeUndefined();
    expect(entry?.decision).toBe("published");
  });

  it("отклонение переводит в rejected и сохраняет причину с текстом", () => {
    const reason = moderationRejectReasons[0];
    const { applications, entry } = applyDecision(
      base,
      "app-1",
      { action: "reject", reason, comment: "Добавьте телефон мастерской" },
      moderationRejectReasons,
      { actor: "Модератор Talentro", now: NOW, entryId: "mj-rej" },
    );
    expect(applications[0].status).toBe("rejected");
    expect(applications[0].rejectReason).toContain(reason);
    expect(applications[0].rejectReason).toContain("Добавьте телефон мастерской");
    expect(entry?.decision).toBe("rejected");
    expect(entry?.comment).toContain(reason);
  });

  it("невалидное решение ничего не меняет", () => {
    const { applications, entry } = applyDecision(
      base,
      "app-1",
      { action: "reject", reason: undefined, comment: undefined },
      moderationRejectReasons,
      { actor: "Модератор Talentro", now: NOW, entryId: "mj-x" },
    );
    expect(applications[0].status).toBe("pending");
    expect(entry).toBeNull();
  });
});

describe("журнал — только чтение, не меняется от правок (§3.9.4)", () => {
  it("существующие записи неизменяемы и не удаляемы", () => {
    const before = JSON.stringify(fixtureJournal);
    const grouped = groupJournalByDate(fixtureJournal);
    expect(JSON.stringify(fixtureJournal)).toBe(before);
    expect(grouped.length).toBeGreaterThan(0);
  });

  it("группирует по календарному дню, свежие сверху", () => {
    const grouped = groupJournalByDate(fixtureJournal);
    const dates = grouped.map((group) => group.date);
    expect(dates).toEqual([...dates].sort((a, b) => (a < b ? 1 : -1)));
    // каждая группа — один и тот же день
    for (const group of grouped) {
      expect(group.entries.every((entry) => entry.createdAt.slice(0, 10) === group.date)).toBe(true);
    }
  });
});

describe("жалобы — «скрыть с причиной» и «оставить» (§3.9.7)", () => {
  const openReports: ContentReport[] = [
    {
      id: "r-1",
      targetType: "review",
      targetExcerpt: "текст отзыва",
      author: "Игорь П.",
      reason: "Мат и оскорбления",
      activitySlug: "futbolnaya-sekciya-chempion",
      activityTitle: "Футбол",
      createdAt: NOW,
      status: "open",
    },
  ];

  it("скрытие без причины отклоняется", () => {
    expect(validateReportDecision({ action: "hide" }, blockReasons).ok).toBe(false);
    const after = applyReportDecision(openReports, "r-1", { action: "hide" }, blockReasons);
    expect(after[0].status).toBe("open");
  });

  it("скрытие с причиной из §12.15 ставит hidden и пишет причину", () => {
    const reason = blockReasons[0];
    const after = applyReportDecision(openReports, "r-1", { action: "hide", reason }, blockReasons);
    expect(after[0].status).toBe("hidden");
    expect(after[0].hideReason).toBe(reason);
  });

  it("«оставить» переводит в dismissed без причины", () => {
    const after = applyReportDecision(openReports, "r-1", { action: "keep" }, blockReasons);
    expect(after[0].status).toBe("dismissed");
    expect(after[0].hideReason).toBeUndefined();
  });

  it("тексты авторов не редактируются — меняется только статус", () => {
    const after = applyReportDecision(openReports, "r-1", { action: "hide", reason: blockReasons[0] }, blockReasons);
    expect(after[0].targetExcerpt).toBe(openReports[0].targetExcerpt);
  });
});

describe("блокировка участника (§12.15, таблица 15)", () => {
  it("без основания или срока не проходит", () => {
    expect(validateBlocking({ user: "Игорь П.", reason: blockReasons[0] }, blockReasons).ok).toBe(false);
    expect(validateBlocking({ user: "Игорь П.", term: "навсегда" }, blockReasons).ok).toBe(false);
  });

  it("валидная блокировка создаёт запись с автором и датой", () => {
    const blocking = makeBlocking(
      { user: "Игорь П.", reason: blockReasons[0], term: "7 дней", note: "второй случай" },
      { actor: "Модератор Talentro", now: NOW, id: "blk-new" },
    );
    expect(blocking.term).toBe("7 дней");
    expect(blocking.actor).toBe("Модератор Talentro");
    expect(blocking.id).toBe("blk-new");
  });

  it("фикстуры блокировок читаются и не пустуют", () => {
    expect(fixtureBlockings.length).toBeGreaterThan(0);
    expect(fixtureReports.some((report) => report.status === "open")).toBe(true);
  });
});
