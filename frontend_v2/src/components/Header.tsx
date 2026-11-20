import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Heart, Menu, MessageCircleMore, Settings, User, X } from 'lucide-react'
import { Logo } from './Logo'
import { useAuth } from '../state/auth'
import { useFavorites } from '../state/favorites'
import { useToast } from '../state/toast'
import { isOwner } from '../api/endpoints'
import { RoleButton, RoleChip, RoleMark } from './RoleButton'
import { useRoleStats } from '../state/roleStats'

const NAV = [
  { to: '/', label: 'Главная', end: true },
  { to: '/catalog', label: 'Каталог' },
  { to: '/map', label: 'Карта' },
  { to: '/about', label: 'О проекте' },
]

export function Header() {
  const { user, signOut } = useAuth()
  const { unseen } = useFavorites()
  const { stats } = useRoleStats()
  const toast = useToast()
  const nav = useNavigate()
  const loc = useLocation()
  const [menu, setMenu] = useState(false) // меню аккаунта
  const [drawer, setDrawer] = useState(false) // мобильное меню
  const accRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMenu(false)
    setDrawer(false)
  }, [loc.pathname])

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      if (!accRef.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  // Сообщений и уведомлений в API пока нет — значки показываем, бейджи скрыты (0 = скрыто по спеке).
  const soon = () => toast('Сообщения и уведомления появятся позже')
  const needLogin = (path: string) => (user ? nav(path) : nav('/login', { state: { from: path } }))

  const accountLinks = user ? (
    <>
      <div className="acc-menu__who">
        <b>
          {user.name} <RoleChip user={user} />
        </b>
        <span>{user.email}</span>
      </div>
      <Link to="/profile">Профиль</Link>
      <Link to="/favorites">Избранное</Link>
      {isOwner(user) && (
        <>
          <Link to="/my">
            Мои анкеты {stats.rejected + stats.drafts > 0 && <span className="acc-menu__count">{stats.rejected + stats.drafts}</span>}
          </Link>
          <Link to="/my/organization">Профиль организации</Link>
        </>
      )}
      {user.account_type === 'moderator' && (
        <Link to="/moderation">
          Модерация {stats.queue + stats.reports > 0 && <span className={`acc-menu__count ${stats.overdue ? 'is-alert' : ''}`}>{stats.queue + stats.reports}</span>}
        </Link>
      )}
      <button
        type="button"
        onClick={() => {
          nav('/') // сначала уходим со страницы, иначе защита страницы отправит на вход
          signOut()
        }}
      >
        Выйти
      </button>
    </>
  ) : (
    <>
      <Link to="/login" state={{ from: loc.pathname }}>
        Войти
      </Link>
      <Link to="/register">Регистрация</Link>
    </>
  )

  return (
    <header className="header">
      <button className="header__burger" aria-label="Меню" onClick={() => setDrawer(true)}>
        <Menu size={26} />
      </button>
      <Logo />
      <nav className="header__nav" aria-label="Главное меню">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="header__link">
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="header__icons">
        <RoleButton user={user} />
        <button className="icon-btn" aria-label="Избранное" onClick={() => needLogin('/favorites')}>
          <Heart size={28} strokeWidth={1.8} />
          {unseen > 0 && <span className="badge">{unseen}</span>}
        </button>
        <button className="icon-btn hide-sm" aria-label="Сообщения" onClick={soon}>
          <MessageCircleMore size={28} strokeWidth={1.8} />
        </button>
        <button className="icon-btn hide-sm" aria-label="Уведомления" onClick={soon}>
          <Bell size={28} strokeWidth={1.8} />
        </button>
        <button className="icon-btn icon-btn--accent hide-sm" aria-label="Настройки" onClick={() => needLogin('/profile')}>
          <Settings size={28} strokeWidth={1.8} />
        </button>
        <div className="acc" ref={accRef} onMouseLeave={() => setMenu(false)}>
          <button
            className="acc__btn"
            aria-label="Аккаунт"
            aria-expanded={menu}
            onClick={() => {
              // гость → сразу на вход; вошедший → меню (наведение тоже открывает меню)
              if (!user) nav('/login', { state: { from: loc.pathname } })
              else setMenu(true)
            }}
            onMouseEnter={() => setMenu(true)}
          >
            {user ? <span className="acc__initial">{user.name.slice(0, 1).toUpperCase()}</span> : <User size={28} strokeWidth={1.8} />}
            {user && <RoleMark user={user} />}
          </button>
          {menu && <div className="acc-menu">{accountLinks}</div>}
        </div>
      </div>

      {drawer && (
        <div className="drawer" role="dialog" aria-modal="true" onClick={() => setDrawer(false)}>
          <div className="drawer__body" onClick={(e) => e.stopPropagation()}>
            <div className="drawer__top">
              <Logo height={40} />
              <button className="icon-btn" aria-label="Закрыть" onClick={() => setDrawer(false)}>
                <X />
              </button>
            </div>
            <nav className="drawer__nav">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="drawer__acc">{accountLinks}</div>
          </div>
        </div>
      )}
    </header>
  )
}
