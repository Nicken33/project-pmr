import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Api } from '../../api/endpoints'
import type { Messenger, OrganizationType } from '../../api/types'
import { ApiError, errorText } from '../../api/client'
import { useToast } from '../../state/toast'
import { EMAIL_RE, SelectField, TextField } from '../../components/forms/Fields'
import { CityDistrict } from '../../components/forms/CityDistrict'
import { ORG_TYPES } from '../../lib/owner'
import { normalizePhone } from '../../lib/format'

const CHANNELS: { k: Messenger['channel']; label: string; ph: string }[] = [
  { k: 'instagram', label: 'Instagram', ph: 'https://instagram.com/' },
  { k: 'telegram', label: 'Telegram', ph: 'https://t.me/' },
  { k: 'viber', label: 'Viber', ph: 'Номер или ссылка' },
  { k: 'whatsapp', label: 'WhatsApp', ph: 'Номер WhatsApp' },
]

export default function OrganizationEditPage() {
  const toast = useToast()
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [exists, setExists] = useState(false)
  const [f, setF] = useState({
    name: '',
    type: '' as OrganizationType | '',
    description: '',
    phone: '+373 ',
    email: '',
    website: '',
    city: '',
    district: '',
  })
  const [msg, setMsg] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Api.myOrganization()
      .then((o) => {
        setExists(true)
        setF({
          name: o.name,
          type: o.type,
          description: o.description ?? '',
          phone: o.phone,
          email: o.email ?? '',
          website: o.website ?? '',
          city: o.city_id ?? '',
          district: '',
        })
        setMsg(Object.fromEntries((o.messengers ?? []).map((m) => [m.channel, m.contact])))
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 404)) setErr(errorText(e))
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = 'Введите название'
    if (!f.type) e.type = 'Выберите тип'
    if (!normalizePhone(f.phone)) e.phone = 'Формат: +373 777 12345'
    if (!f.city) e.city = 'Выберите город'
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Некорректная почта'
    if (f.website.trim() && !f.website.trim().startsWith('https://')) e.website = 'Адрес должен начинаться с https://'
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    setErr('')
    try {
      await Api.saveOrganization({
        name: f.name.trim(),
        organization_type: f.type as OrganizationType,
        description: f.description.trim() || null,
        phone: normalizePhone(f.phone)!,
        email: f.email.trim() || null,
        website: f.website.trim() || null,
        city_id: Number(f.city),
        district_id: Number(f.district || 0),
        messengers: CHANNELS.filter((c) => msg[c.k]?.trim()).map((c) => ({ channel: c.k, contact: msg[c.k].trim() })),
      })
      toast('Профиль организации сохранён', 'success')
      if (!exists) nav('/my')
      setExists(true)
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="spinner" />

  return (
    <form className="narrow panel card-form" onSubmit={save} noValidate style={{ marginTop: 8 }}>
      <h1>Профиль организации</h1>
      <div className="grid-2">
        <TextField label="Название организации" required value={f.name} onChange={set('name')} error={errors.name} />
        <SelectField label="Тип организации" required value={f.type} onChange={set('type')} error={errors.type}>
          <option value="">Выберите тип</option>
          {ORG_TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <CityDistrict required city={f.city} district={f.district} onChange={(city, district) => setF({ ...f, city, district })} errors={{ city: errors.city }} />
        <TextField label="Телефон" required type="tel" placeholder="+373 777 12345" value={f.phone} onChange={set('phone')} error={errors.phone} />
        <TextField label="Почта организации" type="email" value={f.email} onChange={set('email')} error={errors.email} />
        <TextField label="Сайт" className="span-2" type="url" placeholder="https://" value={f.website} onChange={set('website')} error={errors.website} />
        {CHANNELS.map((c) => (
          <TextField key={c.k} label={c.label} placeholder={c.ph} value={msg[c.k] ?? ''} onChange={(e) => setMsg({ ...msg, [c.k]: e.target.value })} />
        ))}
        <div className="field span-2">
          <label className="field-label" htmlFor="org-d">
            Описание
          </label>
          <textarea id="org-d" className="textarea" value={f.description} onChange={set('description')} placeholder="Расскажите об организации и её деятельности" />
        </div>
      </div>
      {err && <p className="form-error" style={{ marginTop: 14 }}>{err}</p>}
      <button type="submit" className="btn btn--primary btn--block btn--lg" style={{ marginTop: 18 }} disabled={busy}>
        {busy ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </form>
  )
}
