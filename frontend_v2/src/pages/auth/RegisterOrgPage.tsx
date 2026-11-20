import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, MapPin, Trash2 } from 'lucide-react'
import { Api } from '../../api/endpoints'
import type { Messenger, OrganizationInput, OrganizationType } from '../../api/types'
import { errorText } from '../../api/client'
import { useAuth } from '../../state/auth'
import { EMAIL_RE, PasswordField, SelectField, TextField } from '../../components/forms/Fields'
import { CityDistrict } from '../../components/forms/CityDistrict'
import { PhotoPicker } from '../../components/forms/PhotoPicker'
import { MapView } from '../../components/MapView'
import { compressImage } from '../../lib/imageCheck'
import { ORG_TYPES } from '../../lib/owner'
import { normalizePhone } from '../../lib/format'
import { type DraftBranch, fileToDataUrl, orgDraft, pendingEmail } from '../../lib/pending'

interface Addr {
  name: string
  city: string
  district: string
  street: string
  house: string
  lat: number | null
  lng: number | null
}
const emptyAddr = (): Addr => ({ name: '', city: '', district: '', street: '', house: '', lat: null, lng: null })

/**
 * Регистрация организации — только данные САМОЙ организации (секций у неё может быть несколько,
 * их владелец добавит потом в «Моих анкетах»).
 * После регистрации бэк просит подтвердить почту (202), сессии ещё нет — поэтому профиль
 * организации, адреса и обложку держим черновиком в браузере и сохраняем после первого входа (OrgDraftSync).
 */
