import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Api } from '../../api/endpoints'
import { ApiError, errorText } from '../../api/client'
import { pendingEmail } from '../../lib/pending'

/**
 * Сюда ведёт ссылка из письма: /verify-email?token=…
 * Подтверждаем только по кнопке (POST), чтобы предпросмотр письма или сканер ссылок не создал аккаунт.
 * Токен не сохраняем никуда и убираем из адресной строки после ответа сервера.
 */
export default function VerifyEmailPage() {
  const [sp] = useSearchParams()
  const [token] = useState(() => sp.get('token') ?? '')
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle')
  const [err, setErr] = useState('')
  const [taken, setTaken] = useState(false)

  // не передаём адрес с токеном на внешние сайты
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'referrer'
    m.content = 'no-referrer'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])

  const confirm = async () => {
    if (state === 'busy') return
    setState('busy')
    setErr('')
    try {
      await Api.verifyEmail(token)
      pendingEmail.clear()
      setState('ok')
    } catch (e) {
      setTaken(e instanceof ApiError && e.code === 'email_taken')
      setErr(errorText(e))
      setState('error')
    } finally {
      window.history.replaceState(null, '', '/verify-email') // токен больше не нужен
    }
  }

  return (
    <div className="auth">
      <div className="auth__card panel verify">
        <MailCheck size={44} className="verify__icon" />
        <h1>Подтверждение почты</h1>
        {state === 'ok' ? (
          <>
            <p className="form-ok">Почта подтверждена, аккаунт создан. Теперь войдите с паролем.</p>
            <Link to="/login" className="btn btn--solid btn--block">
              Войти
            </Link>
          </>
        ) : !token && state === 'idle' ? (
          <>
            <p className="form-error">В ссылке нет кода подтверждения. Откройте ссылку из письма ещё раз.</p>
            <Link to="/login" className="btn btn--solid btn--block">
              Перейти ко входу
            </Link>
          </>
        ) : state === 'error' ? (
          <>
            <p className="form-error">{err}</p>
            {taken ? (
              <Link to="/login" className="btn btn--solid btn--block">
                Войти
              </Link>
            ) : (
              <>
                <Link to="/check-email" className="btn btn--solid btn--block">
                  Отправить новое письмо
                </Link>
                <Link to="/login" className="btn btn--soft btn--block">
                  Уже подтвердили? Войти
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            <p className="verify__text">Нажмите кнопку, чтобы подтвердить почту и создать аккаунт.</p>
            <button type="button" className="btn btn--solid btn--block btn--lg" disabled={state === 'busy'} onClick={confirm}>
              {state === 'busy' ? 'Подтверждаем…' : 'Подтвердить почту'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
