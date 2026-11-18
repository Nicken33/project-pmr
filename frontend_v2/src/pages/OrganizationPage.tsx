// Страница организации (ТЗ §3.10): название, тип, описание, контакты, точки на карте,
// опубликованные анкеты по направлениям; клик по точке показывает занятия в ней.
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Globe, Mail, MapPin, Phone, X } from 'lucide-react'
import { Api } from '../api/endpoints'
import type { Card, Organization } from '../api/types'
import { ApiError, errorText } from '../api/client'
import { CardFull } from '../components/cards/CardFull'
import { MapView } from '../components/MapView'
import { ORG_TYPES } from '../lib/owner'
import { useRefs } from '../state/refs'
import { plural } from '../lib/format'
import NotFoundPage from './NotFoundPage'

export default function OrganizationPage() {
  const { id = '' } = useParams()
  const { catIndex } = useRefs()
  const [org, setOrg] = useState<Organization | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [point, setPoint] = useState<string | null>(null)

  useEffect(() => {
    setOrg(null)
    setPoint(null)
    Api.organization(id).then((o) => {
      setOrg(o)
      document.title = `${o.name} — Talentro`
    }, setError)
  }, [id])

  const cards = useMemo(() => {
    const all = org?.cards ?? []
    return point ? all.filter((c) => (c.groups ?? []).some((g) => g.location?.id === point)) : all
  }, [org, point])

  // группировка по наднаправлению
  const byDirection = useMemo(() => {
    const m = new Map<string, Card[]>()
    for (const c of cards) {
      const root = catIndex.get(c.direction_id)?.root.name ?? c.direction ?? 'Другое'
      if (!m.has(root)) m.set(root, [])
      m.get(root)!.push(c)
    }
    return [...m.entries()]
  }, [cards, catIndex])

  const points = useMemo(
    () =>
      (org?.locations ?? [])
        .filter((l) => l.latitude != null && l.longitude != null && (!point || l.id === point))
        .map((l) => ({ id: l.id, lat: l.latitude!, lng: l.longitude!, title: l.address })),
    [org, point],
  )

  if (error) return error instanceof ApiError && error.status === 404 ? <NotFoundPage text="Организация не найдена" /> : <p className="form-error">{errorText(error)}</p>
  if (!org) return <div className="spinner" />

  const locs = org.locations ?? []
  const activePoint = locs.find((l) => l.id === point)

  return (
    <div className="stack">
      <section className="panel org-head">
        <span className="chip" style={{ alignSelf: 'flex-start' }}>
          {ORG_TYPES.find((t) => t.v === org.type)?.label ?? org.type}
        </span>
        <h1>{org.name}</h1>
        {org.description && <p style={{ whiteSpace: 'pre-line' }}>{org.description}</p>}
        <div className="row row--wrap act__contacts" style={{ border: 0, padding: 0 }}>
          {org.phone && (
            <span className="row">
              <Phone size={18} /> <a href={`tel:${org.phone.replace(/\s/g, '')}`}>{org.phone}</a>
            </span>
          )}
          {org.email && (
            <span className="row">
              <Mail size={18} /> <a href={`mailto:${org.email}`}>{org.email}</a>
            </span>
          )}
          {org.website && (
            <span className="row">
              <Globe size={18} />{' '}
              <a href={org.website} target="_blank" rel="noreferrer">
                {org.website.replace(/^https?:\/\//, '')}
              </a>
            </span>
          )}
        </div>
      </section>

      {locs.length > 0 && (
        <section className="panel org-points">
          <div className="org-points__list">
            <h2>Где проходят занятия</h2>
            <ul>
              {locs.map((l) => (
                <li key={l.id}>
                  <button type="button" aria-pressed={point === l.id} onClick={() => setPoint(point === l.id ? null : l.id)}>
                    <MapPin size={18} />
                    <span>
                      <b>{l.name || l.address}</b>
                      <small>{[l.city, l.district, l.name ? l.address : null].filter(Boolean).join(', ')}</small>
                    </span>
                    {l.groups_count > 0 && <em>{`${l.groups_count} ${plural(l.groups_count, 'группа', 'группы', 'групп')}`}</em>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {points.length > 0 && <MapView points={points} className="org-points__map" locate />}
        </section>
      )}

      <div className="org-cards-head">
        <h2 className="page-title">Занятия и услуги</h2>
        {activePoint && (
          <button type="button" className="achip is-on" onClick={() => setPoint(null)}>
            {activePoint.name || activePoint.address} <X size={14} />
          </button>
        )}
      </div>
      {byDirection.length ? (
        byDirection.map(([dir, list]) => (
          <section key={dir} className="org-dir">
            <h3>{dir}</h3>
            <div className="cgrid cgrid--grid">
              {list.map((c) => (
                <CardFull key={c.id} c={c} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="empty panel">{point ? 'В этой точке пока нет опубликованных занятий.' : 'Опубликованных анкет пока нет.'}</div>
      )}
    </div>
  )
}
