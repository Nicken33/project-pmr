"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Heart, X } from "lucide-react";
import type { ToastMessage, User } from "@/lib/types";
import { colorFromString } from "@/lib/utils";
import type { SessionState, ViewMode } from "@/lib/view-mode";
import { GoogleOAuthProvider } from "@react-oauth/google";

const FAVORITES_KEY = "talentro_favorites";

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AppContextValue {
  user: User | null;
  /** Режим посчитан на сервере; флаг только рисует кнопки, закрытые разделы проверяют куку сами. */
  mode: ViewMode;
  ready: boolean;
  loginWithGoogle: (credential: string) => Promise<AuthResult>;
  loginWithTesterToken: (token: string) => Promise<AuthResult>;
  logout: () => void;
  favorites: string[];
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => "added" | "removed" | "auth";
  removeFavorite: (slug: string) => void;
  requestAuth: (message?: string) => void;
  toast: (message: Omit<ToastMessage, "id">) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Идентичность приходит из ответа `GET /api/auth/me`, переданного пропом с сервера.
 *
 * Роль нельзя выводить из письма или хранить в localStorage: своего хранилища
 * пользователей у сайта нет, а строку в браузере посетитель подменяет свободно.
 * Значит аноним — это `null`, и только бэкенд решает, кто вошёл.
 */
function sessionUser(session: SessionState | null): User | null {
  if (!session?.authenticated) return null;
  const email = session.email ?? "";
  const name = session.name?.trim() || email || "Пользователь Talentro";
  const role: User["role"] =
    session.role === "moderator" || session.role === "owner" ? session.role : "user";
  return {
    id: `${session.provider ?? "session"}:${email || name}`,
    name,
    email,
    role,
    avatarColor: colorFromString(email || name),
    picture: session.picture,
  };
}

/**
 * POST идёт на тот же origin, что и сайт: `/api/auth/*` — прокси Next, который
 * пересылает куку бэкенду и возвращает `Set-Cookie` посетителю. Напрямую на порт
 * бэкенда нельзя: `SameSite=Lax` не перевозит HttpOnly-куку между origin.
 */
async function send(
  action: "google" | "tester" | "logout",
  payload?: Record<string, string>,
): Promise<AuthResult> {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  }).catch(() => null);

  if (!response) return { ok: false, error: "Сервер авторизации недоступен" };
  if (!response.ok) {
    // Бэкенд описывает отказ текстом (`http.Error`), поэтому JSON не разбираем.
    const reason = await response.text().catch(() => "");
    return { ok: false, error: reason.trim() || "Сервер отклонил вход" };
  }
  return { ok: true };
}

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function AppProviders({
  session,
  mode,
  children,
}: {
  session: SessionState | null;
  mode: ViewMode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useMemo(() => sessionUser(session), [session]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);

  /* Избранное читаем после монтирования: на сервере localStorage нет, а
     синхронная инициализация дала бы расхождение при гидратации. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setFavorites(readFavorites());
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toast = useCallback((message: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { ...message, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const loginWithGoogle = useCallback(
    async (credential: string): Promise<AuthResult> => {
      const result = await send("google", { credential });
      if (result.ok) {
        router.refresh();
        toast({ title: "Вход через Google выполнен", tone: "success" });
      }
      return result;
    },
    [router, toast],
  );

  const loginWithTesterToken = useCallback(
    async (token: string): Promise<AuthResult> => {
      const result = await send("tester", { token });
      if (result.ok) {
        router.refresh();
        toast({
          title: "Вошли как тестировщик",
          description: "Стало видно демонстрационные разделы",
          tone: "success",
        });
      }
      return result;
    },
    [router, toast],
  );

  const logout = useCallback(() => {
    void send("logout").then(() => router.refresh());
    toast({ title: "Вы вышли из аккаунта" });
  }, [router, toast]);

  const persistFavorites = useCallback((next: string[]) => {
    setFavorites(next);
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("talentro:favorites", { detail: next }));
  }, []);

  const toggleFavorite = useCallback(
    (slug: string): "added" | "removed" | "auth" => {
      if (!user) {
        setAuthPrompt("Войдите, чтобы сохранять занятия в избранное");
        return "auth";
      }
      const exists = favorites.includes(slug);
      if (exists) {
        persistFavorites(favorites.filter((item) => item !== slug));
        toast({ title: "Удалено из избранного", tone: "default" });
        return "removed";
      }
      persistFavorites([...favorites, slug]);
      toast({ title: "Добавлено в избранное", description: "Найти можно в разделе «Избранное»", tone: "success" });
      return "added";
    },
    [favorites, persistFavorites, toast, user],
  );

  const removeFavorite = useCallback(
    (slug: string) => {
      persistFavorites(favorites.filter((item) => item !== slug));
      toast({ title: "Удалено из избранного" });
    },
    [favorites, persistFavorites, toast],
  );

  const requestAuth = useCallback((message?: string) => {
    setAuthPrompt(message ?? "Войдите, чтобы продолжить");
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      mode,
      ready,
      loginWithGoogle,
      loginWithTesterToken,
      logout,
      favorites,
      isFavorite: (slug) => favorites.includes(slug),
      toggleFavorite,
      removeFavorite,
      requestAuth,
      toast,
    }),
    [
      favorites,
      loginWithGoogle,
      loginWithTesterToken,
      logout,
      mode,
      ready,
      removeFavorite,
      requestAuth,
      toast,
      toggleFavorite,
      user,
    ],
  );

  const next = pathname ?? "/";

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ""}>
      <AppContext.Provider value={value}>
      {children}

      <div className="toastRegion" aria-live="polite" aria-atomic="true">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone ?? "default"}`}>
            <span className="toastIcon">
              {item.tone === "success" ? <Check size={16} /> : item.tone === "danger" ? <X size={16} /> : <Heart size={16} />}
            </span>
            <div>
              <strong>{item.title}</strong>
              {item.description ? <p>{item.description}</p> : null}
            </div>
            <button
              type="button"
              className="toastClose"
              aria-label="Закрыть уведомление"
              onClick={() => setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {authPrompt ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setAuthPrompt(null)}>
          <div
            className="authGate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-gate-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="modalClose" aria-label="Закрыть" onClick={() => setAuthPrompt(null)}>
              <X size={20} />
            </button>
            <span className="authGateIcon">
              <Heart size={28} />
            </span>
            <h2 id="auth-gate-title">Сохраняйте любимые занятия</h2>
            <p>{authPrompt}</p>
            <div className="authGateActions">
              <Link className="btn btn--primary btn--lg" href={`/login?next=${encodeURIComponent(next)}`}>
                Войти
              </Link>
            </div>
            <small>Гостям каталог доступен без входа — избранное требует аккаунта.</small>
          </div>
        </div>
      ) : null}
    </AppContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProviders");
  return context;
}
