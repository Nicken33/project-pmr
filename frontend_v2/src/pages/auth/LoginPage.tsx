import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { Api } from '../../api/endpoints'
import type { AuthToken } from '../../api/types'
import { errorText } from '../../api/client'
import { useAuth } from '../../state/auth'
import { EMAIL_RE, PasswordField, TextField } from '../../components/forms/Fields'
import { GoogleButton } from '../../components/forms/GoogleButton'

export default function LoginPage() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const done = (t: AuthToken) => {
    signIn(t)
    nav(from, { replace: true })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return setErr('Введите корректную почту')
    if (!password) return setErr('Введите пароль')
    setBusy(true)
    setErr('')
    try {
      done(await Api.login({ email: email.trim(), password }))
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth__card panel" onSubmit={submit} noValidate>
        <div className="auth__tabs">
          <span className="btn btn--solid">Вход</span>
          <Link to="/register" className="btn btn--soft">
            Регистрация
          </Link>
        </div>
        <TextField
          icon={<Mail size={18} />}
          type="email"
          autoComplete="email"
          placeholder="Почта"
          aria-label="Почта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          icon={<Lock size={18} />}
          autoComplete="current-password"
          placeholder="Пароль"
          aria-label="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Link to="/forgot-password" className="auth__forgot">
          Забыли пароль?
        </Link>
        {err && <p className="form-error">{err}</p>}
        <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
        <span className="auth__or">или</span>
        <GoogleButton onDone={done} onError={setErr} />
      </form>
    </div>
  )
}
