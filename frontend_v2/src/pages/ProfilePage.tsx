import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, UserRound } from 'lucide-react'
import { Api, isOwner } from '../api/endpoints'
import { errorText } from '../api/client'
import { useAuth } from '../state/auth'
import { useToast } from '../state/toast'
import { EMAIL_RE, TextField } from '../components/forms/Fields'

const ROLE: Record<string, string> = {
  user: 'Пользователь',
  section_owner: 'Организация (секции и занятия)',
  service_owner: 'Организация (услуги)',
  moderator: 'Модератор',
}

export default function ProfilePage() {
  const { user, setUser, signOut } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [name, setName] = useState(user!.name)
  const [email, setEmail] = useState(user!.email)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim().length > 120) return setErr('Имя — от 1 до 120 символов')
    if (!EMAIL_RE.test(email.trim())) return setErr('Введите корректную почту')
    setBusy(true)
    setErr('')
    try {
      setUser(await Api.updateMe({ name: name.trim(), email: email.trim() }))
      toast('Профиль сохранён', 'success')
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth__card auth__card--wide panel" onSubmit={save} noValidate>
        <h1>Профиль</h1>
        <p className="auth__note" style={{ textAlign: 'center' }}>
          Тип аккаунта: <b>{ROLE[user!.account_type] ?? user!.account_type}</b>
        </p>
        <TextField label="Имя / логин" required icon={<UserRound size={18} />} value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Почта" required icon={<Mail size={18} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {err && <p className="form-error">{err}</p>}
        <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <div className="row row--wrap" style={{ justifyContent: 'center' }}>
          <Link to="/forgot-password" className="btn btn--soft btn--sm">
            Сменить пароль
          </Link>
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
    </div>
  )
}
