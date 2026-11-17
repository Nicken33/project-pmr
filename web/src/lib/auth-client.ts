import type { SessionState } from "@/lib/view-mode";

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsAccountType?: boolean;
  googleEmail?: string;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

export async function authRequest(action: "google" | "tester" | "logout" | "login" | "register", payload?: Record<string, string>): Promise<AuthResult> {
  const response = await fetch(`/api/auth/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload ?? {}), cache: "no-store" }).catch(() => null);
  if (!response) return { ok: false, error: "Сервер авторизации недоступен" };
  const data = await response.json().catch(() => null) as { needs_account_type?: boolean; email?: string; error?: {message?: string; fields?: Record<string,string>} } | null;
  if (response.status === 202) {
    return data?.needs_account_type === true
      ? { ok: false, needsAccountType: true, googleEmail: data.email }
      : { ok: false, error: "Регистрация ещё не завершена. Попробуйте войти заново." };
  }
  if (!response.ok) {
    const retry = Number(response.headers.get("retry-after"));
    return { ok: false, error: data?.error?.message || `Не удалось выполнить действие (${response.status})`, fieldErrors: data?.error?.fields,
      ...(Number.isFinite(retry) && retry > 0 ? { retryAfterSeconds: retry } : {}) };
  }
  if (action === "google" || action === "login" || action === "register") {
    const check = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null);
    const session = check?.ok ? await check.json().catch(() => null) as SessionState | null : null;
    if (!session?.authenticated) return { ok: false, error: "Не удалось подтвердить сессию после входа. Обновите страницу и попробуйте снова." };
  }
  return { ok: true };
}
