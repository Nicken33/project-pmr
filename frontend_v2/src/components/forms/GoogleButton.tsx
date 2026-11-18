import { useState } from 'react'
import { Api } from '../../api/endpoints'
import type { AccountType, AuthToken } from '../../api/types'
import { errorText } from '../../api/client'
import { getGoogleAccessToken, googleEnabled } from '../../lib/google'
import googleIcon from '../../assets/social/google.svg'

const TYPES: { v: AccountType; label: string }[] = [
  { v: 'user', label: 'Пользователь — ищу занятия' },
  { v: 'section_owner', label: 'Организация — веду секции и занятия' },
  { v: 'service_owner', label: 'Организация — оказываю услуги' },
]

/** Кнопка «Войти через Google». Новому аккаунту бэк просит выбрать тип — показываем выбор. */
export function GoogleButton({ onDone, onError }: { onDone: (t: AuthToken) => void; onError: (msg: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ token: string; email: string } | null>(null)

  const finish = async (credential: string, account_type?: AccountType) => {
    const r = await Api.google({ credential, account_type })
    if ('needs_account_type' in r) setPending({ token: credential, email: r.email })
    else onDone(r)
  }

  const start = async () => {
    // кнопка есть всегда (как в макете); без VITE_GOOGLE_CLIENT_ID вход через Google недоступен
    if (!googleEnabled()) return onError('Вход через Google пока не настроен')
    setBusy(true)
    try {
      await finish(await getGoogleAccessToken())
    } catch (e) {
      onError(e instanceof Error && !('code' in e) ? e.message : errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (pending)
    return (
      <div className="gchoice">
        <p>
          Новый аккаунт <b>{pending.email}</b>. Кто вы?
        </p>
        {TYPES.map((t) => (
          <button
            key={t.v}
            type="button"
            className="btn btn--outline btn--block"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await finish(pending.token, t.v)
              } catch (e) {
                const expired = e instanceof Error && 'code' in e && ['invalid_google_token', 'invalid_credential'].includes((e as { code: string }).code)
                if (expired) setPending(null)
                onError(expired ? 'Сессия Google истекла — нажмите «Войти через Google» ещё раз' : errorText(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    )

  return (
    <button type="button" className="btn btn--outline btn--block gbtn" onClick={start} disabled={busy}>
      <img src={googleIcon} alt="" width={16} height={16} /> Войти через Google
    </button>
  )
}
