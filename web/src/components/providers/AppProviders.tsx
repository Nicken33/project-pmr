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
import { usePathname } from "next/navigation";
import { Check, Heart, X } from "lucide-react";
import type { ToastMessage, User } from "@/lib/types";
import { colorFromString } from "@/lib/utils";

const USER_KEY = "talentro_user";
const FAVORITES_KEY = "talentro_favorites";

interface AuthResult {
  ok: boolean;
  error?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput extends LoginInput {
  name: string;
  role: "user" | "owner";
}

interface AppContextValue {
  user: User | null;
  ready: boolean;
  login: (input: LoginInput) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => void;
  favorites: string[];
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => "added" | "removed" | "auth";
  removeFavorite: (slug: string) => void;
  requestAuth: (message?: string) => void;
  toast: (message: Omit<ToastMessage, "id">) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const demoUser: User = {
  id: "user-anna",
  name: "Анна Морозова",
  email: "anna@example.com",
  role: "user",
  avatarColor: "#8B5CF6",
};

function readUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
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

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);

  useEffect(() => {
    setUser(readUser());
    setFavorites(readFavorites());
    setReady(true);
  }, []);

  const toast = useCallback((message: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { ...message, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const login = useCallback(
    async ({ email, password }: LoginInput): Promise<AuthResult> => {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: "Введите почту в формате name@example.com" };
      }
      if (password.length < 6) {
        return { ok: false, error: "Пароль должен быть не короче 6 символов" };
      }
      const isModerator = email.toLowerCase().includes("moder");
      const isOwner = email.toLowerCase().includes("owner");
      const nextUser: User = {
        ...demoUser,
        id: isModerator ? "user-mod" : isOwner ? "user-owner" : "user-anna",
        email: email.toLowerCase(),
        name: isModerator ? "Модератор Talentro" : isOwner ? "Анна Морозова" : "Анна Морозова",
        role: isModerator ? "moderator" : isOwner ? "owner" : "user",
        organizationSlug: isOwner ? "studiya-palitra" : undefined,
      };
      setUser(nextUser);
      window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      toast({ title: "Вы вошли", description: `Здравствуйте, ${nextUser.name}!`, tone: "success" });
      return { ok: true };
    },
    [toast],
  );

  const register = useCallback(
    async ({ name, email, password, role }: RegisterInput): Promise<AuthResult> => {
      await new Promise((resolve) => window.setTimeout(resolve, 550));
      if (name.trim().length < 2) return { ok: false, error: "Укажите имя" };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: "Введите почту в формате name@example.com" };
      }
      if (password.length < 6) {
        return { ok: false, error: "Пароль должен быть не короче 6 символов" };
      }
      const nextUser: User = {
        id: `user-${Date.now()}`,
        name: name.trim(),
        email: email.toLowerCase(),
        role,
        avatarColor: colorFromString(email),
        organizationSlug: role === "owner" ? "studiya-palitra" : undefined,
      };
      setUser(nextUser);
      window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      toast({ title: "Аккаунт создан", description: "Добро пожаловать в Talentro!", tone: "success" });
      return { ok: true };
    },
    [toast],
  );

  const logout = useCallback(() => {
    setUser(null);
    window.localStorage.removeItem(USER_KEY);
    toast({ title: "Вы вышли из аккаунта" });
  }, [toast]);

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
      ready,
      login,
      register,
      logout,
      favorites,
      isFavorite: (slug) => favorites.includes(slug),
      toggleFavorite,
      removeFavorite,
      requestAuth,
      toast,
    }),
    [favorites, login, logout, ready, register, removeFavorite, requestAuth, toast, toggleFavorite, user],
  );

  const next = pathname ?? "/";

  return (
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
              <Link className="btn btn--soft btn--lg" href={`/register?next=${encodeURIComponent(next)}`}>
                Регистрация
              </Link>
            </div>
            <small>Гостям каталог доступен без входа — избранное требует аккаунта.</small>
          </div>
        </div>
      ) : null}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProviders");
  return context;
}
