import type {
  Application,
  Blocking,
  ContentReport,
  ModerationEntry,
} from "@/lib/types";
import { MODERATION_SLA_DAYS, workingDaysWaiting } from "@/lib/utils";

/** Решение модератора по карточке целиком (§3.9.3, §3.9.6). */
export type DecisionAction = "publish" | "reject";

export interface DecisionInput {
  action: DecisionAction;
  /** Пункт из moderationRejectReasons — обязателен только для отказа. */
  reason?: string;
  /** Свободный текст владельцу — обязателен только для отказа (§8, таблица 11). */
  comment?: string;
}

export interface DecisionValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Очередь «на проверке»: дольше всех ждёт — выше (§3.9.1).
 * Анкеты без submittedAt считаем неподготовленными и опускаем в конец,
 * чтобы они не затыкали очередь раньше реальных просрочек.
 */
export function sortQueue(applications: Application[]): Application[] {
  return [...applications].sort((a, b) => {
    const ta = a.submittedAt ? Date.parse(a.submittedAt) : Number.POSITIVE_INFINITY;
    const tb = b.submittedAt ? Date.parse(b.submittedAt) : Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title, "ru");
  });
}

/** Только анкеты, реально стоящие в очереди. */
export function pendingQueue(applications: Application[]): Application[] {
  return sortQueue(applications.filter((application) => application.status === "pending"));
}

/** Просрочка ровно при строгом превышении норматива (больше MODERATION_SLA_DAYS рабочих дней, §3.9.5). */
export function isOverdue(application: Application, slaDays: number = MODERATION_SLA_DAYS): boolean {
  return workingDaysWaiting(application.submittedAt) > slaDays;
}

function assembleNote(reason?: string, comment?: string): string | undefined {
  const trimmedComment = comment?.trim();
  if (reason && trimmedComment) return `${reason} ${trimmedComment}`;
  if (reason) return reason;
  if (trimmedComment) return trimmedComment;
  return undefined;
}

/**
 * Валидация решения (§3.9.3 + §8, таблица 11).
 * Публикация комментария не требует; отказ обязан иметь пункт типового списка
 * и свободный текст — иначе владелец не поймёт, что исправлять.
 */
