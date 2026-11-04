"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Heart,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProviders";
import { cn, initials } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Каталог", exact: true },
  { href: "/map", label: "Карта" },
  { href: "/about", label: "О проекте" },
];

export function Header() {
  const pathname = usePathname();
  const { user, favorites, logout, toast } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(2);
  const authMenuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  /* Навигация — внешнее состояние: при смене маршрута закрываем все поповеры. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMobileOpen(false);
    setUserOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (authMenuRef.current && !authMenuRef.current.contains(target)) setUserOpen(false);
      if (bellRef.current && !bellRef.current.contains(target)) setNotificationsOpen(false);
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

            <button
              type="button"
              className="iconButton hideSm"
              aria-label="Сообщения"
              title="Сообщения"
              onClick={() => toast({ title: "Сообщений пока нет", description: "Ответы на отзывы появятся здесь" })}
            >
              <MessageCircle size={20} />
            </button>

            <div className="popoverWrap hideSm" ref={bellRef}>
              <button
                type="button"
                className="iconButton"
                aria-label="Уведомления"
                title="Уведомления"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setUnread(0);
                }}
              >
                <Bell size={20} />
                {unread ? <span className="iconBadge iconBadge--danger">{unread}</span> : null}
              </button>
              {notificationsOpen ? (
                <div className="popover notificationsPopover">
                  <div className="popoverHead">
                    <strong>Уведомления</strong>
                    <span className="muted">2 новых</span>
                  </div>
                  <button type="button" className="notificationItem" onClick={() => setNotificationsOpen(false)}>
                    <span className="notificationIcon">
                      <ShieldCheck size={17} />
                    </span>
                    <span>
                      <b>Данные проверены</b>
                      <small>Карточка «Палитра» обновлена 18.10.2026</small>
                    </span>
                  </button>
                  <button type="button" className="notificationItem" onClick={() => setNotificationsOpen(false)}>
                    <span className="notificationIcon">
                      <Heart size={17} />
                    </span>
                    <span>
                      <b>Скоро новые группы</b>
                      <small>В «Чемпионе» открывается группа 8–12 лет</small>
                    </span>
                  </button>
                  <Link href="/account" className="popoverFooter">
                    Перейти в кабинет
                  </Link>
                </div>
              ) : null}
            </div>

            <Link href="/account" className="iconButton hideSm" aria-label="Кабинет" title="Кабинет">
              <Settings size={19} />
            </Link>

            <div className="popoverWrap" ref={authMenuRef}>
              {user ? (
                <>
                  <button
                    type="button"
                    className="userChip"
                    aria-expanded={userOpen}
                    onClick={() => setUserOpen((open) => !open)}
                  >
                    <span className="avatar avatar--sm" style={{ background: user.avatarColor }}>
                      {initials(user.name)}
                    </span>
                    <span className="userChipName">{user.name.split(" ")[0]}</span>
                    <ChevronDown size={15} />
                  </button>
                  {userOpen ? (
                    <div className="popover userPopover">
                      <div className="userPopoverHead">
                        <span className="avatar" style={{ background: user.avatarColor }}>
                          {initials(user.name)}
                        </span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                      <Link href="/account" onClick={() => setUserOpen(false)}>
                        <User size={17} /> Мой кабинет
                      </Link>
                      <Link href="/favorites" onClick={() => setUserOpen(false)}>
                        <Heart size={17} /> Избранное
                      </Link>
                      {user.role === "moderator" ? (
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
                  <Link className="btn btn--ghost hideMd" href="/login">
                    Войти
                  </Link>
                  <Link className="btn btn--primary hideSm" href="/register">
                    Регистрация
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
            <Link href="/account" onClick={() => setMobileOpen(false)}>
              Кабинет владельца
            </Link>
            <Link href="/request" onClick={() => setMobileOpen(false)}>
              Не нашли занятие?
            </Link>
          </nav>
          <div className="mobileMenuFooter">
            {user ? (
              <>
                <div className="mobileUser">
                  <span className="avatar avatar--sm" style={{ background: user.avatarColor }}>
                    {initials(user.name)}
                  </span>
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
                  Войти
                </Link>
                <Link className="btn btn--soft btn--block" href="/register">
                  Создать аккаунт
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
  const { favorites } = useApp();
  const tabs = [
    { href: "/", label: "Каталог", icon: Search },
    { href: "/map", label: "Карта", icon: Map },
    { href: "/favorites", label: "Избранное", icon: Heart, count: favorites.length },
    { href: "/account", label: "Кабинет", icon: User },
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