export default function RegisterOrgPage() {
  const { signIn } = useAuth()
  const nav = useNavigate()

  const [kind, setKind] = useState<'activity' | 'service'>('activity')
  const [f, setF] = useState({
    email: '',
    password: '',
    orgType: '' as OrganizationType | '',
    orgName: '',
    description: '',
    phone: '+373 ',
    website: '',
    instagram: '',
    telegram: '',
    viber: '',
    whatsapp: '',
  })
  const [addrs, setAddrs] = useState<Addr[]>([emptyAddr()])
  const [cover, setCover] = useState<File[]>([])
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value })
  const setAddr = (i: number, patch: Partial<Addr>) => setAddrs(addrs.map((x, k) => (k === i ? { ...x, ...patch } : x)))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'Введите корректную почту'
    if (f.password.length < 8) e.password = 'Минимум 8 символов'
    else if (new TextEncoder().encode(f.password).length > 256) e.password = 'Слишком длинный пароль'
    if (!f.orgType) e.orgType = 'Выберите тип'
    if (!f.orgName.trim()) e.orgName = 'Введите название'
    else if (new TextEncoder().encode(f.orgName.trim()).length > 200) e.orgName = 'Слишком длинное название'
    if (!normalizePhone(f.phone)) e.phone = 'Формат: +373 777 12345'
    if (f.website.trim() && !/^https:\/\/\S+\.\S+/.test(f.website.trim())) e.website = 'Адрес должен начинаться с https://'
    addrs.forEach((a, i) => {
      if (!a.city) e[`city${i}`] = 'Выберите город'
      if (!a.street.trim()) e[`street${i}`] = 'Укажите улицу'
      if (!a.house.trim()) e[`house${i}`] = 'Укажите дом'
    })
    if (!agree) e.agree = 'Нужно согласие с политикой сайта'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return setErr('Проверьте поля, отмеченные красным')
    setErr('')
    const email = f.email.trim()
    const messengers: Messenger[] = (
      [
        ['instagram', f.instagram],
        ['telegram', f.telegram],
        ['viber', f.viber],
        ['whatsapp', f.whatsapp],
      ] as const
    )
      .filter(([, v]) => v.trim())
      .map(([channel, contact]) => ({ channel, contact: contact.trim() }))
    const org: OrganizationInput = {
      name: f.orgName.trim(),
      organization_type: f.orgType as OrganizationType,
      description: f.description.trim() || null,
      phone: normalizePhone(f.phone)!,
      email,
      website: f.website.trim() || null,
      city_id: Number(addrs[0].city),
      district_id: Number(addrs[0].district || 0),
      messengers,
    }
    const branches: DraftBranch[] = addrs.map((a, i) => ({
      name: a.name.trim() || (i === 0 ? 'Основной адрес' : `Филиал ${i}`),
      city_id: a.city,
      district_id: a.district || null,
      address: `${a.street.trim()}, ${a.house.trim()}`,
      lat: a.lat,
      lng: a.lng,
    }))

    setBusy(true)
    try {
      const coverUrl = cover[0] ? await fileToDataUrl(await compressImage(cover[0], 1600)) : undefined
      // черновик сохраняем ДО запроса: если письмо уйдёт, а вкладку закроют — данные не пропадут
      orgDraft.set({ email: email.toLowerCase(), org, branches, cover: coverUrl })
      const r = await Api.register({
        email,
        password: f.password,
        name: f.orgName.trim().slice(0, 120),
        account_type: kind === 'service' ? 'service_owner' : 'section_owner',
      })
      if ('token' in r) {
        signIn(r) // старый API без подтверждения почты: профиль сохранит OrgDraftSync
        nav('/my', { replace: true })
      } else {
        pendingEmail.set(r.email)
        nav('/check-email', { replace: true, state: { email: r.email, demoLink: r.demo_link } })
      }
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="org-reg narrow" onSubmit={submit} noValidate>
      <section className="panel card-form">
        <h1>Анкета организации</h1>
        <p className="auth__note">
          Здесь — только данные организации. Секции и услуги (их может быть несколько) вы добавите после входа в разделе «Мои анкеты».
        </p>
        <div className="grid-2">
          <TextField label="Почта" required icon={<Mail size={18} />} type="email" autoComplete="email" placeholder="Введите почту" value={f.email} onChange={set('email')} error={errors.email} />
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
          <TextField label="Название организации" required placeholder="Введите название организации" value={f.orgName} onChange={set('orgName')} error={errors.orgName} />
          <SelectField label="Тип организации" required value={f.orgType} onChange={set('orgType')} error={errors.orgType}>
            <option value="">Школа, студия, частный мастер…</option>
            {ORG_TYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <div className="field span-2">
            <span className="field-label">Что вы предлагаете *</span>
            <div className="row row--wrap" style={{ gap: 24 }}>
              <label className="check">
                <input type="radio" name="kind" checked={kind === 'activity'} onChange={() => setKind('activity')} />
                Секции и занятия
              </label>
              <label className="check">
                <input type="radio" name="kind" checked={kind === 'service'} onChange={() => setKind('service')} />
                Услуги
              </label>
            </div>
          </div>
          <div className="field span-2">
            <span className="field-label">Обложка организации</span>
            <PhotoPicker files={cover} onChange={setCover} max={1} />
          </div>
          <div className="field span-2">
            <label className="field-label" htmlFor="org-desc">
              Описание
            </label>
            <textarea id="org-desc" className="textarea" placeholder="Расскажите об организации и её деятельности" value={f.description} onChange={set('description')} />
          </div>
        </div>
      </section>

      <section className="panel card-form">
        <h2>Адреса и филиалы</h2>
        <p className="auth__note">Поставьте метку на карте — по ней вас найдут в разделе «Карта» и в поиске «Рядом со мной».</p>
        {addrs.map((a, i) => (
          <div key={i} className="org-reg__addr">
            <div className="row org-reg__addr-head">
              <b>{i === 0 ? 'Основной адрес' : `Филиал ${i}`}</b>
              {i > 0 && (
                <button type="button" className="link-btn" onClick={() => setAddrs(addrs.filter((_, k) => k !== i))}>
                  <Trash2 size={14} /> Убрать
                </button>
              )}
            </div>
            <div className="grid-2">
              {i > 0 && (
                <TextField
                  label="Название филиала"
                  className="span-2"
                  placeholder="Например: зал на Балке"
                  value={a.name}
                  onChange={(e) => setAddr(i, { name: e.target.value })}
                />
              )}
              <CityDistrict required city={a.city} district={a.district} onChange={(city, district) => setAddr(i, { city, district })} errors={{ city: errors[`city${i}`] }} />
              <TextField label="Улица" required placeholder="Укажите название улицы" value={a.street} onChange={(e) => setAddr(i, { street: e.target.value })} error={errors[`street${i}`]} />
              <TextField label="Дом" required placeholder="Укажите номер дома" value={a.house} onChange={(e) => setAddr(i, { house: e.target.value })} error={errors[`house${i}`]} />
            </div>
            <div className="pin-pick">
              <div className="pin-pick__head">
                <MapPin size={16} />
                {a.lat != null ? (
                  <span>
                    Метка стоит. Чтобы поправить — нажмите на карте в другом месте.{' '}
                    <button type="button" className="link-btn" onClick={() => setAddr(i, { lat: null, lng: null })}>
                      Убрать метку
                    </button>
                  </span>
                ) : (
                  <span>Нажмите на карте, где находится {i === 0 ? 'организация' : 'филиал'}</span>
                )}
              </div>
              <MapView
                className="pin-pick__map"
                zoom={a.lat != null ? 16 : 12}
                points={a.lat != null && a.lng != null ? [{ id: `a${i}`, lat: a.lat, lng: a.lng }] : []}
                onPick={([lat, lng]) => setAddr(i, { lat: +lat.toFixed(6), lng: +lng.toFixed(6) })}
              />
            </div>
          </div>
        ))}
        <button type="button" className="btn btn--soft btn--block btn--lg org-reg__branch" onClick={() => setAddrs([...addrs, emptyAddr()])}>
          + Добавить филиал
        </button>
      </section>

      <section className="panel card-form">
        <h2>Контакты</h2>
        <div className="grid-2">
          <TextField label="Телефон" required type="tel" autoComplete="tel" placeholder="+373 777 12345" value={f.phone} onChange={set('phone')} error={errors.phone} />
          <TextField label="Ссылка на сайт" type="url" placeholder="https://" value={f.website} onChange={set('website')} error={errors.website} />
          <TextField label="Instagram" placeholder="https://instagram.com/" value={f.instagram} onChange={set('instagram')} />
          <TextField label="Telegram" placeholder="https://t.me/" value={f.telegram} onChange={set('telegram')} />
          <TextField label="Viber" placeholder="Номер или ссылка на Viber" value={f.viber} onChange={set('viber')} />
          <TextField label="WhatsApp" placeholder="Номер WhatsApp" value={f.whatsapp} onChange={set('whatsapp')} />
        </div>
      </section>

      <section className="panel card-form org-reg__final">
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          Я соглашаюсь с{' '}
          <Link to="/terms" target="_blank">
            политикой сайта
          </Link>
        </label>
        {errors.agree && <span className="field-error">{errors.agree}</span>}
        {err && <p className="form-error">{err}</p>}
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={busy}>
          {busy ? 'Отправляем…' : 'Зарегистрироваться'}
        </button>
        <p className="auth__alt">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </section>
    </form>
  )
}