export function validateDecision(
  input: DecisionInput,
  allowedReasons: string[],
): DecisionValidation {
  const errors: string[] = [];
  if (input.action === "reject") {
    if (!input.reason || !allowedReasons.includes(input.reason)) {
      errors.push("Выберите причину из списка типовых.");
    }
    if (!input.comment || !input.comment.trim()) {
      errors.push("Для отказа нужен свободный текст владельцу.");
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Журнал модерации (§8, таблица 11): одна строка на каждое решение, без редактирования. */
export function makeJournalEntry(params: {
  application: Application;
  input: DecisionInput;
  actor: string;
  now: string;
  id: string;
}): ModerationEntry {
  const { application, input, actor, now, id } = params;
  const decision = input.action === "publish" ? "published" : "rejected";
  return {
    id,
    applicationTitle: application.title,
    organizationSlug: application.organizationSlug,
    actor,
    decision,
    comment: decision === "rejected" ? assembleNote(input.reason, input.comment) : undefined,
    createdAt: now,
  };
}

/**
 * Применение решения к списку (§3.9.6). Решение одно на карточку целиком:
 * меняем только статус и причину, группы/точки по отдельности не модерируем.
 * Возвращает новый массив и строку журнала — исходный список не мутируем.
 */
export function applyDecision(
  applications: Application[],
  id: string,
  input: DecisionInput,
  allowedReasons: string[],
  opts: { actor: string; now: string; entryId: string },
): { applications: Application[]; entry: ModerationEntry | null } {
  const validation = validateDecision(input, allowedReasons);
  const target = applications.find((application) => application.id === id);
  if (!validation.ok || !target) return { applications, entry: null };

  const nextStatus: Application["status"] = input.action === "publish" ? "published" : "rejected";
  const applicationsNext = applications.map((application) => {
    if (application.id !== id) return application;
    return {
      ...application,
      status: nextStatus,
      rejectReason:
        nextStatus === "rejected" ? assembleNote(input.reason, input.comment) : undefined,
      verifiedAt: nextStatus === "published" ? opts.now.slice(0, 10) : application.verifiedAt,
      updatedAt: opts.now,
    };
  });

  const entry = makeJournalEntry({
    application: target,
    input,
    actor: opts.actor,
    now: opts.now,
    id: opts.entryId,
  });
  return { applications: applicationsNext, entry };
}

/** Вложенные правки служебных полей (§3.9.6) — не требуют причины, но должны быть видны до публикации. */
export interface LocationPatch {
  citySlug: string;
  districtSlug?: string;
  lat: number;
  lng: number;
}

export function applyLocationEdit(
  applications: Application[],
  applicationId: string,
  locationId: string,
  patch: LocationPatch,
  now: string,
): Application[] {
  return applications.map((application) => {
    if (application.id !== applicationId) return application;
    return {
      ...application,
      updatedAt: now,
      locations: application.locations.map((location) =>
        location.id === locationId
          ? { ...location, citySlug: patch.citySlug, districtSlug: patch.districtSlug, lat: patch.lat, lng: patch.lng }
          : location,
      ),
    };
  });
}

export function applyDirectionEdit(
  applications: Application[],
  applicationId: string,
  categorySlug: string,
  superSlug: string,
  now: string,
): Application[] {
  return applications.map((application) =>
    application.id === applicationId
      ? { ...application, categorySlug, superSlug, updatedAt: now }
      : application,
  );
}

/**
 * Коробка координат Приднестровья с запасом на окраина районов. Вне её точка
 * уезжает в другую страну, а пустое поле (`Number("")` даёт 0) попадает ровно в
 * «0,0» в Гвинейском заливе — поэтому рамки ±90/±180 тут недостаточно.
 */
export const pmrBounds = { latMin: 45.9, latMax: 48.9, lngMin: 27.4, lngMax: 30.6 };

export function validateCoordinates(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat)) return "Широта — число, например 46.8446.";
  if (!Number.isFinite(lng)) return "Долгота — число, например 29.6241.";
  if (lat < pmrBounds.latMin || lat > pmrBounds.latMax) {
    return `Широта вне Приднестровья: допускается ${pmrBounds.latMin}–${pmrBounds.latMax}.`;
  }
  if (lng < pmrBounds.lngMin || lng > pmrBounds.lngMax) {
    return `Долгота вне Приднестровья: допускается ${pmrBounds.lngMin}–${pmrBounds.lngMax}.`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Вторая очередь: жалобы на отзывы, комментарии, медиа и карточки (§3.9.7). */
/* ------------------------------------------------------------------ */

export type ReportAction = "hide" | "keep";

export interface ReportDecisionInput {
  action: ReportAction;
  /** Пункт из blockReasons (§12.15) — обязателен при скрытии. */
  reason?: string;
}

/** «Оставить» не требует причины; «скрыть с причиной» — обязателен пункт списка (§3.9.7). */
export function validateReportDecision(
  input: ReportDecisionInput,
  allowedReasons: string[],
): DecisionValidation {
  const errors: string[] = [];
  if (input.action === "hide" && (!input.reason || !allowedReasons.includes(input.reason))) {
    errors.push("Выберите причину скрытия из списка оснований.");
  }
  return { ok: errors.length === 0, errors };
}

/** Тексты авторов модератор не редактирует — меняется только статус и причина скрытия. */
export function applyReportDecision(
  reports: ContentReport[],
  id: string,
  input: ReportDecisionInput,
  allowedReasons: string[],
): ContentReport[] {
  const validation = validateReportDecision(input, allowedReasons);
  if (!validation.ok) return reports;
  return reports.map((report) => {
    if (report.id !== id) return report;
    if (input.action === "hide") {
      return { ...report, status: "hidden", hideReason: input.reason };
    }
    return { ...report, status: "dismissed", hideReason: undefined };
  });
}

export interface BlockingInput {
  user: string;
  reason?: string;
  note?: string;
  term?: Blocking["term"];
}

/** Блокировка участника (§12.15, §8, таблица 15): обязателен пункт основания и срок. */
export function validateBlocking(input: BlockingInput, allowedReasons: string[]): DecisionValidation {
  const errors: string[] = [];
  if (!input.reason || !allowedReasons.includes(input.reason)) {
    errors.push("Выберите основание из списка §12.15.");
  }
  if (!input.term) {
    errors.push("Укажите срок: 7 дней или навсегда.");
  }
  return { ok: errors.length === 0, errors };
}

export function makeBlocking(
  input: Required<Pick<BlockingInput, "user" | "reason" | "term">> & { note?: string },
  opts: { actor: string; now: string; id: string },
): Blocking {
  return {
    id: opts.id,
    user: input.user,
    reason: input.reason,
    note: input.note?.trim() ? input.note.trim() : undefined,
    term: input.term,
    actor: opts.actor,
    createdAt: opts.now,
  };
}

/* ------------------------------------------------------------------ */
/* Журнал: только чтение, группируем по календарному дню для витрины. */
/* ------------------------------------------------------------------ */

export interface JournalGroup {
  date: string;
  entries: ModerationEntry[];
}

/** Сортировка «свежие сверху» и группировка по дню; ничего не удаляем и не правим (§3.9.4). */
export function groupJournalByDate(entries: ModerationEntry[]): JournalGroup[] {
  const ordered = [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const groups: JournalGroup[] = [];
  for (const entry of ordered) {
    const date = entry.createdAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.entries.push(entry);
    } else {
      groups.push({ date, entries: [entry] });
    }
  }
  return groups;
}
