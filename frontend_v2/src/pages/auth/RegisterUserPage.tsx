import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, UserRound } from 'lucide-react'
import { Api } from '../../api/endpoints'
import { errorText } from '../../api/client'
import { useAuth } from '../../state/auth'
import { EMAIL_RE, PasswordField, TextField } from '../../components/forms/Fields'
import { AvatarPicker } from '../../components/forms/AvatarPicker'
import { Planned } from '../../api/planned'
import { hasFeature } from '../../features'
import { compressImage } from '../../lib/imageCheck'

export default function RegisterUserPage() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ email: '', password: '', name: '' })
  const [avatar, setAvatar] = useState<File | null>(null)
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'Введите корректную почту'
    if (f.password.length < 8) e.password = 'Минимум 8 символов'
    else if (f.password.length > 256) e.password = 'Слишком длинный пароль'
    if (!f.name.trim()) e.name = 'Введите имя или логин'
    else if (f.name.trim().length > 120) e.name = 'Не длиннее 120 символов'
    if (!agree) e.agree = 'Нужно согласие с условиями пользования'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setBusy(true)
    setErr('')
    try {
      const t = await Api.register({ email: f.email.trim(), password: f.password, name: f.name.trim(), account_type: 'user' })
      signIn(t)
      if (avatar && hasFeature('avatar')) await Planned.uploadAvatar(await compressImage(avatar, 512)).catch(() => {})
      nav('/', { replace: true })
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <div className="auth">
      <form className="auth__card auth__card--ureg panel" onSubmit={submit} noValidate>
        <h1>Анкета пользователя</h1>
        <div className="ureg">
          <div className="ureg__fields">
        <TextField
          label="Почта"
          required
          icon={<Mail size={18} />}
          type="email"
          autoComplete="email"
          placeholder="Введите почту"
          value={f.email}
          onChange={set('email')}
          error={errors.email}
        />
        <PasswordField
          label="Пароль"
          required
          icon={<Lock size={18} />}
          autoComplete="new-password"
          placeholder="Введите пароль"
          value={f.password}
          onChange={set('password')}
          error={errors.password}
          hint="Не менее 8 символов"
        />
        <TextField
          label="Имя / логин"
          required
          icon={<UserRound size={18} />}
          autoComplete="nickname"
          placeholder="Введите имя или логин"
          value={f.name}
          onChange={set('name')}
          error={errors.name}
        />
          </div>
          <div className="ureg__avatar">
            <span className="field-label">Аватар</span>
            <AvatarPicker file={avatar} onChange={setAvatar} feature="avatar" caption="Добавьте фото или картинку" />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            Я соглашаюсь с{' '}
            <Link to="/terms" target="_blank">
              условиями пользования
            </Link>
          </span>
        </label>
        {errors.agree && <span className="field-error">{errors.agree}</span>}
        {err && <p className="form-error">{err}</p>}
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Регистрируем…' : 'Зарегистрироваться'}
        </button>
        <p className="auth__alt">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </div>
  )
}
