import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight } from 'lucide-react'
import { Api } from '../../api/endpoints'
import type { Card, CardDetails } from '../../api/types'
import { cardPrice } from '../../lib/format'
import { Cover, cardLink } from '../cards/CardParts'
import { useRefs } from '../../state/refs'

/**
 * Правая колонка под расписанием: организация и похожие секции.
 * Похожие — обычный каталог с тем же направлением (API.md: category=<direction_id>), без текущей записи.
 */
export function SideExtras({ card }: { card: CardDetails }) {
  const [similar, setSimilar] = useState<Card[] | null>(null)

  const { catIndex } = useRefs()
  const root = catIndex.get(card.direction_id)?.root
  const [scope, setScope] = useState<{ id: string; name: string }>({ id: card.direction_id, name: card.direction })

  useEffect(() => {
    let alive = true
    const pick = (items: Card[]) => items.filter((c) => c.id !== card.id).slice(0, 4)
    ;(async () => {
      // сначала то же поднаправление; если там больше никого — всё направление
      let list = pick((await Api.search({ category: card.direction_id, limit: 6 })).items ?? [])
      let sc = { id: card.direction_id, name: card.direction }
      if (!list.length && root && root.id !== card.direction_id) {
        list = pick((await Api.search({ category: root.id, limit: 6 })).items ?? [])
        sc = { id: root.id, name: root.name }
      }
      if (alive) {
        setSimilar(list)
        setScope(sc)
      }
    })().catch(() => alive && setSimilar([]))
    return () => {
      alive = false
    }
  }, [card.id, card.direction_id, card.direction, root])

  return (
    <>
      {card.organization_id && card.organization && (
        <Link to={`/org/${card.organization_id}`} className="panel side-org">
          <span className="side-org__icon">
            <Building2 size={22} />
          </span>
          <span className="side-org__text">
            <small>Организация</small>
            <b>{card.organization}</b>
            <span>Все секции и адреса</span>
          </span>
          <ChevronRight size={20} className="side-org__go" />
        </Link>
      )}
      {!!similar?.length && (
        <section className="panel side-similar">
          <h2>Похожие</h2>
          <ul>
            {similar.map((c) => (
              <li key={c.id}>
                <Link to={cardLink(c)} className="side-similar__item">
                  <span className="side-similar__photo">
                    <Cover c={c} />
                  </span>
                  <span className="side-similar__text">
                    <b>{c.name}</b>
                    <small>{[c.city, c.organization].filter(Boolean).join(' · ')}</small>
                    <em>{cardPrice(c)}</em>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to={`/catalog?cat=${scope.id}`} className="btn btn--soft btn--block btn--sm">
            Все в «{scope.name}»
          </Link>
        </section>
      )}
    </>
  )
}
