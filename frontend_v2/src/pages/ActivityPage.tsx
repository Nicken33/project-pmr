import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, Mail, Phone, PhoneCall, ThumbsDown, ThumbsUp, Globe, Navigation, AlertTriangle, Building2, Pencil } from 'lucide-react'
import { useRoleStats } from '../state/roleStats'
import { groupPrice, lastFilters, pickGroup, priceRange, SERVICE_PLACE } from '../lib/groups'
import { getManualPos } from '../lib/myPos'
import { Api, isOwner } from '../api/endpoints'
import type { CardDetails, Group } from '../api/types'
import { ApiError, errorText } from '../api/client'
import { useAuth } from '../state/auth'
import { useRefs } from '../state/refs'
import { useToast } from '../state/toast'
import { Gallery } from '../components/activity/Gallery'
import { Reviews } from '../components/activity/Reviews'
import { MapView } from '../components/MapView'
import { FavShare, shortCategory } from '../components/cards/CardParts'
import { categoryIcon } from '../lib/categoryIcons'
import { ageText, fmtDate, fmtNum, plural, PERIOD, uniqueLocations, WEEKDAYS } from '../lib/format'
import { Logo } from '../components/Logo'
import { ReportButton } from '../components/ReportButton'
import NotFoundPage from './NotFoundPage'
import instagram from '../assets/social/instagram.svg'
import telegram from '../assets/social/telegram.svg'
import viber from '../assets/social/viber.svg'
import whatsapp from '../assets/social/whatsapp.svg'

const MESSENGER: Record<string, { icon: string; href: (c: string) => string; label: string }> = {
  telegram: { icon: telegram, label: 'Telegram', href: (c) => (c.startsWith('http') ? c : `https://t.me/${c.replace(/^@/, '')}`) },
  instagram: { icon: instagram, label: 'Instagram', href: (c) => (c.startsWith('http') ? c : `https://instagram.com/${c.replace(/^@/, '')}`) },
  viber: { icon: viber, label: 'Viber', href: (c) => (c.startsWith('http') || c.startsWith('viber:') ? c : `viber://chat?number=${encodeURIComponent(c.replace(/[^\d+]/g, ''))}`) },
  whatsapp: { icon: whatsapp, label: 'WhatsApp', href: (c) => (c.startsWith('http') ? c : `https://wa.me/${c.replace(/\D/g, '')}`) },
}

const VOTE_KEY = 'talentro.votes'
const loadVotes = (): Record<string, 1 | -1> => JSON.parse(localStorage.getItem(VOTE_KEY) || '{}')

