import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import type { Card } from '../../api/types'
import { Cover, Votes, cardLink, useChip, FavShare } from './CardParts'

/** Маленькая карточка («Рекомендуемое», «Избранное»). onRemove — крестик «убрать из избранного» (ТЗ §3.6). */
export function CardMini({ c, withActions, onRemove }: { c: Card; withActions?: boolean; onRemove?: () => void }) {
  const chip = useChip(c)
  return (
    <Link to={cardLink(c)} className="cmini">
      <div className="cmini__photo">
        <Cover c={c} />
        {withActions && <FavShare c={c} />}
        {onRemove && (
          <button
            type="button"
            className="cmini__remove"
            aria-label={`Убрать «${c.name}» из избранного`}
            title="Убрать из избранного"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRemove()
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <h3 className="cmini__name">{c.name}</h3>
      <div className="cmini__foot">
        <Votes c={c} small />
        {chip && <span className="chip">{chip}</span>}
      </div>
    </Link>
  )
}
