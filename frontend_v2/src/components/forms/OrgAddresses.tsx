import { useState } from 'react'
import { MapPin, Trash2 } from 'lucide-react'
import { Api } from '../../api/endpoints'
import { errorText } from '../../api/client'
import type { OrgLocationInput, OrganizationLocation } from '../../api/types'
import { CityDistrict } from './CityDistrict'
import { TextField } from './Fields'
import { MapView } from '../MapView'
import { GeoFind } from './GeoFind'

/** Строка адреса в форме: id есть у уже сохранённых точек. */
export interface AddrRow {
  key: string
  id?: string
  name: string
  city: string
  district: string
  address: string
  lat: number | null
  lng: number | null
}

let n = 0
export const newAddr = (): AddrRow => ({ key: `new-${++n}`, name: '', city: '', district: '', address: '', lat: null, lng: null })

export const addrFromApi = (l: OrganizationLocation): AddrRow => ({
  key: `id-${l.id}`,
  id: l.id,
  name: l.name ?? '',
  city: l.city_id,
  district: l.district_id ?? '',
  address: l.address,
  lat: l.latitude ?? null,
  lng: l.longitude ?? null,
})

export const addrToApi = (a: AddrRow): OrgLocationInput => ({
  ...(a.id ? { id: a.id } : {}),
  name: a.name.trim() || null,
  city_id: a.city,
  district_id: a.district || null,
  address: a.address.trim(),
  latitude: a.lat,
  longitude: a.lng,
})

/** Проверка: город и адрес обязательны. Ошибки по ключам `city-<key>` / `addr-<key>`. */
export function checkAddrs(rows: AddrRow[]) {
  const e: Record<string, string> = {}
  for (const a of rows) {
    if (!a.city) e[`city-${a.key}`] = 'Выберите город'
    if (!a.address.trim()) e[`addr-${a.key}`] = 'Укажите улицу и дом'
  }
  return e
}

/** Адреса и филиалы организации с меткой на карте (PUT /me/organization → locations[]). */
export function OrgAddresses({ rows, onChange, errors = {} }: { rows: AddrRow[]; onChange: (r: AddrRow[]) => void; errors?: Record<string, string> }) {
  const set = (key: string, patch: Partial<AddrRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const [busy, setBusy] = useState('')
  const [delErr, setDelErr] = useState<Record<string, string>>({})

  // новую (несохранённую) строку просто убираем; сохранённую — удаляем на сервере
  const remove = async (a: AddrRow) => {
    if (!a.id) return onChange(rows.filter((r) => r.key !== a.key))
    if (!confirm(`Удалить адрес «${a.address || a.name}»? Это нельзя отменить.`)) return
    setBusy(a.key)
    setDelErr({ ...delErr, [a.key]: '' })
    try {
      await Api.deleteOrgLocation(a.id)
      onChange(rows.filter((r) => r.key !== a.key))
    } catch (e) {
      setDelErr({ ...delErr, [a.key]: errorText(e) })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="org-addrs">
      {rows.map((a, i) => (
        <div key={a.key} className="org-reg__addr">
          <div className="row org-reg__addr-head">
            <b>{i === 0 ? 'Основной адрес' : `Филиал ${i}`}</b>
            {rows.length > 1 && (
              <button type="button" className="link-btn" disabled={busy === a.key} onClick={() => remove(a)}>
                <Trash2 size={14} /> {busy === a.key ? 'Удаляем…' : 'Удалить'}
              </button>
            )}
          </div>
          {delErr[a.key] && <p className="form-error">{delErr[a.key]}</p>}
          <div className="grid-2">
            <TextField label="Название точки" placeholder={i === 0 ? 'Например: основной зал' : 'Например: зал на Балке'} value={a.name} onChange={(e) => set(a.key, { name: e.target.value })} />
            <TextField
              label="Улица и дом"
              required
              placeholder="ул. Мира, 21"
              value={a.address}
              onChange={(e) => set(a.key, { address: e.target.value })}
              error={errors[`addr-${a.key}`]}
            />
            <CityDistrict required city={a.city} district={a.district} onChange={(city, district) => set(a.key, { city, district })} errors={{ city: errors[`city-${a.key}`] }} />
          </div>
          <div className="pin-pick">
            <div className="pin-pick__head">
              <MapPin size={16} />
              {a.lat != null ? (
                <span>
                  Метка стоит. Чтобы поправить — нажмите на карте в другом месте.{' '}
                  <button type="button" className="link-btn" onClick={() => set(a.key, { lat: null, lng: null })}>
                    Убрать метку
                  </button>
                </span>
              ) : (
                <span>Нажмите на карте, где находится {i === 0 ? 'организация' : 'филиал'}, или найдите по адресу</span>
              )}
              <GeoFind address={a.address} cityId={a.city} onFound={([lat, lng]) => set(a.key, { lat, lng })} />
            </div>
            <MapView
              className="pin-pick__map"
              zoom={a.lat != null ? 16 : 12}
              points={a.lat != null && a.lng != null ? [{ id: a.key, lat: a.lat, lng: a.lng }] : []}
              onPick={([lat, lng]) => set(a.key, { lat: +lat.toFixed(6), lng: +lng.toFixed(6) })}
            />
          </div>
        </div>
      ))}
      <button type="button" className="btn btn--soft btn--block btn--lg org-reg__branch" onClick={() => onChange([...rows, newAddr()])}>
        + Добавить филиал
      </button>
    </div>
  )
}
