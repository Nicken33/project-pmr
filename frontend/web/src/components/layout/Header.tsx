"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Heart,
  LogOut,
  Map,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { cn, initials } from "@/lib/utils";
import type { User as Account } from "@/lib/types";

const navigation = [
  { href: "/", label: "Каталог", exact: true },
  { href: "/map", label: "Карта" },
  { href: "/about", label: "О проекте" },
];

/** Аватар: картинка из профиля Google, иначе инициалы на цветном фоне. */
function Avatar({ user, small }: { user: Account; small?: boolean }) {
  if (user.picture) {
    const px = small ? 28 : 40;
    return <img className={cn("avatar", small && "avatar--sm")} src={user.picture} alt="" width={px} height={px} />;
  }
  return (
    <span className={cn("avatar", small && "avatar--sm")} style={{ background: user.avatarColor }}>
      {initials(user.name)}
    </span>
  );
}

export function Header() {
  const pathname = usePathname();
  const { user, favorites, logout, mode } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const authMenuRef = useRef<HTMLDivElement>(null);

  /* Навигация — внешнее состояние: при смене маршрута закрываем поповеры. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMobileOpen(false);
    setUserOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (authMenuRef.current && !authMenuRef.current.contains(target)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const active = (href: string, exact?: boolean) => {
    if (href.startsWith("/#")) return pathname === "/";
    return exact ? pathname === href : pathname.startsWith(href);
  };

  /* Право на кабинет решает сервер (`requireDemo` читает куку), здесь только
     рисуем ссылку: анониму показывать её нельзя — она ведёт в 404. */
  const cabinetsOpen = mode === "demo";

  return (
    <>
      <header className="siteHeader">
        <div className="headerInner">
          <Link href="/" className="brand" aria-label="Talentro — на главную">
            <img src="/brand/logo.svg" alt="Talentro" width={160} height={52} />
          </Link>

          <nav className="mainNav" aria-label="Главная навигация">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={cn("navLink", active(item.href, item.exact) && "isActive")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="headerActions">
            <Link href="/favorites" className="iconButton" aria-label="Избранное" title="Избранное">
              <Heart size={20} />
              {favorites.length ? <span className="iconBadge">{favorites.length}</span> : null}
            </Link>

            {cabinetsOpen ? (
              <Link href="/account" className="iconButton hideSm" aria-label="Кабинет" title="Кабинет">
                <Settings size={19} />
              </Link>
            ) : null}

            <div className="popoverWrap" ref={authMenuRef}>
              {user ? (
                <>
                  <button
                    type="button"
                    className="userChip"
                    aria-expanded={userOpen}
                    onClick={() => setUserOpen((open) => !open)}
                  >
                    <Avatar user={user} small />
                    <span className="userChipName">{user.name.split(" ")[0]}</span>
                    <ChevronDown size={15} />
                  </button>
                  {userOpen ? (
                    <div className="popover userPopover">
                      <div className="userPopoverHead">
                        <Avatar user={user} />
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                      {cabinetsOpen ? (
                        <Link href="/account" onClick={() => setUserOpen(false)}>
                          <User size={17} /> Мой кабинет
                        </Link>
                      ) : null}
                      <Link href="/favorites" onClick={() => setUserOpen(false)}>
                        <Heart size={17} /> Избранное
                      </Link>
                      {cabinetsOpen || user.role === "moderator" ? (
                        <Link href="/moderation" onClick={() => setUserOpen(false)}>
                          <ShieldCheck size={17} /> Модерация
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setUserOpen(false);
                        }}
                      >
                        <LogOut size={17} /> Выйти
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="authButtons">
                  {/* Отдельной «регистрации» нет: аккаунт появляется при первом входе
                      через Google, поэтому вторая кнопка обещала бы то, чего бэкенд не делает. */}
                  <Link className="btn btn--ghost hideMd" href="/login">
                    Войти
                  </Link>
                  <Link className="iconButton authMobile" href="/login" aria-label="Войти">
                    <User size={20} />
                  </Link>
                </div>
              )}
            </div>

            <button
              type="button"
              className="iconButton menuButton"
              aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="mobileMenu" role="dialog" aria-modal="true" aria-label="Меню">
          <form action="/" className="mobileSearch">
            <Search size={18} />
            <input type="search" name="q" placeholder="Поиск занятий и услуг" aria-label="Поиск" />
          </form>
          <nav aria-label="Мобильная навигация">
            {navigation.map((item) => (
              <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            ))}
            <Link href="/favorites" onClick={() => setMobileOpen(false)}>
              Избранное
              {favorites.length ? <span className="counterPill">{favorites.length}</span> : null}
            </Link>
            {cabinetsOpen ? (
              <Link href="/account" onClick={() => setMobileOpen(false)}>
                Кабинет владельца
              </Link>
            ) : null}
            <Link href="/request" onClick={() => setMobileOpen(false)}>
              Не нашли занятие?
            </Link>
          </nav>
          <div className="mobileMenuFooter">
            {user ? (
              <>
                <div className="mobileUser">
                  <Avatar user={user} small />
                  <div>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </div>
                </div>
                <button type="button" className="btn btn--soft btn--block" onClick={logout}>
                  Выйти
                </button>
              </>
            ) : (
              <div className="mobileAuth">
                <Link className="btn btn--primary btn--block" href="/login">
                  Войти через Google
                </Link>
              </div>
            )}
            <div className="mobileLegal">
              <Link href="/terms">Условия</Link>
              <Link href="/rules">Правила</Link>
              <Link href="/privacy">Данные</Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { favorites, mode } = useApp();
  const tabs = [
    { href: "/", label: "Каталог", icon: Search },
    { href: "/map", label: "Карта", icon: Map },
    { href: "/favorites", label: "Избранное", icon: Heart, count: favorites.length },
    /* Кабинет закрыт `requireDemo`: вкладка для анонима вела бы в 404. */
    ...(mode === "demo" ? [{ href: "/account", label: "Кабинет", icon: User }] : []),
  ];
  return (
    <nav className="mobileTabBar" aria-label="Быстрая навигация">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={cn("mobileTab", active && "isActive")}>
            <span className="mobileTabIcon">
              <Icon size={20} />
              {tab.count ? <span className="mobileTabBadge">{tab.count}</span> : null}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
