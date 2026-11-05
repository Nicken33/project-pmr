import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { fetchSession } from "@/lib/api";
import { resolveViewMode, type SessionState, type ViewMode } from "@/lib/view-mode";

/** Имя куки обязано совпадать с `auth.CookieName` в `backend/Talentro/internal/auth/session.go`. */
const SESSION_COOKIE = "talentro_session";

export interface View {
  mode: ViewMode;
  session: SessionState | null;
}

/**
 * Серверная граница «кто смотрит» (§6). Вызывать только из серверных компонентов
 * и route handler'ов: `next/headers` на клиенте недоступен, а режим, посчитанный
 * в браузере, посетитель мог бы подменить.
 *
 * Кука читается здесь и пересылается бэкенду как есть: HttpOnly-куку браузер в
 * JavaScript не отдаёт, поэтому другой способ получить сессию на сервере был бы
 * либо подделкой, либо вторым источником правды.
 */
export const readView = cache(async (): Promise<View> => {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  const session = value ? await fetchSession(`${SESSION_COOKIE}=${value}`) : null;
  return { mode: resolveViewMode(session), session };
});

/**
 * Граница закрытых разделов (§6): `/account` и `/moderation` отдают не заглушку,
 * а 404 — и без единой коллекции в теле ответа.
 *
 * Вызывать первой строкой серверного компонента, до загрузки данных: `notFound()`
 * после запроса уже не спрячет анкеты и жалобы, которые успели попасть в
 * RSC-поток.
 */
export async function requireDemo(): Promise<void> {
  const { mode } = await readView();
  if (mode !== "demo") notFound();
}
