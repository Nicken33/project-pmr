import { useEffect, useState } from 'react'
import { Planned } from '../../api/planned'
import { errorText } from '../../api/client'
import { hasFeature } from '../../features'
import { useRefs } from '../../state/refs'

/** Частые запросы на пустом поиске (ТЗ §3.1.11). Заготовка: флаг popular_searches. */
export function PopularSearches({ onPick }: { onPick: (q: string) => void }) {
  const [items, setItems] = useState<string[]>([])
  useEffect(() => {
    if (!hasFeature('popular_searches')) return
    Planned.popularSearches()
      .then((r) => setItems((r.items ?? []).slice(0, 5)))
      .catch(() => setItems([]))
  }, [])
  if (!items.length) return null
  return (
    <div className="popular">
      <span className="muted">Часто ищут:</span>
      {items.map((q) => (
        <button key={q} type="button" className="achip" onClick={() => onPick(q)}>
          {q}
        </button>
      ))}
    </div>
  )
}

/** Заявка «Не нашли занятие» (ТЗ §3.12, таблица requests). Заготовка: флаг not_found_requests. */
export function NotFoundRequest({ query, city }: { query: string; city: string }) {
  const { cities } = useRefs()
  const [q, setQ] = useState(query)
  const [cityId, setCityId] = useState(city)
  const [contact, setContact] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState('')
  useEffect(() => setQ(query), [query])
  if (!hasFeature('not_found_requests')) return null

  if (state === 'done') return <p className="form-ok nf-form">Спасибо! Мы учтём заявку, когда будем пополнять каталог.</p>

  return (
    <form
      className="nf-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!q.trim()) return setErr('Напишите, что ищете')
        setState('busy')
        setErr('')
        try {
          await Planned.notFoundRequest({ query: q.trim(), city_id: cityId || null, contact: contact.trim() || null })
          setState('done')
        } catch (e) {
          setErr(errorText(e))
          setState('idle')
        }
      }}
    >
      <h4>Не нашли занятие?</h4>
      <p className="muted">Расскажите, что ищете, — мы постараемся добавить такие секции.</p>
      <div className="nf-form__row">
        <input className="input" placeholder="Что ищете, например «шахматы для 7 лет»" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} />
        <select className="input select" value={cityId} onChange={(e) => setCityId(e.target.value)} aria-label="Город">
          <option value="">Любой город</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input className="input" placeholder="Почта или телефон (необязательно)" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={120} />
        <button type="submit" className="btn btn--solid" disabled={state === 'busy'}>
          Отправить
        </button>
      </div>
      {err && <p className="field-error">{err}</p>}
    </form>
  )
}
