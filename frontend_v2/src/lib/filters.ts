// Состояние фильтров каталога ⇄ строка адреса ⇄ запрос к API.
// API принимает не всё, что умеет панель (см. API_LIMITS ниже) — недостающее
// досеиваем на клиенте по уже загруженной странице результатов.
import type { SearchParams } from '../api/endpoints'
import type { Card, Category } from '../api/types'
import { coverOf } from './format'
import { isPhone } from './device'

export type TimeOfDay = 'morning' | 'day' | 'evening'
export type SortKey = 'relevance' | 'rating' | 'new' | 'near' | 'free' | 'updated_week'

export interface Filters {
  q: string
  kind: '' | 'activity' | 'service'
  city: string // '' — любой
  districts: string[]
  cats: string[]
  priceMode: 'range' | 'free' | ''
  priceMin?: number
  priceMax?: number
  online: boolean
  offline: boolean
  ageMin?: number
  ageMax?: number
  days: number[]
  times: TimeOfDay[]
  verified: boolean
  near: boolean
  radius?: number // метры, 500 / 1000 / 3000 / 10000 (ТЗ §3.5.6)
  withPhoto: boolean
  sort: SortKey
  page: number
}

export const EMPTY: Filters = {
  q: '',
  kind: '',
  city: '',
  districts: [],
  cats: [],
  priceMode: '',
  online: false,
  offline: false,
  days: [],
  times: [],
  verified: false,
  near: false,
  withPhoto: false,
  sort: 'relevance',
  page: 1,
}

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])
const num = (v: string | null) => (v !== null && v !== '' && !isNaN(+v) ? +v : undefined)

export function fromSearch(sp: URLSearchParams): Filters {
  return {
    q: sp.get('q') ?? '',
    kind: (['activity', 'service'].includes(sp.get('kind') ?? '') ? sp.get('kind') : '') as Filters['kind'],
    city: sp.get('city') ?? '',
    districts: list(sp.get('district')),
    cats: list(sp.get('cat')),
    priceMode: (sp.get('price') as Filters['priceMode']) ?? '',
    priceMin: num(sp.get('pmin')),
    priceMax: num(sp.get('pmax')),
    online: sp.get('online') === '1',
    offline: sp.get('offline') === '1',
    ageMin: num(sp.get('amin')),
    ageMax: num(sp.get('amax')),
    days: list(sp.get('days')).map(Number).filter((d) => d >= 1 && d <= 7),
    times: list(sp.get('times')).filter((t): t is TimeOfDay => ['morning', 'day', 'evening'].includes(t)),
    verified: sp.get('verified') === '1',
    near: sp.get('near') === '1' && isPhone(), // «Рядом со мной» — только на телефоне
    radius: [500, 1000, 3000, 10000].includes(Number(sp.get('radius'))) ? Number(sp.get('radius')) : undefined,
    withPhoto: sp.get('photo') === '1',
    sort: (sp.get('sort') === 'near' && !isPhone() ? 'relevance' : (sp.get('sort') as SortKey)) || 'relevance',
    page: Math.max(1, num(sp.get('page')) ?? 1),
  }
}

export function toSearch(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  const set = (k: string, v: unknown) => {
    if (v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length)) return
    p.set(k, v === true ? '1' : Array.isArray(v) ? v.join(',') : String(v))
  }
  set('q', f.q)
  set('kind', f.kind)
  set('city', f.city)
  set('district', f.districts)
  set('cat', f.cats)
  set('price', f.priceMode)
  if (f.priceMode === 'range') {
    set('pmin', f.priceMin)
    set('pmax', f.priceMax)
  }
  set('online', f.online)
  set('offline', f.offline)
  set('amin', f.ageMin)
  set('amax', f.ageMax)
  set('days', f.days)
  set('times', f.times)
  set('verified', f.verified)
  set('near', f.near)
  if (f.near) set('radius', f.radius)
  set('photo', f.withPhoto)
  if (f.sort !== 'relevance') set('sort', f.sort)
  if (f.page > 1) set('page', f.page)
  return p
}

/** Сколько пунктов выбрано в каждом разделе (бейджи на панели). */
export function counts(f: Filters) {
  return {
    kind: f.kind ? 1 : 0,
    location: f.districts.length || (f.city ? 1 : 0),
    category: f.cats.length,
    price: f.priceMode ? 1 : 0,
    format: (f.online ? 1 : 0) + (f.offline ? 1 : 0),
    age: f.ageMin !== undefined || f.ageMax !== undefined ? 1 : 0,
    days: f.days.length,
    times: f.times.length,
  }
}

export function isEmpty(f: Filters) {
  return JSON.stringify({ ...f, q: '', sort: 'relevance', page: 1 }) === JSON.stringify({ ...EMPTY, q: '' })
}

// ---------- дерево направлений ----------

export function findPath(tree: Category[], id: string, path: Category[] = []): Category[] | null {
  for (const c of tree) {
    if (c.id === id) return [...path, c]
    const r = c.children && findPath(c.children, id, [...path, c])
    if (r) return r
  }
  return null
}