export default function ActivityPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { catIndex } = useRefs()
  const toast = useToast()
  const nav = useNavigate()
  const [card, setCard] = useState<CardDetails | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [groupIdx, setGroupIdx] = useState(0)
  const [vote, setVote] = useState<1 | -1 | undefined>()
  const [descOpen, setDescOpen] = useState(false)
  const [allAddr, setAllAddr] = useState(false)

  useEffect(() => {
    setCard(null)
    setError(null)
    Api.activity(id)
      .then((c) => {
        setCard(c)
        // раскрываем группу: пришли с метки карты (?point=) — группу этой точки,
        // иначе подходящую под фильтры каталога и ближайшую к пользователю (ТЗ §3.3.12, §3.5.1)
        const point = new URLSearchParams(location.search).get('point')
        const atPoint = (c.groups ?? []).filter((x) => x.location?.id === point)
        const g = pickGroup({ ...c, groups: atPoint.length ? atPoint : c.groups }, lastFilters(), getManualPos())
        if (point) history.replaceState(history.state, '', location.pathname) // выбор группы в URL не храним
        setGroupIdx(Math.max(0, (c.groups ?? []).findIndex((x) => x.id === g?.id)))
        setVote(loadVotes()[c.id])
        document.title = `${c.name} — Talentro`
      })
      .catch(setError)
    return () => {
      document.title = 'Talentro — найди занятие по душе'
    }
  }, [id])

  const { stats } = useRoleStats()
  const myOrgId = isOwner(user) ? stats.orgId : null

  const groups = card?.groups ?? []
  const group: Group | undefined = groups[groupIdx]
  const locations = useMemo(() => (card ? uniqueLocations(card) : []), [card])

  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage text="Секция не найдена или ещё не опубликована" />
    return (
      <div className="empty panel">
        <h3>Не удалось открыть секцию</h3>
        <p>{errorText(error)}</p>
      </div>
    )
  }
  if (!card) return <div className="spinner" />

  const cat = catIndex.get(card.direction_id)
  const tags = [cat ? shortCategory(cat.root.name) : null, cat &&cat.cat.id !== cat.root.id ? cat.cat.name : null].filter(Boolean) as string[]
  const mainLoc = group?.location ?? locations[0]
  const points = locations
    .filter((l) => l.latitude != null && l.longitude != null)
    .map((l) => ({ id: l.id, lat: l.latitude!, lng: l.longitude!, title: l.address, html: `<b>${escapeHtml(l.city)}</b><br>${escapeHtml(l.address)}` }))
  if (!points.length && card.latitude != null && card.longitude != null)
    points.push({ id: 'card', lat: card.latitude, lng: card.longitude, title: card.address ?? '', html: escapeHtml(card.address ?? '') })
  const phone = mainLoc?.phone || card.phone
  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null
  const headPrice = groups.length > 1 ? priceRange(card) : groupPrice(group, card.record_type === 'service')
  const checked = card.contacts_checked_at ?? (card.verified ? card.updated_at : undefined)
  const route = mainLoc?.latitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${mainLoc.latitude},${mainLoc.longitude}` : null

  const doVote = async (v: 1 | -1) => {
    if (!user) return nav('/login', { state: { from: location.pathname } })
    const next = vote === v ? null : v
    try {
      const r = await Api.vote(card.id, next)
      setCard({ ...card, rating: { ...card.rating, likes: r.plus, dislikes: r.minus } })
      const all = loadVotes()
      if (next) all[card.id] = next
      else delete all[card.id]
      localStorage.setItem(VOTE_KEY, JSON.stringify(all))
      setVote(next ?? undefined)
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  const desc = (card.description ?? '').trim()
  // свёрнуто — первый абзац (не длиннее ~260 знаков)
  const firstPara = desc.split(/\n\s*\n/)[0]
  const short = firstPara.length > 260 ? firstPara.slice(0, 260).replace(/\s+\S*$/, '') + '…' : firstPara
  const longDesc = short !== desc

  return (
    <div className="act">
      {myOrgId && myOrgId === card.organization_id && (
        <div className="own-bar" role="status">
          <Building2 size={20} />
          <span>
            <b>Это ваша анкета.</b> Так её видят посетители.
          </span>
          <Link to={`/my/${card.id}/edit`} className="btn btn--solid btn--sm">
            <Pencil size={14} /> Редактировать
          </Link>
          <Link to="/my" className="btn btn--soft btn--sm">
            Мои анкеты
          </Link>
        </div>
      )}
      <div className="act__grid">
        <div className="act__left">
          <div className="act__gallery panel">
            <Gallery photos={card.photos ?? []} videos={card.videos ?? []} name={card.name} directionId={card.direction_id} overlay={<FavShare c={card} />} />
          </div>

          <div className="act__title panel">
            <span className="act__icon" aria-hidden>
              <span
                style={{
                  maskImage: `url("${categoryIcon(cat?.root.name ?? card.direction)}")`,
                  WebkitMaskImage: `url("${categoryIcon(cat?.root.name ?? card.direction)}")`,
                }}
              />
            </span>
            <div className="act__title-text">
              <h1>{card.name}</h1>
              {card.organization && (
                <p className="act__org">
                  {card.organization_id ? <Link to={`/org/${card.organization_id}`}>{card.organization}</Link> : card.organization}
                </p>
              )}
            </div>
            <div className="act__title-side">
              <div className="act__tags">
                {tags.map((t) => (
                  <span key={t} className="chip chip--lg">
                    {t}
                  </span>
                ))}
              </div>
              <div className="act__votes">
                <button type="button" aria-pressed={vote === 1} onClick={() => doVote(1)} aria-label="Плюс" title="Плюс">
                  <ThumbsUp size={22} fill={vote === 1 ? 'currentColor' : 'none'} /> {card.rating.likes}
                </button>
                <button type="button" aria-pressed={vote === -1} onClick={() => doVote(-1)} aria-label="Минус" title="Минус">
                  <ThumbsDown size={22} fill={vote === -1 ? 'currentColor' : 'none'} /> {card.rating.dislikes}
                </button>
                {card.rating.likes + card.rating.dislikes === 0 && <span className="act__novotes">голосов нет</span>}
              </div>
            </div>
            <div className="act__cta">
              <div className="act__price-head">
                {headPrice === 'Бесплатно' ? <span className="free-badge">Бесплатно</span> : <b>{headPrice}</b>}
                {checked ? (
                  <span className="act__checked">
                    <Check size={13} strokeWidth={3} /> Данные проверены {fmtDate(checked)}
                  </span>
                ) : (
                  <span className="act__approx">
                    <AlertTriangle size={13} /> Данные ориентировочные
                  </span>
                )}
              </div>
              <div className="act__cta-btns">
                {tel ? (
                  <a className="btn btn--primary btn--lg act__call" href={tel}>
                    <Phone size={20} /> Позвонить
                  </a>
                ) : (
                  <span className="btn btn--outline btn--lg" aria-disabled>
                    Телефон не указан
                  </span>
                )}
                {route && (
                  <a className="btn btn--soft btn--lg" href={route} target="_blank" rel="noreferrer">
                    <Navigation size={18} /> Как добраться
                  </a>
                )}
              </div>
            </div>
          </div>

          <section className="act__desc panel">
            <h2>Описание</h2>
            {desc ? (
              <>
                <p>{longDesc && !descOpen ? short : desc}</p>
                {longDesc && (
                  <button type="button" className="link-btn" onClick={() => setDescOpen((v) => !v)}>
                    {descOpen ? 'Свернуть' : 'Подробнее'}
                  </button>
                )}
              </>
            ) : (
              <p className="muted">Описание пока не добавлено.</p>
            )}
          </section>

          {card.record_type === 'service' ? (
            <ServiceInfo card={card} group={group} />
          ) : (
            <GroupPicker card={card} groups={groups} idx={groupIdx} setIdx={setGroupIdx} />
          )}
        </div>

        <div className="act__right">
          <section className="act__where panel" id="where">
            {points.length > 0 ? <MapView points={points} className="act__map" locate /> : <div className="act__map act__map--none">Адрес на карте не указан</div>}
            <div className="act__where-body">
              <div className="row">
                <h2>Как добраться</h2>
                {route && (
                  <a className="btn btn--soft btn--sm" href={route} target="_blank" rel="noreferrer">
                    Маршрут
                  </a>
                )}
              </div>
              {card.class_format === 'online' && !mainLoc ? (
                <p className="act__addr">Занятия проходят онлайн</p>
              ) : (
                <p className="act__addr">
                  {[mainLoc?.city ?? card.city, mainLoc?.district ?? card.district, mainLoc?.address ?? card.address].filter(Boolean).join(', ')}
                  {locations.length > 1 && (
                    <>
                      <br />
                      ещё{' '}
                      <button type="button" className="link-btn u" onClick={() => setAllAddr((v) => !v)}>
                        {locations.length - 1} {plural(locations.length - 1, 'адрес', 'адреса', 'адресов')}
                      </button>
                    </>
                  )}
                </p>
              )}
              {allAddr && (
                <ul className="act__addr-list">
                  {locations
                    .filter((l) => l.id !== mainLoc?.id)
                    .map((l) => (
                      <li key={l.id}>{[l.city, l.district, l.address].filter(Boolean).join(', ')}</li>
                    ))}
                </ul>
              )}
              <ul className="act__contacts">
                {mainLoc?.phone && (
                  <li>
                    <PhoneCall size={20} /> Эта точка: <a href={`tel:${mainLoc.phone.replace(/\s/g, '')}`}>{mainLoc.phone}</a>
                  </li>
                )}
                {card.phone && (
                  <li>
                    <Phone size={20} /> Организация: <a href={`tel:${card.phone.replace(/\s/g, '')}`}>{card.phone}</a>
                  </li>
                )}
                {card.email && (
                  <li>
                    <Mail size={20} /> E-mail: <a href={`mailto:${card.email}`}>{card.email}</a>
                  </li>
                )}
                {card.website && (
                  <li>
                    <Globe size={20} /> Сайт:{' '}
                    <a href={card.website} target="_blank" rel="noreferrer">
                      {card.website.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                )}
              </ul>
              {!!card.messengers?.length && (
                <ul className="act__msgs">
                  {card.messengers.map((m) => {
                    const meta = MESSENGER[m.channel]
                    if (!meta) return null
                    return (
                      <li key={m.channel}>
                        <a href={meta.href(m.contact)} target="_blank" rel="noreferrer">
                          <img src={meta.icon} alt="" />
                          <span>
                            <b>{meta.label}</b> {m.contact}
                          </span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          {card.record_type !== 'service' && (
          <section className="act__sched panel">
            <h2>Расписание</h2>
            {groups.length > 1 && group && <p className="muted act__sched-for">Группа: {group.name || ageText(group.age_from, group.age_to)}</p>}
            <ul>
              {WEEKDAYS.map((w, i) => {
                const list = (group?.schedules ?? card.schedules ?? []).filter((s) => s.weekday === i + 1)
                return (
                  <li key={w} className={list.length ? 'has' : ''}>
                    <b>{w}</b>
                    <span className="act__times">
                      {list.map((s, k) => (
                        <span key={k}>
                          {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                        </span>
                      ))}
                    </span>
                    {list.some((s) => s.note) && <small>* {list.map((s) => s.note).filter(Boolean).join('; ')}</small>}
                  </li>
                )
              })}
            </ul>
          </section>
          )}
        </div>
      </div>

      {tel && (
        <a className="call-bar btn btn--primary btn--lg" href={tel}>
          <Phone size={20} /> Позвонить
        </a>
      )}

      <Reviews activityId={card.id} isOwnerOfCard={!!myOrgId && myOrgId === card.organization_id} />

      <div className="act__foot">
        <div className="act__foot-row">
          {(card.verified || card.contacts_checked_at) && (
            <span className="act__verified">
              <Check size={14} strokeWidth={3} /> Проверено {fmtDate(card.contacts_checked_at ?? card.updated_at)}
            </span>
          )}
          <ReportButton target="card" targetId={card.id} label="Пожаловаться / Данные устарели" className="act__report" />
        </div>
        <Logo height={44} />
      </div>
    </div>
  )
}

function GroupPicker({ card, groups, idx, setIdx }: { card: CardDetails; groups: Group[]; idx: number; setIdx: (i: number) => void }) {
  const g = groups[idx]
  const [format, setFormat] = useState<'offline' | 'online'>(card.class_format === 'online' ? 'online' : 'offline')
  const [ctype, setCtype] = useState<'group' | 'individual'>(card.class_type === 'individual' ? 'individual' : 'group')
  const [price, setPrice] = useState<string | null>(null)
  useEffect(() => setPrice(null), [idx])

  if (!groups.length) return null
  const period = g?.price_period
  const calc = () => {
    if (!g) return
    if (g.price_from === 0) return setPrice('Бесплатно')
    const range = g.price_to && g.price_to !== g.price_from ? `${fmtNum(g.price_from)}–${fmtNum(g.price_to)}` : fmtNum(g.price_from)
    setPrice(`${range} руб.${period && PERIOD[period] ? ` / ${PERIOD[period]}` : ''}`)
  }

  return (
    <section className="act__groups panel" id="groups">
      <h2>{groups.length > 1 ? 'Выберите группу' : 'Группа'}</h2>
      {groups.length === 1 && g && (
        <p className="act__group-one">
          {g.name || ageText(g.age_from, g.age_to)}
          {g.name && ` · ${ageText(g.age_from, g.age_to)}`} · {groupPrice(g)}
          {g.seats != null && ` · мест: ${g.seats}`}
        </p>
      )}
      <div className="act__group-tabs" role="tablist" hidden={groups.length < 2}>
        {groups.map((x, i) => (
          <button key={x.id} type="button" role="tab" aria-selected={i === idx} onClick={() => setIdx(i)}>
            {x.name || ageText(x.age_from, x.age_to)}
          </button>
        ))}
      </div>
      <div className="act__group-opts">
        <Radios
          title="Формат занятия"
          name="fmt"
          value={format}
          onChange={(v) => setFormat(v as 'online')}
          options={[
            { v: 'offline', label: 'Офлайн', disabled: card.class_format === 'online' },
            { v: 'online', label: 'Онлайн', disabled: card.class_format === 'offline' },
          ]}
        />
        <Radios
          title="Вид занятия"
          name="ctype"
          value={ctype}
          onChange={(v) => setCtype(v as 'group')}
          options={[
            { v: 'group', label: 'Групповое', disabled: card.class_type === 'individual' },
            { v: 'individual', label: 'Индивидуальное', disabled: card.class_type === 'group' },
          ]}
        />
        <Radios
          title="Формат оплаты"
          name="pay"
          value={!g?.price_from ? 'free' : period === 'training' ? 'single' : 'sub'}
          onChange={() => {}}
          options={
            !g?.price_from
              ? [{ v: 'free', label: 'Бесплатно' }]
              : [
                  { v: 'sub', label: period === 'course' ? 'За курс' : 'Абонемент', disabled: period === 'training' },
                  { v: 'single', label: 'Разовое занятие', disabled: period !== 'training' },
                ]
          }
        />
        {g?.seats != null && <p className="muted">Мест в группе: {g.seats}</p>}
      </div>
      <div className="act__calc">
        <button type="button" className="btn btn--solid" onClick={calc}>
          Рассчитать стоимость
        </button>
        <output className="act__price">{price ?? '0 руб.'}</output>
      </div>
    </section>
  )
}

function Radios(props: {
  title: string
  name: string
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string; disabled?: boolean }[]
}) {
  return (
    <fieldset className="radios">
      <legend>{props.title}</legend>
      <div>
        {props.options.map((o) => (
          <label key={o.v} className="check" aria-disabled={o.disabled}>
            <input type="radio" name={props.name} checked={props.value === o.v} disabled={o.disabled} onChange={() => props.onChange(o.v)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Блок услуги вместо групп и расписания (ТЗ §3.4). */
function ServiceInfo({ card, group }: { card: CardDetails; group?: Group }) {
  const { catIndex } = useRefs()
  const dir = catIndex.get(card.direction_id)?.cat.name ?? card.direction
  return (
    <section className="act__groups panel">
      <h2>Об услуге</h2>
      <dl className="svc">
        <div>
          <dt>Тип услуги</dt>
          <dd>{dir}</dd>
        </div>
        <div>
          <dt>Где</dt>
          <dd>{SERVICE_PLACE[card.class_format]}</dd>
        </div>
        {group && (
          <div>
            <dt>Цена</dt>
            <dd>{groupPrice(group, true)}</dd>
          </div>
        )}
      </dl>
      {!!card.photos?.length && <p className="muted svc__note">Фото примеров работ — в галерее вверху.</p>}
    </section>
  )
}
