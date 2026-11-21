import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import type { Category } from '../../api/types'
import { categoryIcon } from '../../lib/categoryIcons'

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')

/**
 * Выбор направления: поиск + блоки по разделам (вместо длинного списка «Раздел › Подраздел»).
 * Показываются только направления нужного типа (занятие / услуга).
 */
export function DirectionPicker({
  tree,
  kind,
  value,
  onChange,
  error,
}: {
  tree: Category[]
  kind: 'activity' | 'service'
  value: string
  onChange: (id: string) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const ok = (c: Category) => c.record_type === kind || c.record_type === 'both'

  const blocks = useMemo(() => {
    const t = norm(q.trim())
    return tree
      .filter(ok)
      .map((root) => {
        const kids = (root.children ?? []).filter(ok)
        const rootHit = !t || norm(root.name).includes(t)
        const items = rootHit ? kids : kids.filter((k) => norm(k.name).includes(t))
        return { root, items, show: rootHit || items.length > 0 }
      })
      .filter((b) => b.show)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, kind, q])

  const current = useMemo(() => {
    for (const r of tree) {
      if (r.id === value) return r.name
      const k = r.children?.find((c) => c.id === value)
      if (k) return `${r.name} › ${k.name}`
    }
    return ''
  }, [tree, value])

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

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
    setQ('')
  }

  return (
    <div className="field dirpick" ref={box}>
      <span className="field-label">
        Направление <span className="req"> *</span>
      </span>
      <button type="button" className={`input dirpick__btn ${current ? '' : 'is-empty'}`} aria-invalid={!!error} onClick={() => setOpen((o) => !o)}>
        <span>{current || 'Выберите направление'}</span>
        <ChevronDown size={18} />
      </button>
      {error && <span className="field-error">{error}</span>}
      {open && (
        <div className="dirpick__pop">
          <label className="dirpick__search">
            <Search size={16} />
            <input autoFocus placeholder="Поиск: футбол, английский, шахматы…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && (
              <button type="button" aria-label="Очистить" onClick={() => setQ('')}>
                <X size={14} />
              </button>
            )}
          </label>
          <div className="dirpick__list">
            {blocks.length === 0 && <p className="muted">Ничего не нашлось. Выберите «Другое» в подходящем разделе.</p>}
            {blocks.map(({ root, items }) => (
              <section key={root.id} className="dirpick__block">
                <button type="button" className={`dirpick__root ${value === root.id ? 'is-on' : ''}`} onClick={() => pick(root.id)}>
                  <i style={{ maskImage: `url("${categoryIcon(root.name)}")`, WebkitMaskImage: `url("${categoryIcon(root.name)}")` }} />
                  {root.name}
                </button>
                {items.length > 0 && (
                  <div className="dirpick__chips">
                    {items.map((k) => (
                      <button key={k.id} type="button" className={`dirpick__chip ${value === k.id ? 'is-on' : ''}`} onClick={() => pick(k.id)}>
                        {k.name}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
