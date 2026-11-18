import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, Trash2 } from 'lucide-react'
import { Api } from '../../api/endpoints'
import type { LocationInput, Messenger } from '../../api/types'
import { errorText } from '../../api/client'
import { useAuth } from '../../state/auth'
import { useRefs } from '../../state/refs'
import { useToast } from '../../state/toast'
import { EMAIL_RE, PasswordField, SelectField, TextField } from '../../components/forms/Fields'
import { CityDistrict } from '../../components/forms/CityDistrict'
import { PhotoPicker } from '../../components/forms/PhotoPicker'
import { compressImage } from '../../lib/imageCheck'
import { AvatarPicker } from '../../components/forms/AvatarPicker'
import { Planned } from '../../api/planned'
import { hasFeature } from '../../features'
import { ORG_TYPES, flatDirections } from '../../lib/owner'
import { normalizePhone } from '../../lib/format'
import type { OrganizationType } from '../../api/types'

interface Addr {
  city: string
  district: string
  street: string
  house: string
}
const emptyAddr: Addr = { city: '', district: '', street: '', house: '' }

/**
 * Регистрация организации = несколько запросов к API подряд:
 * 1) регистрация аккаунта владельца, 2) профиль организации,
 * 3) черновик первой анкеты с адресами, 4) загрузка фото.
 * Дальше владелец дозаполняет группы и расписание в редакторе анкеты.
 */
