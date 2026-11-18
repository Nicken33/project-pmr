// Выбор «раскрытой» группы по ТЗ §3.2/§3.3.12: подходящая под фильтр каталога,
// иначе ближайшая по возрасту, иначе первая.
import type { Card, Group } from '../api/types'
import { EMPTY, fromSearch, type Filters } from './filters'
import { fmtNum, PERIOD } from './format'

const TIMES: Record<string, [string, string]> = { morning: ['06:00', '12:00'], day: ['12:00', '17:00'], evening: ['17:00', '20:00'] }

function score(g: Group, f: Filters): number {
  let s = 0
  const af = g.age_from ?? 0
  const at = g.age_to ?? 99
  if (f.ageMin !== undefined || f.ageMax !== undefined) {
    const a = f.ageMin ?? 0
    const b = f.ageMax ?? 99
    if (af <= b && at >= a) s += 4
  }
  if (f.days.length && (g.schedules ?? []).some((x) => f.days.includes(x.weekday))) s += 2
  if (f.times.length && (g.schedules ?? []).some((x) => f.times.some((t) => x.start_time.slice(0, 5) >= TIMES[t][0] && x.start_time.slice(0, 5) < TIMES[t][1]))) s += 2
  if (f.priceMode === 'free' && g.price_from === 0) s += 3
  if (f.priceMode === 'range' && f.priceMax !== undefined && g.price_from <= f.priceMax) s += 2
  if (f.districts.length && g.location?.district_id && f.districts.includes(g.location.district_id)) s += 2
  else if (f.city && g.location?.city_id === f.city) s += 1
  return s
}

/**
 * ТЗ §3.1.10: показываем ближайшую точку — по геолокации пользователя,
 * без неё по выбранному городу/району (это в score), без них — первую по порядку.
 */
export function pickGroup(c: Card, f: Filters = EMPTY, near?: [number, number] | null): Group | undefined {
  const gs = c.groups ?? []
  if (gs.length <= 1) return gs[0]
  let best = gs[0]
  let bestScore = -1
  let bestDist = Infinity
  for (const g of gs) {
    const s = score(g, f)
    const l = g.location
    const d = near && l?.latitude != null && l.longitude != null ? distance(near, [l.latitude, l.longitude]) : Infinity
    if (s > bestScore || (s === bestScore && d < bestDist)) {
      best = g
      bestScore = s
      bestDist = d
    }
  }
  return best
}

/** Расстояние в метрах (формула гаверсинусов). */
export function distance(a: [number, number], b: [number, number]) {
  const r = (x: number) => (x * Math.PI) / 180
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(h))
}

/** Фильтры, с которыми пользователь пришёл из каталога (для раскрытия группы на странице секции). */
const KEY = 'talentro.lastFilters'
export function rememberFilters(search: string) {
  sessionStorage.setItem(KEY, search)
}
export function lastFilters(): Filters {
  return fromSearch(new URLSearchParams(sessionStorage.getItem(KEY) ?? ''))
}

/** Где оказывается услуга (у API нет отдельного поля «выезд» — берём формат). */
export const SERVICE_PLACE = { offline: 'на месте', online: 'онлайн / удалённо', both: 'на месте или онлайн' } as const

/** Цена группы: «Бесплатно» или «300–400 руб. / месяц». У услуги «за занятие» = «за визит». */
export function groupPrice(g?: Group, service = false) {
  if (!g) return ''
  if (g.price_from === 0) return 'Бесплатно'
  const per = service && g.price_period === 'training' ? 'визит' : g.price_period ? PERIOD[g.price_period] : ''
  const p = per ? ` / ${per}` : ''
  const range = g.price_to && g.price_to !== g.price_from ? `${fmtNum(g.price_from)}–${fmtNum(g.price_to)}` : fmtNum(g.price_from)
  return `${range} руб.${p}`
}

/** Общий диапазон цен по всем группам (шапка карточки, ТЗ §3.3.3). */
export function priceRange(c: Card) {
  const gs = c.groups ?? []
  if (!gs.length) return ''
  if (gs.every((g) => g.price_from === 0)) return 'Бесплатно'
  const lo = Math.min(...gs.map((g) => g.price_from))
  const hi = Math.max(...gs.map((g) => g.price_to ?? g.price_from))
  const periods = [...new Set(gs.filter((g) => g.price_from > 0).map((g) => g.price_period))]
  const p = periods.length === 1 && periods[0] && PERIOD[periods[0]] ? ` / ${PERIOD[periods[0]]}` : ''
  return `${lo === 0 ? 'бесплатно' : fmtNum(lo)}${hi !== lo ? `–${fmtNum(hi)}` : ''} руб.${p}`
}
