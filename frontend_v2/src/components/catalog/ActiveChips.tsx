import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Api } from '../../api/endpoints'
import type { Category, District } from '../../api/types'
import { useRefs } from '../../state/refs'
import { EMPTY, findPath, type Filters } from '../../lib/filters'
import { fmtNum, WD_SHORT } from '../../lib/format'

const TIME: Record<string, string> = { morning: 'утро', day: 'день', evening: 'вечер' }

/** Чипы активных фильтров с крестиком и «Сбросить всё» (ТЗ §3.1.5). */
export function ActiveChips({ f, onChange }: { f: Filters; onChange: (f: Filters) => void }) {
  const { cities, categories } = useRefs()
  const [dists, setDists] = useState<District[]>([])
  useEffect(() => {
    if (!f.city) return setDists([])
    Api.districts(f.city).then(setDists, () => setDists([]))
  }, [f.city])

  const set = (p: Partial<Filters>) => onChange({ ...f, ...p, page: 1 })
  const chips: { key: string; label: string; off: () => void }[] = []
  const catName = (id: string) => {
    const path = findPath(categories as Category[], id)
    return path ? path[path.length - 1].name : id
  }

  if (f.q) chips.push({ key: 'q', label: `«${f.q}»`, off: () => set({ q: '' }) })
  if (f.kind) chips.push({ key: 'kind', label: f.kind === 'activity' ? 'Занятия' : 'Услуги', off: () => set({ kind: '' }) })
  if (f.city)
    chips.push({ key: 'city', label: cities.find((c) => c.id === f.city)?.name ?? 'Город', off: () => set({ city: '', districts: [] }) })
  f.districts.forEach((d) =>
    chips.push({ key: `d${d}`, label: dists.find((x) => x.id === d)?.name ?? 'Район', off: () => set({ districts: f.districts.filter((x) => x !== d) }) }),
  )
  f.cats.forEach((c) => chips.push({ key: `c${c}`, label: catName(c), off: () => set({ cats: f.cats.filter((x) => x !== c) }) }))
  if (f.priceMode === 'free') chips.push({ key: 'free', label: 'Бесплатно', off: () => set({ priceMode: '' }) })
  if (f.priceMode === 'range' && (f.priceMin !== undefined || f.priceMax !== undefined))
    chips.push({
      key: 'price',
      label: [f.priceMin !== undefined && `от ${fmtNum(f.priceMin)}`, f.priceMax !== undefined && `до ${fmtNum(f.priceMax)}`].filter(Boolean).join(' ') + ' руб.',
      off: () => set({ priceMode: '', priceMin: undefined, priceMax: undefined }),
    })
  if (f.online) chips.push({ key: 'on', label: 'Онлайн', off: () => set({ online: false }) })
  if (f.offline) chips.push({ key: 'off', label: 'Офлайн', off: () => set({ offline: false }) })
  if (f.ageMin !== undefined || f.ageMax !== undefined)
    chips.push({
      key: 'age',
      label: f.ageMin === f.ageMax ? `${f.ageMin} лет` : `${f.ageMin ?? 0}–${f.ageMax ?? 99} лет`,
      off: () => set({ ageMin: undefined, ageMax: undefined }),
    })
  if (f.days.length) chips.push({ key: 'days', label: [...f.days].sort().map((d) => WD_SHORT[d - 1]).join(', '), off: () => set({ days: [] }) })
  if (f.times.length) chips.push({ key: 'times', label: f.times.map((t) => TIME[t]).join(', '), off: () => set({ times: [] }) })
  if (f.verified) chips.push({ key: 'ver', label: 'Проверенные', off: () => set({ verified: false }) })
  if (f.near) chips.push({ key: 'near', label: 'Рядом со мной', off: () => set({ near: false }) })
  if (f.withPhoto) chips.push({ key: 'photo', label: 'С фото', off: () => set({ withPhoto: false }) })

  if (!chips.length) return null
  return (
    <div className="achips" aria-label="Выбранные фильтры">
      {chips.map((c) => (
        <button key={c.key} type="button" className="achip" onClick={c.off} aria-label={`Убрать фильтр ${c.label}`}>
          {c.label} <X size={14} />
        </button>
      ))}
      <button type="button" className="achips__reset" onClick={() => onChange({ ...EMPTY, sort: f.sort })}>
        Сбросить всё
      </button>
    </div>
  )
}