export default function RegisterOrgPage() {
  const { signIn } = useAuth()
  const { categories } = useRefs()
  const toast = useToast()
  const nav = useNavigate()

  const [kind, setKind] = useState<'activity' | 'service'>('activity')
  const [f, setF] = useState({
    email: '',
    password: '',
    orgType: '' as OrganizationType | '',
    orgName: '',
    sectionName: '',
    direction: '',
    description: '',
    phone: '+373 ',
    website: '',
    instagram: '',
    telegram: '',
    viber: '',
    whatsapp: '',
  })
  const [addrs, setAddrs] = useState<Addr[]>([{ ...emptyAddr }])
  const [photos, setPhotos] = useState<File[]>([])
  const [logo, setLogo] = useState<File | null>(null)
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [step, setStep] = useState('')

  const directions = useMemo(() => flatDirections(categories, kind), [categories, kind])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!EMAIL_RE.test(f.email.trim())) e.email = 'Введите корректную почту'
    if (f.password.length < 8) e.password = 'Минимум 8 символов'
    if (!f.orgType) e.orgType = 'Выберите тип'
    if (!f.orgName.trim()) e.orgName = 'Введите название'
    if (!f.sectionName.trim()) e.sectionName = 'Введите название'
    if (!f.direction) e.direction = 'Выберите направление'
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
    if (!validate()) {
      setErr('Проверьте поля, отмеченные красным')
      return
    }
    setErr('')
    const phone = normalizePhone(f.phone)!
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

    let registered = false
    try {
      setStep('Создаём аккаунт…')
      const t = await Api.register({
        email: f.email.trim(),
        password: f.password,
        name: f.orgName.trim().slice(0, 120),
        account_type: kind === 'service' ? 'service_owner' : 'section_owner',
      })
      signIn(t)
      registered = true

      setStep('Сохраняем организацию…')
      await Api.saveOrganization({
        name: f.orgName.trim(),
        organization_type: f.orgType as OrganizationType,
        description: f.description.trim() || null,
        phone,
        email: f.email.trim(),
        website: f.website.trim() || null,
        city_id: Number(addrs[0].city),
        district_id: Number(addrs[0].district || 0),
        messengers,
      })

      if (logo && hasFeature('org_logo')) await Planned.uploadOrgLogo(await compressImage(logo, 512)).catch(() => {})

      setStep('Создаём анкету…')
      const locations: LocationInput[] = addrs.map((a, i) => ({
        key: `addr-${i + 1}`,
        name: i === 0 ? 'Основной адрес' : `Филиал ${i}`,
        city_id: a.city,
        district_id: a.district || null,
        address: `${a.street.trim()}, ${a.house.trim()}`,
        latitude: null,
        longitude: null,
        phone,
        source_type: 'person',
        source_url: null,
      }))
      const created = await Api.createActivity({
        name: f.sectionName.trim(),
        description: f.description.trim() || null,
        record_type: kind,
        direction_id: f.direction,
        class_type: kind === 'service' ? null : 'group',
        class_format: 'offline',
        phone,
        locations,
        groups: [],
      })

      for (let i = 0; i < photos.length; i++) {
        setStep(`Загружаем фото ${i + 1} из ${photos.length}…`)
        try {
          await Api.uploadPhoto(created.id, await compressImage(photos[i]))
        } catch (e) {
          toast(`Фото «${photos[i].name}» не загрузилось: ${errorText(e)}`, 'error')
        }
      }

      toast('Организация зарегистрирована! Добавьте группы и расписание и отправьте анкету на проверку', 'success')
      nav(`/my/${created.id}/edit`, { replace: true })
    } catch (e) {
      setErr(errorText(e))
      // аккаунт уже создан — продолжим из кабинета, повторная регистрация вернула бы «почта занята»
      if (registered) {
        toast('Аккаунт создан, но не всё сохранилось. Продолжите в кабинете', 'error')
        nav('/my', { replace: true })
      }
    } finally {
      setStep('')
    }
  }

  return (
    <form className="org-reg narrow" onSubmit={submit} noValidate>
      <section className="panel card-form">
        <h1>Анкета организации</h1>
        <div className="grid-2">
          <TextField label="Почта" required icon={<Mail size={18} />} type="email" autoComplete="email" placeholder="Введите почту" value={f.email} onChange={set('email')} error={errors.email} />
          <PasswordField label="Пароль" required icon={<Lock size={18} />} autoComplete="new-password" placeholder="Введите пароль" value={f.password} onChange={set('password')} error={errors.password} />
          <SelectField label="Тип организации" required value={f.orgType} onChange={set('orgType')} error={errors.orgType}>
            <option value="">Школа, студия, частный мастер…</option>
            {ORG_TYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Название организации" required placeholder="Введите название организации" value={f.orgName} onChange={set('orgName')} error={errors.orgName} />
          <div className="field span-2">
            <span className="field-label">Что вы предлагаете *</span>
            <div className="row row--wrap" style={{ gap: 24 }}>
              <label className="check">
                <input type="radio" name="kind" checked={kind === 'activity'} onChange={() => (setKind('activity'), setF({ ...f, direction: '' }))} />
                Секции и занятия
              </label>
              <label className="check">
                <input type="radio" name="kind" checked={kind === 'service'} onChange={() => (setKind('service'), setF({ ...f, direction: '' }))} />
                Услуги
              </label>
            </div>
          </div>
          <TextField
            label="Название секции / услуги"
            required
            className="span-2"
            placeholder="Введите название секции или услуги"
            value={f.sectionName}
            onChange={set('sectionName')}
            error={errors.sectionName}
          />
          <SelectField label="Направление" required className="span-2" value={f.direction} onChange={set('direction')} error={errors.direction}>
            <option value="">Выберите направление</option>
            {directions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </SelectField>
          <div className="span-2 oreg-media">
            <div className="field">
              <span className="field-label">Фото обложки</span>
              <PhotoPicker files={photos} onChange={setPhotos} />
            </div>
            <div className="field oreg-media__logo">
              <span className="field-label">Логотип</span>
              <AvatarPicker file={logo} onChange={setLogo} feature="org_logo" caption="Добавить логотип" />
            </div>
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
        <h2>Адреса и контакты</h2>
        {addrs.map((a, i) => (
          <div key={i} className="org-reg__addr">
            {i > 0 && (
              <div className="row org-reg__addr-head">
                <b>Филиал {i}</b>
                <button type="button" className="link-btn" onClick={() => setAddrs(addrs.filter((_, k) => k !== i))}>
                  <Trash2 size={14} /> Убрать
                </button>
              </div>
            )}
            <div className="grid-2">
              <CityDistrict
                required
                city={a.city}
                district={a.district}
                onChange={(city, district) => setAddrs(addrs.map((x, k) => (k === i ? { ...x, city, district } : x)))}
                errors={{ city: errors[`city${i}`] }}
              />
              <TextField
                label="Улица"
                required
                placeholder="Укажите название улицы"
                value={a.street}
                onChange={(e) => setAddrs(addrs.map((x, k) => (k === i ? { ...x, street: e.target.value } : x)))}
                error={errors[`street${i}`]}
              />
              <TextField
                label="Дом"
                required
                placeholder="Укажите номер дома"
                value={a.house}
                onChange={(e) => setAddrs(addrs.map((x, k) => (k === i ? { ...x, house: e.target.value } : x)))}
                error={errors[`house${i}`]}
              />
            </div>
          </div>
        ))}
        <div className="grid-2" style={{ marginTop: 14 }}>
          <TextField label="Телефон" required type="tel" autoComplete="tel" placeholder="+373 777 12345" value={f.phone} onChange={set('phone')} error={errors.phone} />
          <TextField label="Ссылка на сайт" type="url" placeholder="https://" value={f.website} onChange={set('website')} error={errors.website} />
          <TextField label="Instagram" placeholder="https://instagram.com/" value={f.instagram} onChange={set('instagram')} />
          <TextField label="Telegram" placeholder="https://t.me/" value={f.telegram} onChange={set('telegram')} />
          <TextField label="Viber" placeholder="Номер или ссылка на Viber" value={f.viber} onChange={set('viber')} />
          <TextField label="WhatsApp" placeholder="Номер WhatsApp" value={f.whatsapp} onChange={set('whatsapp')} />
        </div>
        <button type="button" className="btn btn--soft btn--block btn--lg org-reg__branch" onClick={() => setAddrs([...addrs, { ...emptyAddr }])}>
          + Добавить филиал
        </button>
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
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={!!step}>
          {step || 'Зарегистрироваться'}
        </button>
        <p className="auth__alt">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </section>
    </form>
  )
}