export function descendants(c: Category): string[] {
  return [c.id, ...(c.children ?? []).flatMap(descendants)]
}

/** Ближайший общий предок выбранных направлений (API принимает только один category). */
function commonAncestor(tree: Category[], ids: string[]): string | undefined {
  const paths = ids.map((id) => findPath(tree, id)).filter(Boolean) as Category[][]
  if (!paths.length) return undefined
  let i = 0
  while (paths.every((p) => p[i] && p[i].id === paths[0][i].id)) i++
  return i > 0 ? paths[0][i - 1].id : undefined
}

// ---------- загрузка с учётом досева ----------

/**
 * Если всё можно отфильтровать на бэке — один запрос.
 * Если нужен досев на клиенте — грузим все страницы (по 100, максимум 1000 карточек),
 * фильтруем и сами режем на страницы, чтобы счётчик и пагинация были честными.
 */
export async function runSearch(
  plan: Plan,
  fetchPage: (p: SearchParams) => Promise<{ items: Card[]; total: number; page: number; limit: number }>,
): Promise<{ items: Card[]; total: number; page: number; limit: number }> {
  const page = plan.params.page ?? 1
  const limit = plan.params.limit ?? 24
  if (!plan.refine) {
    const r = await fetchPage(plan.params)
    return { ...r, items: r.items ?? [] }
  }
  const all: Card[] = []
  for (let p = 1; p <= 10; p++) {
    const r = await fetchPage({ ...plan.params, page: p, limit: 100 })
    all.push(...(r.items ?? []))
    if (all.length >= r.total || !(r.items ?? []).length) break
  }
  const ok = all.filter(plan.refine)
  return { items: ok.slice((page - 1) * limit, page * limit), total: ok.length, page, limit }
}

// ---------- в API ----------

export interface Plan {
  params: SearchParams
  /** Нужна ли досейка на клиенте (тогда total из API — верхняя граница) */
  refine: ((c: Card) => boolean) | null
}

export function toApi(f: Filters, tree: Category[], coords?: [number, number] | null): Plan {
  const p: SearchParams = { page: f.page, limit: 24 }
  const checks: ((c: Card) => boolean)[] = []

  if (f.q.trim()) p.q = f.q.trim()
  if (f.kind) p.kind = f.kind
  if (f.city) p.city = f.city
  if (f.districts.length) p.district = f.districts

  if (f.cats.length === 1) p.category = f.cats[0]
  else if (f.cats.length > 1) {
    const lca = commonAncestor(tree, f.cats)
    if (lca) p.category = lca
    const allowed = new Set(
      f.cats.flatMap((id) => {
        const path = findPath(tree, id)
        return path ? descendants(path[path.length - 1]) : [id]
      }),
    )
    checks.push((c) => allowed.has(c.direction_id))
  }

  if (f.priceMode === 'free') p.free = true
  else if (f.priceMode === 'range') {
    if (f.priceMax !== undefined) p.price_max = f.priceMax
    if (f.priceMin !== undefined) {
      const min = f.priceMin
      checks.push((c) => (c.groups ?? []).some((g) => (g.price_to ?? g.price_from) >= min) || (c.price_from ?? 0) >= min)
    }
  }

  if (f.online !== f.offline) p.online = f.online

  if (f.ageMin !== undefined && f.ageMax === undefined) p.age = f.ageMin
  else if (f.ageMax !== undefined && f.ageMin === undefined) p.age = f.ageMax
  else if (f.ageMin !== undefined && f.ageMax !== undefined) {
    if (f.ageMin === f.ageMax) p.age = f.ageMin
    else {
      const [a, b] = [f.ageMin, f.ageMax]
      checks.push((c) => {
        const gs = c.groups?.length ? c.groups : [{ age_from: c.age.min_age ?? undefined, age_to: c.age.max_age ?? undefined }]
        return gs.some((g) => (g.age_from ?? 0) <= b && (g.age_to ?? 99) >= a)
      })
    }
  }

  if (f.days.length === 1) p.day = f.days[0]
  else if (f.days.length > 1) {
    const ds = new Set(f.days)
    checks.push((c) => (c.groups ?? []).some((g) => (g.schedules ?? []).some((s) => ds.has(s.weekday))))
  }

  if (f.times.length === 1) p.time = f.times[0]
  else if (f.times.length === 2) {
    const ranges = f.times.map((t) => ({ morning: ['06:00', '12:00'], day: ['12:00', '17:00'], evening: ['17:00', '20:00'] })[t])
    checks.push((c) =>
      (c.groups ?? []).some((g) => (g.schedules ?? []).some((s) => ranges.some(([a, b]) => s.start_time >= a && s.start_time < b))),
    )
  }

  if (f.verified) p.verified = true
  if (f.near && coords) {
    p.near = `${coords[0]},${coords[1]}`
    p.radius = f.radius ?? 3000
  }
  if (f.withPhoto) checks.push((c) => !!coverOf(c))

  if (f.sort !== 'relevance') {
    if (f.sort !== 'near' || coords) p.sort = f.sort
  }

  return { params: p, refine: checks.length ? (c) => checks.every((fn) => fn(c)) : null }
}
