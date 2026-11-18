import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Api } from '../../api/endpoints'
import { errorText } from '../../api/client'
import { EMAIL_RE, TextField } from '../../components/forms/Fields'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email.trim())) return setErr('Введите корректную почту')
    setBusy(true)
    setErr('')
    try {
      await Api.resetRequest(email.trim())
      setSent(true)
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth__card panel" onSubmit={submit} noValidate>
        <h1>Восстановление пароля</h1>
        {sent ? (
          <>
            <p className="form-ok">Если такая почта зарегистрирована, мы отправили на неё ссылку. Ссылка действует 15 минут.</p>
            <Link to="/login" className="btn btn--solid btn--block">
              Вернуться ко входу
            </Link>
          </>
        ) : (
          <>
            <p className="auth__note">Введите почту — пришлём ссылку для создания нового пароля.</p>
            <TextField
              icon={<Mail size={18} />}
              type="email"
              autoComplete="email"
              placeholder="Почта"
              aria-label="Почта"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {err && <p className="form-error">{err}</p>}
            <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
              {busy ? 'Отправляем…' : 'Отправить ссылку'}
            </button>
            <Link to="/login" className="auth__forgot auth__forgot--center">
              Вспомнили пароль? Войти
            </Link>
          </>
        )}
      </form>
    </div>
  )
}
