import { useEffect, useRef, useState } from 'react'
import { ArrowDownUp, Check, ChevronDown } from 'lucide-react'
import type { SortKey } from '../../lib/filters'

export const SORTS: { v: SortKey; label: string }[] = [
  { v: 'relevance', label: 'Сначала подходящие' },
  { v: 'new', label: 'Сначала новинки' },
  { v: 'price_asc', label: 'Сначала дешёвые' },
  { v: 'price_desc', label: 'Сначала дорогие' },
  { v: 'rating', label: 'Сначала популярные' },
  { v: 'name_asc', label: 'По названию: А–Я' },
  { v: 'name_desc', label: 'По названию: Я–А' },
  { v: 'near', label: 'Ближе ко мне' },
]

/** Выпадающее меню сортировки (как в магазинах): заголовок, галочка у выбранного. */
export function SortMenu({ value, onChange, phone }: { value: SortKey; onChange: (v: SortKey) => void; phone: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = SORTS.filter((s) => s.v !== 'near' || phone)
  const current = SORTS.find((s) => s.v === value) ?? SORTS[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="sortm" ref={box}>
      <button type="button" className={`sortm__btn ${open ? 'is-open' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ArrowDownUp size={16} />
        <span>{current.label}</span>
        <ChevronDown size={16} className="sortm__chev" />
      </button>
      {open && (
        <div className="sortm__pop" role="listbox" aria-label="Сортировка">
          <div className="sortm__title">Сортировка</div>
          {list.map((s) => (
            <button
              key={s.v}
              type="button"
              role="option"
              aria-selected={s.v === value}
              className={`sortm__item ${s.v === value ? 'is-on' : ''}`}
              onClick={() => {
                setOpen(false)
                if (s.v !== value) onChange(s.v)
              }}
            >
              <span>{s.label}</span>
              {s.v === value && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
