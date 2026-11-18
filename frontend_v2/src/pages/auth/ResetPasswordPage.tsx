import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Api } from '../../api/endpoints'
import { errorText } from '../../api/client'
import { PasswordField } from '../../components/forms/Fields'

// Сюда ведёт ссылка из письма: /reset-password?token=…
export default function ResetPasswordPage() {
  const [sp] = useSearchParams()
  const token = sp.get('token') ?? ''
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (p1.length < 8) return setErr('Пароль — не менее 8 символов')
    if (p1 !== p2) return setErr('Пароли не совпадают')
    setBusy(true)
    setErr('')
    try {
      await Api.resetConfirm(token, p1)
      setDone(true)
    } catch (e) {
      setErr(errorText(e) || 'Ссылка недействительна или устарела')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth__card panel" onSubmit={submit} noValidate>
        <h1>Новый пароль</h1>
        {!token ? (
          <>
            <p className="form-error">В ссылке нет кода восстановления. Запросите письмо ещё раз.</p>
            <Link to="/forgot-password" className="btn btn--solid btn--block">
              Запросить снова
            </Link>
          </>
        ) : done ? (
          <>
            <p className="form-ok">Пароль изменён. Теперь можно войти с новым паролем.</p>
            <Link to="/login" className="btn btn--solid btn--block">
              Войти
            </Link>
          </>
        ) : (
          <>
            <PasswordField icon={<Lock size={18} />} autoComplete="new-password" placeholder="Новый пароль" aria-label="Новый пароль" value={p1} onChange={(e) => setP1(e.target.value)} />
            <PasswordField icon={<Lock size={18} />} autoComplete="new-password" placeholder="Повторите пароль" aria-label="Повторите пароль" value={p2} onChange={(e) => setP2(e.target.value)} />
            {err && <p className="form-error">{err}</p>}
            <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
              {busy ? 'Сохраняем…' : 'Сохранить пароль'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
