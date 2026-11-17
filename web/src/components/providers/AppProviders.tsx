"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Heart, X } from "lucide-react";
import type { ToastMessage, User } from "@/lib/types";
import { colorFromString } from "@/lib/utils";
import type { SessionState, ViewMode } from "@/lib/view-mode";
import { authRequest as send, type AuthResult } from "@/lib/auth-client";
import { communityRequest, CommunityError } from "@/lib/community-api";
import { GoogleOAuthProvider } from "@react-oauth/google";


interface AppContextValue {
  user: User | null;
  /** Режим посчитан на сервере; флаг только рисует кнопки, закрытые разделы проверяют куку сами. */
  mode: ViewMode;
  ready: boolean;
  loginWithGoogle: (
    credential: string,
    accountType?: "user" | "section_owner" | "service_owner",
  ) => Promise<AuthResult>;
  loginWithTesterToken: (token: string) => Promise<AuthResult>;
  loginWithEmail: (email: string, password: string) => Promise<AuthResult>;
  registerWithEmail: (
    email: string,
    password: string,
    name: string,
    accountType?: "user" | "section_owner" | "service_owner" | string,
  ) => Promise<AuthResult>;
  logout: () => void;
  favorites: string[];
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string, activityId?: string) => Promise<"added" | "removed" | "auth" | "error">;
  removeFavorite: (slug: string, activityId?: string) => Promise<boolean>;
  favoritesError?: string;
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
 *
 * `account_type` канона (§7) различает владельца занятий и владельца услуг;
 * витрине для подписей хватает одной роли «владелец», а какая именно карточка
 * ему доступна — решает сервер. Точное значение кабинету передаёт страница.
 */
function sessionUser(session: SessionState | null): User | null {
  if (!session?.authenticated) return null;
  const email = session.email ?? "";
  const name = session.name?.trim() || email || "Пользователь Talentro";
  const role: User["role"] =
    session.role === "moderator"
      ? "moderator"
      : session.role === "owner" ||
          session.role === "owner_activity" ||
          session.role === "owner_service" ||
          session.role === "section_owner" ||
          session.role === "service_owner"
        ? "owner"
        : "user";
  return {
    id: session.id ?? `${session.provider ?? "session"}:${email || name}`,
    name,
    email,
    role,
    avatarColor: colorFromString(email || name),
    picture: session.picture,
  };
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

  const [favoritesError, setFavoritesError] = useState("");
  const favoriteIds = useRef(new Map<string,string>());
  const favoritePending = useRef(new Set<string>());

  useEffect(() => {
    let active = true;
    favoriteIds.current.clear();
    const load = async () => {
      setReady(false); setFavorites([]); setFavoritesError("");
      if (!user) { if (active) setReady(true); return; }
      try {
        const all: {id:string;slug:string}[] = [];
        for (let page=1;;page++) {
          const data = await communityRequest<{items:{id:string;slug:string}[];total:number}>(`/favorites?page=${page}&limit=100`);
          if (!active) return;
          all.push(...data.items);
          if (all.length >= data.total || data.items.length===0) break;
        }
        if (active) {
          favoriteIds.current = new Map(all.map((x)=>[x.slug || String(x.id),String(x.id)]));
          setFavorites(all.map((x)=>x.slug || String(x.id)));
        }
      } catch (error) { if (active) setFavoritesError(error instanceof Error ? error.message : "Не удалось загрузить избранное"); }
      finally { if (active) setReady(true); }
    };
    void load();
    return () => { active=false; };
  }, [user]);

  const toast = useCallback((message: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { ...message, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const loginWithGoogle = useCallback(
    async (
      credential: string,
      accountType?: "user" | "section_owner" | "service_owner",
    ): Promise<AuthResult> => {
      const result = await send("google", {
        credential,
        ...(accountType ? { account_type: accountType } : {}),
      });
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

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const result = await send("login", { email, password });
      if (result.ok) {
        router.refresh();
        toast({ title: "Вы вошли", tone: "success" });
      }
      return result;
    },
    [router, toast],
  );

  const registerWithEmail = useCallback(
    async (
      email: string,
      password: string,
      name: string,
      accountType: "user" | "section_owner" | "service_owner" | string = "user",
    ): Promise<AuthResult> => {
      const result = await send("register", { email, password, name, account_type: accountType || "user" });
      if (result.ok) {
        router.refresh();
        toast({ title: "Аккаунт создан", tone: "success" });
      }
      return result;
    },
    [router, toast],
  );

  const logout = useCallback(() => {
    void send("logout").then((result) => {
      if (result.ok) { setFavorites([]); router.refresh(); toast({ title: "Вы вышли из аккаунта" }); }
      else toast({ title: "Не удалось выйти", description: result.error, tone: "danger" });
    });
  }, [router, toast]);

  const toggleFavorite = useCallback(async (slug: string, activityId?: string): Promise<"added"|"removed"|"auth"|"error"> => {
    if (!user) { setAuthPrompt("Войдите, чтобы сохранять занятия в избранное"); return "auth"; }
    if (!ready || favoritePending.current.has(slug)) return "error";
    favoritePending.current.add(slug);
    try {
      const id=activityId || favoriteIds.current.get(slug) || (/^\d+$/.test(slug) ? slug : "");
      if (!id) throw new Error("Не удалось определить ID занятия. Обновите страницу.");
      const exists=favorites.includes(slug);
      try {
        await communityRequest(`/favorites${exists ? `/${id}` : ""}`, exists ? {method:"DELETE"} : {method:"POST",body:JSON.stringify({card_id:id})});
      } catch (error) {
        // Reconcile an already-applied operation from another browser tab.
        if (!(error instanceof CommunityError && ((exists && error.status===404)||(!exists && error.code==="favorite_exists")))) throw error;
      }
      favoriteIds.current.set(slug,id);
      setFavorites((current)=>exists ? current.filter((x)=>x!==slug) : [...new Set([...current,slug])]);
      router.refresh();
      toast({title:exists ? "Удалено из избранного" : "Добавлено в избранное",tone:"success"});
      return exists ? "removed" : "added";
    } catch(error) { toast({title:"Не удалось изменить избранное",description:error instanceof Error ? error.message : "Ошибка сервера",tone:"danger"}); return "error"; }
    finally { favoritePending.current.delete(slug); }
  }, [user,ready,favorites,router,toast]);

  const removeFavorite = useCallback(async (slug:string,activityId?:string):Promise<boolean> => {
    if (!favorites.includes(slug)) return true;
    return await toggleFavorite(slug,activityId)==="removed";
  },[favorites,toggleFavorite]);

  const requestAuth = useCallback((message?: string) => {
    setAuthPrompt(message ?? "Войдите, чтобы продолжить");
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      mode,
      ready,
      favoritesError,
      loginWithGoogle,
      loginWithTesterToken,
      loginWithEmail,
      registerWithEmail,
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
      favoritesError,
      loginWithGoogle,
      loginWithTesterToken,
      loginWithEmail,
      registerWithEmail,
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
