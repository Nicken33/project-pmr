import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Trash2, X } from 'lucide-react'
import { Api } from '../../api/endpoints'
import type { ActivityInput, GroupInput, LocationInput, OwnedActivity, ScheduleInput } from '../../api/types'
import { errorText } from '../../api/client'
import { useAuth } from '../../state/auth'
import { useRefs } from '../../state/refs'
import { useToast } from '../../state/toast'
import { SelectField, TextField } from '../../components/forms/Fields'
import { CityDistrict } from '../../components/forms/CityDistrict'
import { MapView } from '../../components/MapView'
import { orgDraft } from '../../lib/pending'
import { flatDirections, recordTypeFor, STATUS_TEXT } from '../../lib/owner'
import { normalizePhone, WEEKDAYS } from '../../lib/format'
import { mediaUrl } from '../../config'
import { compressImage, imageWidth, MIN_GOOD_WIDTH } from '../../lib/imageCheck'

type Loc = Omit<LocationInput, 'latitude' | 'longitude'> & { lat: string; lng: string }
type Sched = { weekday: string; start: string; end: string; note: string }
type Grp = { name: string; ageFrom: string; ageTo: string; priceFrom: string; priceTo: string; period: string; locationKey: string; seats: string; schedules: Sched[] }

const newKey = () => `loc-${Math.random().toString(36).slice(2, 8)}`
const emptyLoc = (): Loc => ({ key: newKey(), name: null, city_id: '', district_id: null, address: '', lat: '', lng: '', phone: null, source_type: 'person', source_url: null })
const emptySched = (): Sched => ({ weekday: '1', start: '16:00', end: '17:00', note: '' })
const emptyGroup = (key = ''): Grp => ({ name: '', ageFrom: '', ageTo: '', priceFrom: '0', priceTo: '', period: '', locationKey: key, seats: '', schedules: [emptySched()] })
const n = (s: string) => (s.trim() === '' ? null : Number(s))

