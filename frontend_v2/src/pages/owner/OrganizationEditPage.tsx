import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Api } from '../../api/endpoints'
import type { Messenger, OrganizationType } from '../../api/types'
import { ApiError, errorText } from '../../api/client'
import { useToast } from '../../state/toast'
import { EMAIL_RE, SelectField, TextField } from '../../components/forms/Fields'
import { ORG_TYPES } from '../../lib/owner'
import { normalizePhone } from '../../lib/format'
import { PhotoPicker } from '../../components/forms/PhotoPicker'
import { type AddrRow, OrgAddresses, addrFromApi, addrToApi, checkAddrs, newAddr } from '../../components/forms/OrgAddresses'
import { compressImage } from '../../lib/imageCheck'
import { mediaUrl } from '../../config'
import { orgDraft } from '../../lib/pending'

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
  const [cover, setCover] = useState<File[]>([])
  const [coverPath, setCoverPath] = useState<string | undefined>()
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
  const [addrs, setAddrs] = useState<AddrRow[]>([newAddr()])
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
          district: o.district_id ?? '',
        })
        setCoverPath(o.cover_path)
        const ls = (o.locations ?? []).map(addrFromApi)
        setAddrs(ls.length ? ls : [{ ...newAddr(), city: o.city_id ?? '', district: o.district_id ?? '' }])
        setMsg(Object.fromEntries((o.messengers ?? []).map((m) => [m.channel, m.contact])))
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 404)) return setErr(errorText(e))
        // профиля ещё нет — подставим то, что заполнили при регистрации
        const d = orgDraft.get()
        if (d)
          setF((p) => ({
            ...p,
            name: d.org.name,
            type: d.org.organization_type,
            description: d.org.description ?? '',
            phone: d.org.phone,
            email: d.org.email ?? '',
            website: d.org.website ?? '',
            city: String(d.org.city_id || ''),
            district: d.org.district_id ? String(d.org.district_id) : '',
          }))
        if (d?.branches.length)
          setAddrs(d.branches.map((b) => ({ ...newAddr(), name: b.name ?? '', city: b.city_id, district: b.district_id ?? '', address: b.address, lat: b.lat, lng: b.lng })))
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
    Object.assign(e, checkAddrs(addrs))
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
        // город организации = город основного адреса
        city_id: Number(addrs[0].city),
        district_id: Number(addrs[0].district || 0),
        messengers: CHANNELS.filter((c) => msg[c.k]?.trim()).map((c) => ({ channel: c.k, contact: msg[c.k].trim() })),
        locations: addrs.map(addrToApi),
      })
      const saved = await Api.myOrganization().catch(() => null)
      if (saved?.locations?.length) setAddrs(saved.locations.map(addrFromApi))
      if (cover[0]) {
        try {
          setCoverPath((await Api.uploadOrgCover(await compressImage(cover[0], 1600))).cover_path)
          setCover([])
        } catch (e) {
          toast(`Обложка не загрузилась: ${errorText(e)}`, 'error')
        }
      }
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
        <TextField label="Телефон" required type="tel" placeholder="+373 777 12345" value={f.phone} onChange={set('phone')} error={errors.phone} />
        <TextField label="Почта организации" type="email" value={f.email} onChange={set('email')} error={errors.email} />
        <TextField label="Сайт" className="span-2" type="url" placeholder="https://" value={f.website} onChange={set('website')} error={errors.website} />
        {CHANNELS.map((c) => (
          <TextField key={c.k} label={c.label} placeholder={c.ph} value={msg[c.k] ?? ''} onChange={(e) => setMsg({ ...msg, [c.k]: e.target.value })} />
        ))}
        <div className="field span-2">
          <span className="field-label">Обложка организации</span>
          {coverPath && !cover.length && <img className="org-cover-prev" src={mediaUrl(coverPath)} alt="Текущая обложка" />}
          <PhotoPicker files={cover} onChange={setCover} max={1} />
          {coverPath && <span className="field-hint">Новое фото заменит текущую обложку</span>}
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="org-d">
            Описание
          </label>
          <textarea id="org-d" className="textarea" value={f.description} onChange={set('description')} placeholder="Расскажите об организации и её деятельности" />
        </div>
      </div>
      <h2 style={{ marginTop: 22 }}>Адреса и филиалы</h2>
      <p className="auth__note">Поставьте метку на карте — по ней вас найдут на карте и в поиске «Рядом со мной». При изменении адреса опубликованные анкеты с этой точкой снова уйдут на проверку.</p>
      <OrgAddresses rows={addrs} onChange={setAddrs} errors={errors} />
      {err && <p className="form-error" style={{ marginTop: 14 }}>{err}</p>}
      <button type="submit" className="btn btn--primary btn--block btn--lg" style={{ marginTop: 18 }} disabled={busy}>
        {busy ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </form>
  )
}
