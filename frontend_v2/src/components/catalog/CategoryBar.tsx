import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Category } from '../../api/types'
import { ICON_ALL, ICON_MAP, categoryHint, categoryIcon } from '../../lib/categoryIcons'

interface Props {
  categories: Category[]
  active: string | null // id выбранного корня или null = «все»
  onPick: (id: string | null) => void
}

// 12 плиток: «Все», направления из API, «Карта». Подписи на десктопе скрыты — есть подсказка.
export function CategoryBar({ categories, active, onPick }: Props) {
  const nav = useNavigate()
  const [hover, setHover] = useState<string | null>(null)
  const tiles = [
    { id: '__all', name: 'Все направления', hint: 'Показать всё', icon: ICON_ALL },
    ...categories.slice(0, 10).map((c) => ({ id: c.id, name: c.name, hint: categoryHint(c.children), icon: categoryIcon(c.name) })),
    { id: '__map', name: 'Карта', hint: 'Все занятия на карте', icon: ICON_MAP },
  ]
  const shown = hover ?? null
  return (
    <div className="catbar" onMouseLeave={() => setHover(null)}>
      {tiles.map((t) => {
        const isActive = t.id === '__all' ? active === null : t.id === active
        return (
          <div key={t.id} className="catbar__cell">
            <button
              type="button"
              className={`catbar__tile ${isActive && t.id !== '__all' ? 'is-active' : ''}`}
              aria-pressed={isActive}
              aria-label={t.name}
              onMouseEnter={() => setHover(t.id)}
              onFocus={() => setHover(t.id)}
              onBlur={() => setHover(null)}
              onClick={() => {
                if (t.id === '__map') nav('/map')
                else onPick(t.id === '__all' ? null : t.id)
              }}
            >
              <span className="catbar__icon" style={{ maskImage: `url("${t.icon}")`, WebkitMaskImage: `url("${t.icon}")` }} />
            </button>
            <span className="catbar__caption">{t.name}</span>
            {shown === t.id && (
              <div className="catbar__tip" role="tooltip">
                <b>{t.name}</b>
                {t.hint && <span>{t.hint}</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