export default function ActivityEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const { user } = useAuth()
  const { categories } = useRefs()
  const toast = useToast()
  const nav = useNavigate()
  const kind = recordTypeFor(user?.account_type)

  const [loaded, setLoaded] = useState<OwnedActivity | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [base, setBase] = useState({ name: '', description: '', direction: '', classType: 'group', classFormat: 'offline', phone: '+373 ' })
  const [locs, setLocs] = useState<Loc[]>([emptyLoc()])
  const [groups, setGroups] = useState<Grp[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [pickFor, setPickFor] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  const directions = useMemo(() => flatDirections(categories, kind), [categories, kind])

  // У анкеты без групп бэк не отдаёт адреса — берём адреса из профиля организации
  const fillFromOrg = () =>
    Api.myOrganization()
      .then((o) => {
        const l = (o.locations ?? []).map<Loc>((x) => ({
          key: `id-${x.id}`,
          id: x.id,
          name: x.name ?? null,
          city_id: x.city_id,
          district_id: x.district_id ?? null,
          address: x.address,
          lat: x.latitude?.toString() ?? '',
          lng: x.longitude?.toString() ?? '',
          phone: x.phone ?? null,
          source_type: 'person',
          source_url: null,
        }))
        if (l.length) return setLocs(l)
        // адреса и метки из формы регистрации организации (бэк пока не хранит точки без анкеты)
        const d = orgDraft.get()
        if (d?.branches.length)
          setLocs(
            d.branches.map((b) => ({
              ...emptyLoc(),
              name: b.name,
              city_id: b.city_id,
              district_id: b.district_id,
              address: b.address,
              lat: b.lat?.toString() ?? '',
              lng: b.lng?.toString() ?? '',
            })),
          )
      })
      .catch(() => {})

  useEffect(() => {
    if (isNew) fillFromOrg()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew])

  const reload = () => {
    if (!id) return
    Api.myActivity(id)
      .then((a) => {
        setLoaded(a)
        setBase({
          name: a.name,
          description: a.description ?? '',
          direction: a.direction_id,
          classType: a.class_type ?? 'group',
          classFormat: a.class_format,
          phone: a.phone ?? '+373 ',
        })
        // места берём из групп (у каждой группы своё место)
        const map = new Map<string, Loc>()
        for (const g of a.groups ?? []) {
          const l = g.location
          if (!l || map.has(l.id)) continue
          map.set(l.id, {
            key: `id-${l.id}`,
            id: l.id,
            name: null,
            city_id: l.city_id,
            district_id: l.district_id ?? null,
            address: l.address,
            lat: l.latitude?.toString() ?? '',
            lng: l.longitude?.toString() ?? '',
            phone: l.phone ?? null,
            source_type: 'person',
            source_url: null,
          })
        }
        if (map.size) {
          setLocs([...map.values()])
          // у groups[].location нет name — подставляем из профиля организации, чтобы PUT его не стёр
          Api.myOrganization()
            .then((o) => {
              const names = new Map((o.locations ?? []).map((x) => [x.id, x.name ?? null]))
              setLocs((ls) => ls.map((l) => (l.id && !l.name && names.get(l.id) ? { ...l, name: names.get(l.id)! } : l)))
            })
            .catch(() => {})
        } else fillFromOrg()
        setGroups(
          (a.groups ?? []).map((g) => ({
            name: g.name ?? '',
            ageFrom: g.age_from?.toString() ?? '',
            ageTo: g.age_to?.toString() ?? '',
            priceFrom: String(g.price_from ?? 0),
            priceTo: g.price_to?.toString() ?? '',
            period: g.price_period ?? '',
            locationKey: g.location ? `id-${g.location.id}` : '',
            seats: g.seats?.toString() ?? '',
            schedules: (g.schedules ?? []).map((s) => ({ weekday: String(s.weekday), start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5), note: s.note ?? '' })),
          })),
        )
      })
      .catch((e) => setErr(errorText(e)))
      .finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [id])

  const build = (): ActivityInput | string => {
    if (!base.name.trim()) return 'Укажите название'
    if (!base.direction) return 'Выберите направление'
    const phone = base.phone.replace(/\D/g, '').length > 3 ? normalizePhone(base.phone) : null
    if (base.phone.replace(/\D/g, '').length > 3 && !phone) return 'Телефон в формате +373 777 12345'
    const usedKeys = new Set(groups.map((g) => g.locationKey))
    const locations: LocationInput[] = []
    for (const l of locs) {
      if (!l.city_id || !l.address.trim()) {
        if (usedKeys.has(l.key)) return 'У адреса, привязанного к группе, должны быть город и улица'
        continue
      }
      const lph = l.phone?.trim() ? normalizePhone(l.phone) : null
      if (l.phone?.trim() && !lph) return `Телефон филиала «${l.address}» — в формате +373 777 12345`
      if ((l.lat === '') !== (l.lng === '')) return 'Укажите обе координаты или ни одной'
      locations.push({
        key: l.key,
        ...(l.id ? { id: l.id } : {}),
        name: l.name?.trim() || null,
        city_id: l.city_id,
        district_id: l.district_id || null,
        address: l.address.trim(),
        latitude: n(l.lat),
        longitude: n(l.lng),
        phone: lph,
        source_type: l.source_type,
        source_url: l.source_url?.trim() || null,
      })
    }
    const keys = new Set(locations.map((l) => l.key))
    const out: GroupInput[] = []
    for (const [i, g] of groups.entries()) {
      const label = g.name || `Группа ${i + 1}`
      if (!keys.has(g.locationKey)) return `${label}: выберите адрес проведения`
      const pf = Number(g.priceFrom || 0)
      if (pf > 0 && !g.period) return `${label}: укажите, за что цена (занятие / месяц / курс)`
      const schedules: ScheduleInput[] = g.schedules.map((s) => ({ weekday: Number(s.weekday), start_time: s.start, end_time: s.end, note: s.note.trim() || null, seats: n(g.seats) }))
      if (schedules.some((s) => !s.start_time || !s.end_time || s.start_time >= s.end_time)) return `${label}: время начала должно быть раньше окончания`
      out.push({
        name: g.name.trim() || null,
        age_from: n(g.ageFrom),
        age_to: n(g.ageTo),
        price_from: pf,
        price_to: n(g.priceTo),
        price_period: pf > 0 ? g.period : null,
        location_key: g.locationKey,
        seats: n(g.seats),
        schedules,
      })
    }
    return {
      name: base.name.trim(),
      description: base.description.trim() || null,
      record_type: kind,
      direction_id: base.direction,
      class_type: kind === 'service' ? null : (base.classType as ActivityInput['class_type']),
      class_format: base.classFormat as ActivityInput['class_format'],
      phone,
      locations,
      groups: out,
    }
  }

  const save = async (submit = false) => {
    const body = build()
    if (typeof body === 'string') {
      setErr(body)
      setStep(stepFor(body))
      return
    }
    setErr('')
    setBusy(submit ? 'Отправляем…' : 'Сохраняем…')
    try {
      let actId = id
      if (isNew) {
        actId = (await Api.createActivity(body)).id
        orgDraft.clear() // адреса из регистрации уже в анкете
      }
      else await Api.updateActivity(id!, body)
      if (submit) await Api.submitActivity(actId!)
      toast(submit ? 'Анкета отправлена на проверку' : 'Сохранено', 'success')
      if (isNew) nav(`/my/${actId}/edit`, { replace: true })
      else reload()
      if (submit) nav('/my')
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy('')
    }
  }

  if (loading) return <div className="spinner" />

  const status = loaded?.status

  return (
    <div className="editor">
      <div className="owner-head" style={{ margin: 0 }}>
        <div>
          <Link to="/my" className="link-btn">
            ← Мои анкеты
          </Link>
          <h1 style={{ marginTop: 6 }}>{isNew ? 'Новая анкета' : base.name || 'Анкета'}</h1>
          {status === 'published' && <p>Изменения опубликованной анкеты снова отправят её на проверку.</p>}
        </div>
      </div>

      {status === 'rejected' && loaded?.rejection_reason && <div className="oitem__reason">Причина отказа: {loaded.rejection_reason}</div>}

      <ol className="steps" aria-label="Шаги анкеты">
        {STEPS.map((t, i) => (
          <li key={t}>
            <button type="button" aria-current={step === i ? 'step' : undefined} className={i < step ? 'is-done' : ''} onClick={() => setStep(i)}>
              <span>{i + 1}</span> {t}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
      <section className="panel card-form">
        <h2>Основное</h2>
        <div className="grid-2">
          <TextField label="Название" required className="span-2" maxLength={200} value={base.name} onChange={(e) => setBase({ ...base, name: e.target.value })} />
          <SelectField label="Направление" required value={base.direction} onChange={(e) => setBase({ ...base, direction: e.target.value })}>
            <option value="">Выберите направление</option>
            {directions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </SelectField>
          {kind === 'activity' && (
            <SelectField label="Вид занятия" required value={base.classType} onChange={(e) => setBase({ ...base, classType: e.target.value })}>
              <option value="group">Групповое</option>
              <option value="individual">Индивидуальное</option>
              <option value="both">Групповое и индивидуальное</option>
            </SelectField>
          )}
          <SelectField label="Формат" required value={base.classFormat} onChange={(e) => setBase({ ...base, classFormat: e.target.value })}>
            <option value="offline">Офлайн</option>
            <option value="online">Онлайн</option>
            <option value="both">Онлайн и офлайн</option>
          </SelectField>
          <div className="field span-2">
            <label className="field-label" htmlFor="act-desc">
              Описание
            </label>
            <textarea id="act-desc" className="textarea" value={base.description} onChange={(e) => setBase({ ...base, description: e.target.value })} placeholder="Чем занимаетесь, что нужно взять с собой, кто тренер…" />
          </div>
        </div>
      </section>
      )}

      {step === 1 && (
      <section className="panel card-form">
        <h2>Точки проведения</h2>
        <p className="muted">Для проверки нужна точка на карте — нажмите «Указать на карте» и кликните по месту.</p>
        {locs.map((l, i) => (
          <div className="ebox" key={l.key}>
            <div className="ebox__head">
              <b>{i === 0 ? 'Основной адрес' : `Адрес ${i + 1}`}</b>
              {locs.length > 1 && (
                <button type="button" className="link-btn" onClick={() => setLocs(locs.filter((x) => x.key !== l.key))}>
                  <Trash2 size={14} /> Убрать
                </button>
              )}
            </div>
            <div className="grid-2">
              <CityDistrict
                city={l.city_id}
                district={l.district_id ?? ''}
                onChange={(city, d) => setLocs(locs.map((x) => (x.key === l.key ? { ...x, city_id: city, district_id: d || null } : x)))}
              />
              <TextField label="Улица и дом" value={l.address} onChange={(e) => setLocs(locs.map((x) => (x.key === l.key ? { ...x, address: e.target.value } : x)))} placeholder="ул. Мира, 21" />
              <TextField label="Телефон филиала" type="tel" placeholder="+373 777 12345" value={l.phone ?? ''} onChange={(e) => setLocs(locs.map((x) => (x.key === l.key ? { ...x, phone: e.target.value } : x)))} />
              <div className="field span-2">
                <span className="field-label">Точка на карте</span>
                <div className="row row--wrap">
                  <span className="muted" style={{ fontSize: 13 }}>
                    {l.lat && l.lng ? `${l.lat}, ${l.lng}` : 'не указана'}
                  </span>
                  <button type="button" className="btn btn--soft btn--sm" onClick={() => setPickFor(pickFor === l.key ? null : l.key)}>
                    {pickFor === l.key ? 'Готово' : 'Указать на карте'}
                  </button>
                  {l.lat && (
                    <button type="button" className="link-btn" onClick={() => setLocs(locs.map((x) => (x.key === l.key ? { ...x, lat: '', lng: '' } : x)))}>
                      Сбросить
                    </button>
                  )}
                </div>
                {pickFor === l.key && (
                  <MapView
                    className="pick-map"
                    points={l.lat && l.lng ? [{ id: l.key, lat: +l.lat, lng: +l.lng }] : []}
                    onPick={([lat, lng]) => setLocs(locs.map((x) => (x.key === l.key ? { ...x, lat: String(lat), lng: String(lng) } : x)))}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn--soft btn--block" style={{ marginTop: 12 }} onClick={() => setLocs([...locs, emptyLoc()])}>
          <Plus size={16} /> Добавить адрес
        </button>
      </section>

      )}

      {step === 2 && (
      <section className="panel card-form">
        <h2>Группы и расписание</h2>
        <p className="muted">У каждой группы — свой возраст, цена, адрес и дни занятий.</p>
        {groups.map((g, i) => {
          const upd = (p: Partial<Grp>) => setGroups(groups.map((x, k) => (k === i ? { ...x, ...p } : x)))
          return (
            <div className="ebox" key={i}>
              <div className="ebox__head">
                <b>{g.name || `Группа ${i + 1}`}</b>
                <button
                  type="button"
                  className="link-btn"
                  disabled={groups.length < 2}
                  title={groups.length < 2 ? 'Последнюю группу удалить нельзя — у анкеты должна быть хотя бы одна группа' : undefined}
                  onClick={() => setGroups(groups.filter((_, k) => k !== i))}
                >
                  <Trash2 size={14} /> Удалить группу
                </button>
              </div>
              <div className="grid-4">
                <TextField label="Название" placeholder="Дети 8–12 лет" value={g.name} onChange={(e) => upd({ name: e.target.value })} />
                <TextField label="Возраст от" inputMode="numeric" value={g.ageFrom} onChange={(e) => upd({ ageFrom: e.target.value.replace(/\D/g, '') })} />
                <TextField label="Возраст до" inputMode="numeric" value={g.ageTo} onChange={(e) => upd({ ageTo: e.target.value.replace(/\D/g, '') })} />
                <TextField label="Мест" inputMode="numeric" value={g.seats} onChange={(e) => upd({ seats: e.target.value.replace(/\D/g, '') })} />
                <TextField label="Цена от, руб." inputMode="numeric" hint="0 — бесплатно" value={g.priceFrom} onChange={(e) => upd({ priceFrom: e.target.value.replace(/\D/g, '') })} />
                <TextField label="Цена до, руб." inputMode="numeric" value={g.priceTo} onChange={(e) => upd({ priceTo: e.target.value.replace(/\D/g, '') })} />
                <SelectField label="Цена за" value={g.period} disabled={!Number(g.priceFrom)} onChange={(e) => upd({ period: e.target.value })}>
                  <option value="">—</option>
                  <option value="training">занятие</option>
                  <option value="month">месяц</option>
                  <option value="course">курс</option>
                </SelectField>
                <SelectField label="Адрес" required value={g.locationKey} onChange={(e) => upd({ locationKey: e.target.value })}>
                  <option value="">Выберите</option>
                  {locs.map((l, k) => (
                    <option key={l.key} value={l.key}>
                      {l.address || `Адрес ${k + 1}`}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div style={{ marginTop: 14 }}>
                <span className="field-label">Расписание</span>
                {g.schedules.map((s, j) => {
                  const us = (p: Partial<Sched>) => upd({ schedules: g.schedules.map((x, k) => (k === j ? { ...x, ...p } : x)) })
                  return (
                    <div className="sched-row" key={j} style={{ marginTop: 8 }}>
                      <SelectField aria-label="День" value={s.weekday} onChange={(e) => us({ weekday: e.target.value })}>
                        {WEEKDAYS.map((w, k) => (
                          <option key={w} value={k + 1}>
                            {w}
                          </option>
                        ))}
                      </SelectField>
                      <TextField aria-label="Начало" type="time" value={s.start} onChange={(e) => us({ start: e.target.value })} />
                      <TextField aria-label="Окончание" type="time" value={s.end} onChange={(e) => us({ end: e.target.value })} />
                      <TextField aria-label="Примечание" placeholder="Примечание: приходить за 15 минут" value={s.note} onChange={(e) => us({ note: e.target.value })} />
                      <button type="button" className="icon-btn" aria-label="Удалить строку" onClick={() => upd({ schedules: g.schedules.filter((_, k) => k !== j) })}>
                        <X size={18} />
                      </button>
                    </div>
                  )
                })}
                <button type="button" className="btn btn--soft btn--sm" onClick={() => upd({ schedules: [...g.schedules, emptySched()] })}>
                  <Plus size={14} /> День
                </button>
              </div>
            </div>
          )
        })}
        <button type="button" className="btn btn--soft btn--block" style={{ marginTop: 12 }} onClick={() => setGroups([...groups, emptyGroup(locs[0]?.key)])}>
          <Plus size={16} /> Добавить группу
        </button>
      </section>

      )}

      {step === 3 && (
        <section className="panel card-form">
          <h2>Контакты</h2>
          <p className="muted">Телефон анкеты — на него звонят из карточки («Позвонить»). Телефон каждой точки задаётся на шаге «Точки проведения»; сайт и мессенджеры — в профиле организации.</p>
          <div className="grid-2">
            <TextField label="Телефон" type="tel" placeholder="+373 777 12345" value={base.phone} onChange={(e) => setBase({ ...base, phone: e.target.value })} />
          </div>
          <p style={{ marginTop: 12 }}>
            <Link to="/my/organization">Изменить сайт и мессенджеры организации →</Link>
          </p>
        </section>
      )}

      {step === 4 && !isNew && loaded && <MediaSection a={loaded} onChanged={reload} />}
      {step === 4 && isNew && (
        <section className="panel card-form">
          <h2>Фото и видео</h2>
          <p className="muted">Сначала сохраните черновик — после этого можно будет загрузить фото и видео.</p>
        </section>
      )}

      {err && <p className="form-error">{err}</p>}
      <div className="editor__bar">
        {status && <span className={`editor__status st-${status}`}>Статус: {STATUS_TEXT[status]}</span>}
        {step > 0 && (
          <button type="button" className="btn btn--outline" onClick={() => setStep(step - 1)}>
            ← Назад
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button type="button" className="btn btn--outline" onClick={() => setStep(step + 1)}>
            Далее →
          </button>
        )}
        <button type="button" className="btn btn--soft" disabled={!!busy} onClick={() => save(false)}>
          {busy === 'Сохраняем…' ? busy : 'Сохранить черновик'}
        </button>
        {(isNew || status === 'draft' || status === 'rejected') && (
          <button type="button" className="btn btn--solid" disabled={!!busy} onClick={() => save(true)}>
            {busy === 'Отправляем…' ? busy : 'Сохранить и отправить на проверку'}
          </button>
        )}
        {(status === 'published' || status === 'pending') && (
          <button type="button" className="btn btn--solid" disabled={!!busy} onClick={() => save(false)}>
            Сохранить изменения
          </button>
        )}
      </div>
    </div>
  )
}

function MediaSection({ a, onChanged }: { a: OwnedActivity; onChanged: () => void }) {
  const toast = useToast()
  const photoIn = useRef<HTMLInputElement>(null)
  const videoIn = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState('')

  const pick = (e: React.ChangeEvent<HTMLInputElement>, video: boolean) => {
    const files = Array.from(e.target.files ?? []) // копия: ниже очищаем поле
    e.target.value = ''
    upload(files, video)
  }

  const upload = async (files: File[], video: boolean) => {
    if (!files.length) return
    for (const [i, f] of files.entries()) {
      if (video && (f.type !== 'video/mp4' || f.size > 50 * 1024 * 1024)) {
        toast('Видео: только MP4, до 50 МБ, до 30 секунд', 'error')
        continue
      }
      if (!video && (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 10 * 1024 * 1024)) {
        toast(`«${f.name}»: нужен JPG/PNG/WebP до 10 МБ`, 'error')
        continue
      }
      if (!video) {
        const w = await imageWidth(f)
        if (w && w < MIN_GOOD_WIDTH) toast(`«${f.name}»: ширина ${w} px — на сайте фото будет нечётким. Лучше от ${MIN_GOOD_WIDTH} px`, 'error')
      }
      setBusy(`Загрузка ${i + 1} из ${files.length}…`)
      try {
        if (video) await Api.uploadVideo(a.id, f)
        else await Api.uploadPhoto(a.id, await compressImage(f))
      } catch (e) {
        toast(`«${f.name}»: ${errorText(e)}`, 'error')
      }
    }
    setBusy('')
    onChanged()
  }

  const remove = async (mediaId: string) => {
    if (!confirm('Удалить файл?')) return
    try {
      await Api.deleteMedia(a.id, mediaId)
      onChanged()
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  const photos = [...(a.photos ?? [])].sort((x, y) => x.position - y.position)
  const videos = a.videos ?? []

  return (
    <section className="panel card-form">
      <h2>Фото и видео</h2>
      <p className="muted">Фото: JPG, PNG или WebP до 10 МБ. Видео: MP4 (H.264) до 50 МБ и до 30 секунд.</p>
      <div className="media-grid">
        {photos.map((p) => (
          <div key={p.id} className="photopick__item">
            <img src={mediaUrl(p.path)} alt={p.alt_text ?? ''} />
            {p.is_cover && <span className="photopick__cover">Обложка</span>}
            <button type="button" aria-label="Удалить фото" onClick={() => remove(p.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
        {videos.map((v) => (
          <div key={v.id} className="photopick__item">
            <video src={mediaUrl(v.path)} muted preload="metadata" />
            <span className="photopick__cover">Видео</span>
            <button type="button" aria-label="Удалить видео" onClick={() => remove(v.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="row row--wrap">
        <button type="button" className="btn btn--soft" disabled={!!busy} onClick={() => photoIn.current?.click()}>
          + Фото
        </button>
        <button type="button" className="btn btn--soft" disabled={!!busy} onClick={() => videoIn.current?.click()}>
          + Видео
        </button>
        {busy && <span className="muted">{busy}</span>}
      </div>
      <input ref={photoIn} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e, false)} />
      <input ref={videoIn} type="file" hidden accept="video/mp4" onChange={(e) => pick(e, true)} />
    </section>
  )
}

const STEPS = ['Основное', 'Точки проведения', 'Группы и расписание', 'Контакты', 'Фото и видео']

/** На какой шаг вести при ошибке проверки. */
function stepFor(msg: string) {
  if (/название|направлен/i.test(msg)) return 0
  if (/филиал|координат|город и улиц/i.test(msg)) return 1
  if (/групп|цена|время|адрес проведения|location/i.test(msg)) return 2
  if (/телефон/i.test(msg)) return 3
  return 0
}
