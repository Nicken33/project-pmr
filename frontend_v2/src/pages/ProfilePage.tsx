import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, UserRound } from 'lucide-react'
import { Api, isOwner } from '../api/endpoints'
import { errorText } from '../api/client'
import { useAuth } from '../state/auth'
import { useToast } from '../state/toast'
import { PasswordField, TextField } from '../components/forms/Fields'

const ROLE: Record<string, string> = {
  user: 'Пользователь',
  section_owner: 'Организация (секции и занятия)',
  service_owner: 'Организация (услуги)',
  owner_activity: 'Организация (секции и занятия)',
  owner_service: 'Организация (услуги)',
  moderator: 'Модератор',
}

export default function ProfilePage() {
  const { user, setUser, signOut } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [name, setName] = useState(user!.name)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim().length > 120) return setErr('Имя — от 1 до 120 символов')
    setBusy(true)
    setErr('')
    try {
      setUser(await Api.updateMe({ name: name.trim(), email: user!.email }))
      toast('Профиль сохранён', 'success')
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  // отдельной ручки смены пароля в API нет — отправляем письмо сброса на свою почту
  const sendReset = async () => {
    try {
      await Api.resetRequest(user!.email)
      setSent(true)
      toast(`Ссылка для нового пароля отправлена на ${user!.email}`, 'success')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  return (
    <div className="auth auth--profile">
      <form className="auth__card auth__card--wide panel" onSubmit={save} noValidate>
        <h1>Профиль</h1>
        <p className="auth__note" style={{ textAlign: 'center' }}>
          Тип аккаунта: <b>{ROLE[user!.account_type] ?? user!.account_type}</b>
        </p>
        <TextField label="Имя / логин" required icon={<UserRound size={18} />} value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Почта" icon={<Mail size={18} />} type="email" value={user!.email} readOnly disabled hint="Почту сменить нельзя — она подтверждена при регистрации" />
        {err && <p className="form-error">{err}</p>}
        <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <div className="row row--wrap" style={{ justifyContent: 'center' }}>
          {isOwner(user) && (
            <>
              <Link to="/my" className="btn btn--soft btn--sm">
                Мои анкеты
              </Link>
              <Link to="/my/organization" className="btn btn--soft btn--sm">
                Профиль организации
              </Link>
            </>
          )}
          {user!.account_type === 'moderator' && (
            <Link to="/moderation" className="btn btn--soft btn--sm">
              Модерация
            </Link>
          )}
          <button
            type="button"
            className="btn btn--danger btn--sm"
            onClick={() => {
              nav('/') // сначала уходим со страницы, иначе защита страницы отправит на вход
              signOut()
            }}
          >
            Выйти
          </button>
        </div>
      </form>
      <PasswordForm onForgot={sendReset} sent={sent} />
    </div>
  )
}

/** Смена пароля: POST /me/password {current_password,new_password}. «Не помню» — письмо для сброса. */
function PasswordForm({ onForgot, sent }: { onForgot: () => void; sent: boolean }) {
  const toast = useToast()
  const [p, setP] = useState({ cur: '', next: '', again: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const bytes = new TextEncoder().encode(p.next).length
    if (!p.cur) return setErr('Введите текущий пароль')
    if (bytes < 8 || bytes > 256) return setErr('Новый пароль — не менее 8 символов')
    if (p.next === p.cur) return setErr('Новый пароль должен отличаться от текущего')
    if (p.next !== p.again) return setErr('Пароли не совпадают')
    setBusy(true)
    setErr('')
    try {
      await Api.changePassword(p.cur, p.next)
      setP({ cur: '', next: '', again: '' })
      toast('Пароль изменён', 'success')
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth__card auth__card--wide panel" onSubmit={submit} noValidate>
      <h2>
        <KeyRound size={18} /> Смена пароля
      </h2>
      <PasswordField label="Текущий пароль" autoComplete="current-password" value={p.cur} onChange={(e) => setP({ ...p, cur: e.target.value })} />
      <PasswordField label="Новый пароль" autoComplete="new-password" hint="Не менее 8 символов" value={p.next} onChange={(e) => setP({ ...p, next: e.target.value })} />
      <PasswordField label="Повторите новый пароль" autoComplete="new-password" value={p.again} onChange={(e) => setP({ ...p, again: e.target.value })} />
      {err && <p className="form-error">{err}</p>}
      <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
        {busy ? 'Меняем…' : 'Сменить пароль'}
      </button>
      <button type="button" className="link-btn" style={{ alignSelf: 'center' }} disabled={sent} onClick={onForgot}>
        {sent ? 'Письмо для сброса отправлено' : 'Не помню текущий пароль — прислать письмо'}
      </button>
    </form>
  )
}
