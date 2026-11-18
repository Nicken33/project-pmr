import type { SessionState } from "@/lib/view-mode";

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsAccountType?: boolean;
  sessionUnconfirmed?: boolean;
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
    const session = await verifyAuthSession();
    if (!session.ok) return { ...session, sessionUnconfirmed: true,
      error: "Сервер принял запрос, но не удалось подтвердить сессию после входа. Повторите проверку входа; заново создавать аккаунт не нужно." };
  }
  return { ok: true };
}

/** A retry only reads the current session; it never repeats account creation. */
export async function verifyAuthSession(): Promise<AuthResult> {
  const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" }).catch(() => null);
  const data = response ? await response.json().catch(() => null) as (SessionState & {error?:{message?:string}}) | null : null;
  if (response?.ok && data?.authenticated === true) return {ok:true};
  return {ok:false, error:data?.error?.message ?? "Не удалось подтвердить вход. Проверьте соединение или войдите заново."};
}
