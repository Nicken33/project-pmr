import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Api } from '../../api/endpoints'
import { errorText } from '../../api/client'
import { pendingEmail } from '../../lib/pending'
import { EMAIL_RE, TextField } from '../../components/forms/Fields'

const PAUSE = 60 // сек между письмами (так же ограничивает бэк)

/** «Проверьте почту» — после регистрации (202 needs_email_verification). Входа ещё нет. */
export default function CheckEmailPage() {
  const loc = useLocation()
  const st = (loc.state ?? {}) as { email?: string; demoLink?: string }
  const known = st.email || pendingEmail.get()
  const [email, setEmail] = useState(known)
  const [left, setLeft] = useState(PAUSE)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  const resend = async () => {
    if (!EMAIL_RE.test(email.trim())) return setErr('Введите почту, указанную при регистрации')
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const r = await Api.resendVerification(email.trim())
      setMsg(r.message || 'Если регистрация ждёт подтверждения, письмо отправлено')
      setLeft(PAUSE)
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card panel verify">
        <MailCheck size={44} className="verify__icon" />
        <h1>Проверьте почту</h1>
        {known ? (
          <p className="verify__text">
            Мы отправили письмо на <b>{known}</b>. Откройте его и нажмите «Подтвердить почту», затем войдите с паролем.
          </p>
        ) : (
          <p className="verify__text">Мы отправили письмо со ссылкой. Откройте его и подтвердите почту, затем войдите с паролем.</p>
        )}
        <p className="auth__note">Письма нет? Загляните в папку «Спам». Ссылка действует 15 минут.</p>
        {st.demoLink && (
          <Link to={st.demoLink} className="btn btn--soft btn--block">
            Демо: открыть ссылку из письма
          </Link>
        )}
        {msg && <p className="form-ok">{msg}</p>}
        {err && <p className="form-error">{err}</p>}
        {!known && (
          <TextField label="Почта, указанная при регистрации" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
        {(
          <button type="button" className="btn btn--outline btn--block" disabled={busy || (!!known && left > 0)} onClick={resend}>
            {busy ? 'Отправляем…' : known && left > 0 ? `Отправить ещё раз через ${left} с` : 'Отправить письмо ещё раз'}
          </button>
        )}
        <Link to="/login" className="btn btn--solid btn--block">
          Перейти ко входу
        </Link>
        <p className="auth__alt">
          Ошиблись в адресе? <Link to="/register">Зарегистрироваться заново</Link>
        </p>
      </div>
    </div>
  )
}
