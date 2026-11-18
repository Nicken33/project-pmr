import { Link, useNavigate } from 'react-router-dom'
import { Clock3, MapPin, UsersRound, Wrench } from 'lucide-react'
import type { Card } from '../../api/types'
import { ageText, allSchedules, cardPrice, placeLine, plural, scheduleText, uniqueLocations } from '../../lib/format'
import { groupPrice, pickGroup, SERVICE_PLACE } from '../../lib/groups'
import type { Filters } from '../../lib/filters'
import { Checked, Cover, FavShare, Votes, cardLink, useChip } from './CardParts'

/** Основная карточка каталога (сетка 6 в ряд или список). */
export function CardFull({ c, layout = 'grid', filters, near }: { c: Card; layout?: 'grid' | 'list'; filters?: Filters; near?: [number, number] | null }) {
  const chip = useChip(c)
  const nav = useNavigate()
  const groups = c.groups ?? []
  // раскрытая группа — подходящая под фильтры каталога (ТЗ §3.2)
  const g = pickGroup(c, filters, near)
  const firstAge = g ?? { age_from: c.age?.min_age ?? c.age_from, age_to: c.age?.max_age ?? c.age_to }
  const moreGroups = Math.max(0, groups.length - 1)
  const base = placeLine(c)
  const locs = uniqueLocations(c)
  const gl = g?.location
  const place = gl
    ? { area: [gl.city, gl.district].filter(Boolean).join(', '), address: gl.address, more: Math.max(0, locs.length - 1) }
    : base
  const link = cardLink(c)
  const isService = c.record_type === 'service'

  return (
    <article className={`cfull cfull--${layout}`} onClick={() => nav(link)}>
      <div className="cfull__photo">
        <Cover c={c} />
        <FavShare c={c} />
      </div>
      <div className="cfull__body">
        <h3 className="cfull__name">
          <Link to={link} onClick={(e) => e.stopPropagation()}>
            {c.name}
          </Link>
        </h3>
        <div className="cfull__org">
          <span>{c.organization ?? ''}</span>
          {chip && <span className="chip">{chip}</span>}
        </div>
        <ul className="cfull__facts">
          {isService ? (
            <li>
              <Wrench size={17} />
              <span>
                Услуга · {SERVICE_PLACE[c.class_format]}
              </span>
            </li>
          ) : (
          <li>
            <UsersRound size={17} />
            <span>
              {ageText(firstAge.age_from, firstAge.age_to)}
              {moreGroups > 0 && (
                <>
                  , ещё{' '}
                  <Link to={`${link}#groups`} onClick={(e) => e.stopPropagation()} className="u">
                    {moreGroups} {plural(moreGroups, 'группа', 'группы', 'групп')}
                  </Link>
                </>
              )}
            </span>
          </li>
          )}
          {!isService && (
            <li>
              <Clock3 size={17} />
              <span>{scheduleText(g ? g.schedules : allSchedules(c))}</span>
            </li>
          )}
          <li>
            <MapPin size={17} />
            <span>
              {c.class_format === 'online' && !place.area ? (
                'Онлайн'
              ) : (
                <>
                  {place.area}
                  {place.address && <br />}
                  {place.address}
                  {place.more > 0 && (
                    <>
                      , ещё{' '}
                      <Link to={`${link}#where`} onClick={(e) => e.stopPropagation()} className="u">
                        {place.more} {plural(place.more, 'адрес', 'адреса', 'адресов')}
                      </Link>
                    </>
                  )}
                </>
              )}
            </span>
          </li>
        </ul>
        <div className="cfull__meta">
          <Votes c={c} small />
          <Checked c={c} />
        </div>
        <div className="cfull__price">{g ? groupPrice(g, isService) : cardPrice(c)}</div>
        <Link to={link} className="btn btn--solid btn--sm cfull__more" onClick={(e) => e.stopPropagation()}>
          Подробнее
        </Link>
      </div>
    </article>
  )
}
