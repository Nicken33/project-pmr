import type { Card, Group, Schedule } from '../api/types'

export const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
export const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** plural(5, 'группа', 'группы', 'групп') → 'групп' */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export const fmtNum = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ')

export function fmtDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(+d)) return ''
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const hm = (t: string) => t.slice(0, 5)

export const PERIOD: Record<string, string> = { training: 'занятие', month: 'месяц', course: 'курс' }

export function priceText(from?: number | null, period?: string | null, prefix = true) {
  if (from === undefined || from === null) return 'Цена по запросу'
  if (from === 0) return 'Бесплатно'
  const p = period && PERIOD[period] ? ` / ${PERIOD[period]}` : ''
  return `${prefix ? 'от ' : ''}${fmtNum(from)} руб${p}`
}

/** Минимальная цена карточки по группам */
export function cardPrice(c: Card) {
  const gs = c.groups ?? []
  if (gs.length) {
    const min = gs.reduce((a, g) => (g.price_from < a.price_from ? g : a), gs[0])
    const many = gs.some((g) => g.price_from !== min.price_from) || min.price_to
    return priceText(min.price_from, min.price_period, !!many)
  }
  return priceText(c.price_from, c.price_period, true)
}

export function ageText(from?: number | null, to?: number | null) {
  if (from == null && to == null) return 'Любой возраст'
  if (from != null && to != null) return `${from}–${to} ${plural(to, 'год', 'года', 'лет')}`
  if (from != null) return `от ${from} ${plural(from, 'года', 'лет', 'лет')}`
  return `до ${to} ${plural(to!, 'года', 'лет', 'лет')}`
}

/** «Пн, Ср, Пт 16:00–18:00» или «Пн–Сб 10:00–18:00». Берём самое частое время. */
export function scheduleText(list?: Schedule[] | null): string {
  if (!list?.length) return 'Расписание уточняйте'
  const byTime = new Map<string, Set<number>>()
  for (const s of list) {
    const k = `${hm(s.start_time)}–${hm(s.end_time)}`
    if (!byTime.has(k)) byTime.set(k, new Set())
    byTime.get(k)!.add(s.weekday)
  }
  const parts = [...byTime.entries()].map(([time, days]) => `${daysText([...days])} ${time}`)
  return parts.slice(0, 2).join(', ')
}

export function daysText(days: number[]) {
  const d = [...new Set(days)].sort((a, b) => a - b)
  if (d.length >= 3 && d[d.length - 1] - d[0] === d.length - 1) return `${WD_SHORT[d[0] - 1]}–${WD_SHORT[d[d.length - 1] - 1]}`
  return d.map((x) => WD_SHORT[x - 1]).join(', ')
}

export function allSchedules(c: Card): Schedule[] {
  const gs = c.groups ?? []
  const fromGroups = gs.flatMap((g) => g.schedules ?? [])
  return fromGroups.length ? fromGroups : (c.schedules ?? [])
}

export function uniqueLocations(c: Card) {
  const m = new Map<string, Group['location']>()
  for (const g of c.groups ?? []) if (g.location) m.set(g.location.id || g.location.address, g.location)
  return [...m.values()]
}

export function placeLine(c: Card) {
  const locs = uniqueLocations(c)
  const first = locs[0]
  const city = first?.city ?? c.city
  const district = first?.district ?? c.district
  return {
    area: [city, district].filter(Boolean).join(', '),
    address: first?.address ?? c.address ?? '',
    more: Math.max(0, locs.length - 1),
  }
}

export function coverOf(c: Card) {
  const p = c.photos ?? []
  return c.cover_path ?? (p.find((x) => x.is_cover) ?? [...p].sort((a, b) => a.position - b.position)[0])?.path
}

export const FORMAT_TEXT = { online: 'Онлайн', offline: 'Офлайн', both: 'Онлайн и офлайн' } as const
export const CLASS_TYPE_TEXT = { individual: 'Индивидуальное', group: 'Групповое', both: 'Групповое и индивидуальное' } as const

/** Телефон в формате бэка: «+373 777 12345» */
export function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, '').replace(/^373/, '')
  if (d.length !== 8) return null
  return `+373 ${d.slice(0, 3)} ${d.slice(3)}`
}
