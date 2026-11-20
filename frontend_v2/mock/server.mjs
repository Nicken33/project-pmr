// Тестовый API Talentro: повторяет контракт Go-бэка (README бэка), данные — в памяти.
// Только чтобы смотреть и проверять сайт без настоящего бэка (npm run demo).
// Тестовые аккаунты (пароль у всех password123):
//   user@test.md — пользователь, owner@test.md — секции, service@test.md — услуги, moderator@test.md — модератор
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const MEDIA = path.join(DIR, 'media')
const PORT = 8099

// ---------- генератор с зерном: данные одинаковые при каждом запуске ----------
let seed = 42
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))

// ---------- справочники ----------
const CITY = [
  ['Тирасполь', 46.8403, 29.6433, ['Центр', 'Балка', 'Кировский', 'Западный', 'Октябрьский']],
  ['Бендеры', 46.8317, 29.4775, ['Центр', 'Ленинский', 'Северный']],
  ['Рыбница', 47.7681, 29.0006, ['Центр']],
  ['Дубоссары', 47.2633, 29.1661, []],
  ['Слободзея', 46.7297, 29.7044, []],
  ['Григориополь', 47.1536, 29.2964, []],
  ['Каменка', 48.0333, 28.6972, []],
  ['Днестровск', 46.6222, 29.9133, []],
]
const cities = CITY.map(([name], i) => ({ id: String(i + 1), name, sort_order: i + 1 }))
const districts = []
CITY.forEach(([, , , ds], i) => ds.forEach((name, k) => districts.push({ id: String(districts.length + 1), city_id: String(i + 1), name, sort_order: k + 1 })))

const raw = JSON.parse(fs.readFileSync(path.join(DIR, 'catalog.json'), 'utf8'))
let catId = 0
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' })[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const categories = raw.map((r, i) => ({
  id: String(++catId),
  name: r.name,
  record_type: r.type,
  sort_order: i + 1,
  children: r.children.map((c, k) => ({ id: String(++catId), name: c.name, record_type: r.type, sort_order: k + 1, _card: c, _slug: slugify(c.name) })),
}))
const catById = new Map()
categories.forEach((c) => {
  catById.set(c.id, { c })
  c.children.forEach((ch) => catById.set(ch.id, { c: ch, parent: c }))
})
const publicCats = categories.map((c) => ({ ...c, children: c.children.map(({ _card, _slug, ...rest }) => rest) }))
const subtree = (id) => {
  const e = catById.get(id)
  if (!e) return []
  return [e.c.id, ...(e.c.children ?? []).map((x) => x.id)]
}

// ---------- пользователи ----------
const hash = (p) => crypto.createHash('sha256').update('salt' + p).digest('hex')
const pendingRegs = new Map() // email → незавершённая регистрация (до подтверждения почты)
const users = []
const addUser = (email, name, account_type, password = 'password123') => {
  const u = { id: String(users.length + 1), email, name, account_type, pw: hash(password) }
  users.push(u)
  return u
}
addUser('user@test.md', 'Марина', 'user')
const owner = addUser('owner@test.md', 'Спортшкола «Олимп»', 'section_owner')
const servOwner = addUser('service@test.md', 'Салон «Лапки»', 'service_owner')
addUser('moderator@test.md', 'Модератор', 'moderator')
const reviewers = ['Гость', 'Марина', 'Александр', 'Ольга', 'Ирина', 'Дмитрий', 'Светлана', 'Андрей'].map((n, i) => addUser(`r${i}@test.md`, n, 'user'))
const pub = (u) => ({ id: u.id, email: u.email, name: u.name, account_type: u.account_type })
const tokens = new Map() // token → userId
const tokenFor = (u) => {
  const t = crypto.randomBytes(16).toString('hex')
  tokens.set(t, u.id)
  return t
}

// ---------- организации, места, карточки ----------
const orgs = []
const locations = []
const activities = []
const addOrg = (name, ownerId, cityIdx, type = 'studio') => {
  const o = {
    id: String(orgs.length + 1),
    slug: slugify(name) || `org-${orgs.length + 1}`,
    name,
    type,
    description: `${name} — занятия для детей и взрослых. Опытные педагоги, уютные залы, гибкое расписание.`,
    phone: `+373 533 ${String(int(10000, 99999))}`,
    email: `info${orgs.length + 1}@example.md`,
    website: 'https://example.md',
    city_id: String(cityIdx + 1),
    owner_id: ownerId,
    messengers: [
      { channel: 'telegram', contact: '@talentro_demo' },
      { channel: 'instagram', contact: '@talentro_demo' },
      { channel: 'viber', contact: '+37377712345' },
      { channel: 'whatsapp', contact: '+37377712345' },
    ].slice(0, int(1, 4)),
  }
  orgs.push(o)
  return o
}
const STREETS = ['ул. 25 Октября', 'ул. Ленина', 'ул. Мира', 'ул. Пушкина', 'ул. Юности', 'ул. Шевченко', 'ул. Карла Либкнехта', 'ул. Гагарина', 'ул. Советская', 'ул. Восстания']
const addLoc = (org, cityIdx) => {
  const [cityName, lat, lng] = CITY[cityIdx]
  const ds = districts.filter((d) => d.city_id === String(cityIdx + 1))
  const d = ds.length ? pick(ds) : null
  const l = {
    id: String(locations.length + 1),
    org_id: org.id,
    name: null,
    city_id: String(cityIdx + 1),
    city: cityName,
    district_id: d?.id,
    district: d?.name,
    address: `${pick(STREETS)}, ${int(1, 120)}`,
    latitude: +(lat + (rnd() - 0.5) * 0.03).toFixed(5),
    longitude: +(lng + (rnd() - 0.5) * 0.04).toFixed(5),
    phone: `+373 533 ${String(int(10000, 99999))}`,
  }
  locations.push(l)
  return l
}
const NOTES = ['Приходить за 15 минут', 'Взять запасную форму', 'Сменная обувь', null, null, null]
const SLOTS = [
  ['09:00', '10:00'],
  ['10:00', '11:30'],
  ['11:00', '12:00'],
  ['13:00', '14:00'],
  ['15:00', '16:00'],
  ['16:00', '17:30'],
  ['17:00', '18:00'],
  ['18:00', '19:30'],
]
const AGE_SETS = [
  [
    [4, 6],
    [7, 9],
    [10, 12],
  ],
  [
    [6, 9],
    [10, 13],
    [14, 17],
  ],
  [
    [7, 12],
    [13, 16],
  ],
  [[18, 99]],
  [[0, 99]],
]
const DESC = (name) =>
  `${name} — занятия в небольших группах с опытными педагогами. Первое занятие — пробное. Поможем подобрать группу по возрасту и уровню.\n\nЧто взять с собой: удобную одежду, воду и хорошее настроение. Родители могут присутствовать на открытых уроках раз в месяц.`

const now = Date.now()
const iso = (daysAgo) => new Date(now - daysAgo * 864e5).toISOString()
const usedNames = new Set()

categories.forEach((root, ri) => {
  root.children.forEach((ch) => {
    const info = ch._card
    const isService = root.record_type === 'service'
    const cityIdx = ri % 3 === 2 ? int(2, 7) : int(0, 1)
    const org = isService && info.card.includes('Лапки') ? addOrg(info.org, servOwner.id, 0, 'private_master') : addOrg(info.org, null, cityIdx, pick(['school', 'studio', 'sports_school', 'art_house', 'private_master']))
    const locs = [addLoc(org, cityIdx)]
    if (rnd() < 0.35) locs.push(addLoc(org, cityIdx))
    const ages = isService ? [[0, 99]] : pick(AGE_SETS)
    const free = rnd() < 0.18
    const period = isService ? 'training' : pick(['month', 'month', 'training', 'course'])
    const base = free ? 0 : isService ? int(10, 30) * 10 : period === 'month' ? int(4, 25) * 100 : period === 'course' ? int(15, 40) * 100 : int(5, 20) * 10
    const groups = ages.map(([a, b], gi) => {
      const days = [...new Set(Array.from({ length: int(1, 3) }, () => int(1, isService ? 6 : 7)))].sort()
      const slot = pick(SLOTS)
      return {
        id: `${activities.length + 1}${gi}`,
        name: isService ? 'Запись' : `${a}–${b} лет`,
        age_from: a,
        age_to: b,
        price_from: base,
        price_to: !free && rnd() < 0.3 ? base + 200 : undefined,
        price_period: free ? undefined : period,
        location: locs[gi % locs.length],
        schedules: (isService ? [1, 2, 3, 4, 5, 6] : days).map((d) => {
          const note = isService ? null : pick(NOTES)
          return { weekday: d, start_time: (isService ? '09:00' : slot[0]) + ':00', end_time: (isService ? '19:00' : slot[1]) + ':00', ...(note ? { note } : {}) }
        }),
        seats: isService ? undefined : int(8, 16),
      }
    })
    let name = info.card
    if (usedNames.has(name)) name += ' (2)'
    usedNames.add(name)
    const a = {
      id: String(activities.length + 1),
      slug: slugify(name) || `activity-${activities.length + 1}`,
      name,
      description: DESC(name),
      record_type: isService ? 'service' : 'activity',
      status: 'published',
      is_active: true,
      organization_id: org.id,
      direction_id: ch.id,
      class_type: isService ? null : pick(['group', 'group', 'both', 'individual']),
      class_format: pick(['offline', 'offline', 'offline', 'both', 'online']),
      phone: org.phone,
      email: org.email,
      website: org.website,
      groups,
      photos: [1, 2]
        .filter((n) => fs.existsSync(path.join(MEDIA, 'demo', `${ch._slug}-${n}.jpg`)))
        .map((n, k) => ({ id: `${activities.length + 1}0${n}`, path: `demo/${ch._slug}-${n}.jpg`, alt_text: name, position: k, is_cover: k === 0 })),
      videos: [],
      contacts_checked_at: rnd() < 0.7 ? iso(int(1, 40)).slice(0, 10) : undefined,
      created_at: iso(int(1, 120)),
      updated_at: iso(int(0, 30)),
      rejection_reason: undefined,
    }
    activities.push(a)
  })
})

// анкеты владельцев в разных статусах (кабинет)
const ownerOrg = addOrg('Спортшкола «Олимп»', owner.id, 0, 'sports_school')
const ownerLoc = addLoc(ownerOrg, 0)
const mkOwned = (name, status, dirName, extra = {}) => {
  const dir = [...catById.values()].find((e) => e.c.name === dirName).c
  const a = {
    id: String(activities.length + 1),
    slug: slugify(name),
    name,
    description: DESC(name),
    record_type: 'activity',
    status,
    is_active: true,
    organization_id: ownerOrg.id,
    direction_id: dir.id,
    class_type: 'group',
    class_format: 'offline',
    phone: ownerOrg.phone,
    groups: [
      {
        id: `${activities.length + 1}0`,
        name: '7–10 лет',
        age_from: 7,
        age_to: 10,
        price_from: 800,
        price_period: 'month',
        location: ownerLoc,
        schedules: [
          { weekday: 2, start_time: '17:00:00', end_time: '18:00:00' },
          { weekday: 4, start_time: '17:00:00', end_time: '18:00:00' },
        ],
        seats: 12,
      },
    ],
    photos: [{ id: `${activities.length + 1}01`, path: `demo/${dir._slug}-1.jpg`, position: 0, is_cover: true }],
    videos: [],
    created_at: iso(10),
    updated_at: iso(2),
    ...extra,
  }
  activities.push(a)
}
mkOwned('Секция дзюдо «Олимп»', 'published', 'Бокс и единоборства', { contacts_checked_at: iso(3).slice(0, 10) })
mkOwned('Плавание для малышей «Олимп»', 'pending', 'Плавание')
mkOwned('Футбол для девочек «Олимп»', 'rejected', 'Футбол', { rejection_reason: 'Не указана точка на карте у адреса и не загружены фото тренировочного зала.' })
mkOwned('Лёгкая атлетика «Олимп» (черновик)', 'draft', 'Лёгкая атлетика', { photos: [] })

// голоса, отзывы
const votes = new Map() // `${userId}:${actId}` → 1|-1
const reviews = []
const REV = [
  'Ребёнок ходит с удовольствием уже полгода. Педагог внимательный, занятия интересные, прогресс заметен уже через пару месяцев.',
  'Отличное место! Удобное расписание, просторный зал, всегда чисто. Администратор быстро отвечает в мессенджере и помогает с переносом занятий.',
  'Хорошие тренеры и дружная группа. Единственное — бывает тесно в раздевалке в часы пик, но это мелочь по сравнению с качеством занятий.',
  'Пришли на пробное занятие и сразу остались. Сын стал увереннее и с радостью ждёт следующей тренировки. Спасибо команде!',
  'Цена соответствует качеству. Нравится, что родителей приглашают на открытые уроки и рассказывают, чему научились дети.',
]
for (const a of activities.filter((x) => x.status === 'published')) {
  for (const u of reviewers) if (rnd() < 0.55) votes.set(`${u.id}:${a.id}`, rnd() < 0.85 ? 1 : -1)
  for (let i = 0; i < int(0, 4); i++) {
    const u = reviewers[i]
    reviews.push({ id: String(reviews.length + 1), activity_id: a.id, author_id: u.id, author_name: u.name, text: pick(REV), created_at: iso(int(1, 60)) })
  }
}
const favorites = new Map() // userId → Set(actId)
const reports = []
const reviewVotes = new Map() // `${userId}:${reviewId}` → 1|-1
const comments = [] // {id, review_id, author_id, author_name, text, is_organization, created_at}
const requests = []
reviews.forEach((r) => {
  r.photos = []
  r.videos = []
})
const reviewView = (r) => {
  let plus = 0,
    minus = 0
  for (const [k, v] of reviewVotes) if (k.endsWith(`:${r.id}`)) v > 0 ? plus++ : minus++
  return { ...r, votes: { plus, minus }, comments_count: comments.filter((c) => c.review_id === r.id).length }
}

// ---------- представление карточки как у Go ----------
const rating = (id) => {
  let likes = 0,
    dislikes = 0
  for (const [k, v] of votes) if (k.endsWith(`:${id}`)) v > 0 ? likes++ : dislikes++
  return { score: likes - dislikes, votes_count: likes + dislikes, likes, dislikes }
}
const orgOf = (a) => orgs.find((o) => o.id === a.organization_id)
const toCard = (a) => {
  const o = orgOf(a)
  const g0 = a.groups[0]
  const loc = g0?.location
  const dir = catById.get(a.direction_id)?.c
  const ages = a.groups.filter((g) => g.age_from != null)
  return strip({
    id: a.id,
    slug: a.slug,
    name: a.name,
    description: a.description,
    record_type: a.record_type,
    status: a.status,
    city_id: loc?.city_id ?? o?.city_id ?? '1',
    city: loc?.city ?? cities[+(o?.city_id ?? 1) - 1].name,
    district_id: loc?.district_id,
    district: loc?.district,
    direction_id: a.direction_id,
    direction: dir?.name ?? '',
    organization_id: o?.id,
    organization: o?.name,
    class_type: a.class_type ?? undefined,
    class_format: a.class_format,
    price_from: a.groups.length ? Math.min(...a.groups.map((g) => g.price_from)) : undefined,
    price_period: g0?.price_period,
    age: { min_age: ages.length ? Math.min(...ages.map((g) => g.age_from)) : null, max_age: ages.length ? Math.max(...ages.map((g) => g.age_to)) : null },
    address: loc?.address,
    latitude: loc?.latitude,
    longitude: loc?.longitude,
    phone: a.phone,
    email: a.email,
    website: a.website,
    contacts_checked_at: a.contacts_checked_at,
    created_at: a.created_at,
    updated_at: a.updated_at,
    verified: !!a.contacts_checked_at,
    rating: rating(a.id),
    groups: a.groups.map((g) => strip({ ...g, location: strip({ ...g.location, org_id: undefined, name: undefined }) })),
    photos: a.photos,
    videos: a.videos,
  })
}
function strip(o) {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}
const isPublic = (a) => a.status === 'published' && a.is_active

// ---------- поиск, как в repo.go ----------
const TIMES = { morning: ['06:00', '12:00'], утро: ['06:00', '12:00'], day: ['12:00', '17:00'], день: ['12:00', '17:00'], evening: ['17:00', '20:00'], вечер: ['17:00', '20:00'] }
const dist = (la1, lo1, la2, lo2) => {
  const r = (x) => (x * Math.PI) / 180
  const a = Math.sin(r(la2 - la1) / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2
  return 12742000 * Math.asin(Math.sqrt(a))
}
function search(q) {
  const bad = (m) => {
    throw { status: 400, code: 'invalid_query', message: m }
  }
  const allowed = ['q', 'city', 'district', 'category', 'age', 'price_max', 'free', 'kind', 'online', 'verified', 'day', 'time', 'near', 'latitude', 'longitude', 'radius', 'sort', 'page', 'limit']
  for (const k of q.keys()) if (!allowed.includes(k)) bad(`неизвестный параметр ${k}`)
  const posInt = (k) => {
    const v = q.get(k)
    if (v == null || v === '') return undefined
    if (!/^\d+$/.test(v) || +v <= 0) bad(`${k} должен быть положительным числом`)
    return +v
  }
  const text = (q.get('q') ?? '').trim().toLowerCase()
  const city = posInt('city')
  const dists = (q.getAll('district').join(',') || '').split(',').filter(Boolean)
  if (dists.some((d) => !/^\d+$/.test(d))) bad('district')
  const cat = posInt('category')
  const age = q.get('age') != null ? +q.get('age') : undefined
  if (age !== undefined && (!Number.isInteger(age) || age < 0)) bad('age')
  const pmax = q.get('price_max') != null ? +q.get('price_max') : undefined
  const free = q.get('free')
  const kind = q.get('kind')
  const online = q.get('online')
  const verified = q.get('verified')
  const day = q.get('day') != null ? +q.get('day') : undefined
  if (day !== undefined && !(day >= 1 && day <= 7)) bad('day должен быть 1..7')
  const time = q.get('time')
  if (time && !TIMES[time]) bad('time')
  let near = null
  if (q.get('near')) {
    const [la, lo] = q.get('near').split(',').map(Number)
    if (!Number.isFinite(la) || !Number.isFinite(lo)) bad('near')
    near = [la, lo]
  }
  const radius = q.get('radius') ? +q.get('radius') : near ? 3000 : undefined
  const sort = q.get('sort') ?? 'relevance'
  if (!['relevance', 'near', 'rating', 'new', 'free', 'updated_week'].includes(sort)) bad('sort')
  if (sort === 'near' && !near) bad('sort=near требует координаты')
  const page = posInt('page') ?? 1
  const limit = posInt('limit') ?? 20
  if (limit > 100) bad('limit')
  const cats = cat ? subtree(String(cat)) : null

  let list = activities.filter(isPublic).filter((a) => {
    const o = orgOf(a)
    if (text && !(a.name + ' ' + a.description + ' ' + o.name + ' ' + catById.get(a.direction_id).c.name).toLowerCase().includes(text)) return false
    if (cats && !cats.includes(a.direction_id)) return false
    if (kind && a.record_type !== kind) return false
    if (online === 'true' && a.class_format === 'offline') return false
    if (online === 'false' && a.class_format !== 'offline') return false
    if (verified === 'true' && !a.contacts_checked_at) return false
    if (free === 'true' && !a.groups.some((g) => g.price_from === 0)) return false
    // все фильтры группы — на одной группе вместе с её местом
    return a.groups.some((g) => {
      const l = g.location
      if (city && l.city_id !== String(city)) return false
      if (dists.length && !dists.includes(l.district_id)) return false
      if (age !== undefined && !((g.age_from ?? 0) <= age && (g.age_to ?? 99) >= age)) return false
      if (pmax !== undefined && g.price_from > pmax) return false
      if (day && !g.schedules.some((s) => s.weekday === day)) return false
      if (time) {
        const [a1, b1] = TIMES[time]
        if (!g.schedules.some((s) => s.start_time.slice(0, 5) >= a1 && s.start_time.slice(0, 5) < b1)) return false
      }
      if (near && dist(near[0], near[1], l.latitude, l.longitude) > radius) return false
      return true
    })
  })
  const r = (a) => rating(a.id)
  if (sort === 'rating') list.sort((a, b) => r(b).score - r(a).score)
  else if (sort === 'new') list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  else if (sort === 'updated_week') list = list.filter((a) => now - Date.parse(a.updated_at) < 7 * 864e5).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  else if (sort === 'free') list.sort((a, b) => Math.min(...a.groups.map((g) => g.price_from)) - Math.min(...b.groups.map((g) => g.price_from)))
  else if (sort === 'near') list.sort((a, b) => dist(near[0], near[1], a.groups[0].location.latitude, a.groups[0].location.longitude) - dist(near[0], near[1], b.groups[0].location.latitude, b.groups[0].location.longitude))
  else list.sort((a, b) => r(b).votes_count - r(a).votes_count)
  return { items: list.slice((page - 1) * limit, page * limit).map(toCard), total: list.length, page, limit }
}

// ---------- HTTP ----------
const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'X-Request-ID': crypto.randomUUID() })
  res.end(body === undefined ? '' : JSON.stringify(body))
}
const err = (status, code, message) => ({ status, code, message })
async function readJSON(req, allowed) {
  let s = ''
  for await (const ch of req) s += ch
  let b
  try {
    b = JSON.parse(s || 'null')
  } catch {
    throw err(400, 'invalid_body', 'некорректный JSON')
  }
  if (allowed && b && typeof b === 'object')
    for (const k of Object.keys(b)) if (!allowed.includes(k)) throw err(400, 'invalid_body', `неизвестное поле ${k}`)
  return b ?? {}
}
async function readForm(req) {
  const r = new Request('http://x', { method: 'POST', headers: req.headers, body: req, duplex: 'half' })
  return r.formData()
}
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4' }

async function handle(req, res) {
  const u = new URL(req.url, 'http://x')
  const p = u.pathname
  const M = req.method
  const auth = tokens.get((req.headers.authorization ?? '').replace(/^Bearer /, ''))
  const me = users.find((x) => x.id === auth)
  const need = () => {
    if (!me) throw err(401, 'unauthorized', 'нужна авторизация')
    return me
  }
  const owner = () => {
    const u = need()
    if (!['section_owner', 'service_owner'].includes(u.account_type)) throw err(403, 'forbidden', 'нет прав')
    return u
  }
  const myOrg = (u) => orgs.find((o) => o.owner_id === u.id)
  let m

  // статика
  if (p.startsWith('/media/')) {
    const f = path.normalize(path.join(MEDIA, decodeURIComponent(p.slice(7))))
    if (!f.startsWith(MEDIA) || !fs.existsSync(f)) return send(res, 404, err(404, 'not_found', 'нет файла'))
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'max-age=3600' })
    return fs.createReadStream(f).pipe(res)
  }
  if (p === '/health' || p === '/ready') return send(res, 200, { status: 'ok' })

  // справочники и каталог
  if (M === 'GET' && p === '/api/v1/cities') return send(res, 200, cities)
  if (M === 'GET' && p === '/api/v1/districts') {
    const c = u.searchParams.get('city')
    return send(res, 200, districts.filter((d) => !c || d.city_id === c))
  }
  if (M === 'GET' && p === '/api/v1/categories') return send(res, 200, publicCats)
  if (M === 'GET' && (p === '/api/v1/activities' || p === '/api/cards')) return send(res, 200, search(u.searchParams))
  if (M === 'GET' && p === '/api/v1/recommended') {
    const c = u.searchParams.get('city')
    let l = activities.filter(isPublic).filter((a) => !c || a.groups.some((g) => g.location.city_id === c))
    l = l.filter((a) => rating(a.id).votes_count >= 3).sort((a, b) => rating(b.id).score - rating(a.id).score)
    return send(res, 200, { items: l.slice(0, 10).map(toCard), total: Math.min(10, l.length), page: 1, limit: 10 })
  }
  if ((m = p.match(/^\/api\/v1\/activities\/(\d+)\/reviews$/))) {
    const a = activities.find((x) => x.id === m[1] && isPublic(x))
    if (!a) throw err(404, 'not_found', 'опубликованная секция не найдена')
    if (M === 'GET') {
      const page = +(u.searchParams.get('page') || 1),
        limit = +(u.searchParams.get('limit') || 20)
      const l = reviews.filter((r) => r.activity_id === a.id && !r.hidden).sort((x, y) => y.created_at.localeCompare(x.created_at))
      return send(res, 200, { items: l.slice((page - 1) * limit, page * limit).map(reviewView), total: l.length, page, limit })
    }
    const user = need()
    const { text } = await readJSON(req, ['text'])
    if (!text?.trim()) throw err(400, 'invalid_fields', 'текст отзыва не должен быть пустым')
    if (orgOf(a).owner_id === user.id) throw err(403, 'own_review_forbidden', 'нельзя оставлять отзыв на свою секцию')
    if (reviews.some((r) => r.activity_id === a.id && r.author_id === user.id)) throw err(409, 'review_exists', 'ты уже оставлял отзыв')
    const r = { id: String(Math.max(0, ...reviews.map((x) => +x.id)) + 1), activity_id: a.id, author_id: user.id, author_name: user.name, text: text.trim(), created_at: new Date().toISOString(), photos: [], videos: [] }
    reviews.push(r)
    return send(res, 201, r)
  }
  if ((m = p.match(/^\/api\/v1\/activities\/(\d+)\/vote$/)) && M === 'POST') {
    const user = need()
    const a = activities.find((x) => x.id === m[1] && isPublic(x))
    if (!a) throw err(404, 'not_found', 'не найдено')
    const { value } = await readJSON(req, ['value'])
    if (![1, -1, null].includes(value)) throw err(400, 'invalid_fields', 'value: 1, -1 или null')
    if (value === null) votes.delete(`${user.id}:${a.id}`)
    else votes.set(`${user.id}:${a.id}`, value)
    const r = rating(a.id)
    return send(res, 200, { plus: r.likes, minus: r.dislikes })
  }
  if ((m = p.match(/^\/api\/v1\/activities\/([^/]+)$/)) && M === 'GET') {
    const a = activities.find((x) => (x.id === m[1] || x.slug === m[1]) && isPublic(x))
    if (!a) throw err(404, 'not_found', 'секция не найдена')
    return send(res, 200, { ...toCard(a), messengers: orgOf(a).messengers })
  }
  if ((m = p.match(/^\/api\/v1\/organizations\/(\d+)$/)) && M === 'GET') {
    const o = orgs.find((x) => x.id === m[1])
    if (!o) throw err(404, 'not_found', 'организация не найдена')
    const { owner_id, ...rest } = o
    return send(res, 200, {
      ...rest,
      locations: locations.filter((l) => l.org_id === o.id).map((l) => ({ ...strip({ ...l, org_id: undefined }), groups_count: 1 })),
      cards: activities.filter((a) => a.organization_id === o.id && isPublic(a)).map(toCard),
    })
  }

  // аккаунт
  if (M === 'POST' && p === '/api/v1/auth/register') {
    const b = await readJSON(req, ['email', 'password', 'name', 'account_type'])
    const email = String(b.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !b.name?.trim() || b.name.length > 120 || !b.password || b.password.length < 8)
      throw err(400, 'invalid_fields', 'проверь почту, имя и пароль (от 8 символов)')
    const type = b.account_type ?? 'user'
    if (!['user', 'section_owner', 'service_owner'].includes(type)) throw err(400, 'invalid_fields', 'недопустимый account_type')
    if (users.some((x) => x.email === email)) throw err(409, 'email_taken', 'почта занята')
    const token = crypto.randomBytes(24).toString('hex')
    pendingRegs.set(email, { email, name: b.name.trim(), type, password: b.password, token, at: Date.now() })
    const link = `/verify-email?token=${token}`
    console.log(`[mock] письмо подтверждения для ${email}: http://localhost:5173${link}`)
    return send(res, 202, {
      needs_email_verification: true,
      email,
      message: 'Открой письмо и подтверди почту, затем войди с паролем',
      demo_link: link, // только в тестовом API: «ссылка из письма» для демо
    })
  }
  if (M === 'POST' && p === '/api/v1/auth/email-verification/confirm') {
    const b = await readJSON(req, ['token'])
    const reg = [...pendingRegs.values()].find((x) => x.token === b.token && Date.now() - x.at < 15 * 60 * 1000)
    if (!reg) throw err(400, 'invalid_token', 'ссылка подтверждения недействительна или истекла')
    pendingRegs.delete(reg.email)
    if (users.some((x) => x.email === reg.email)) throw err(409, 'email_taken', 'аккаунт уже создан — войдите')
    addUser(reg.email, reg.name, reg.type, reg.password)
    return send(res, 200, { message: 'Почта подтверждена, аккаунт создан. Теперь можно войти' })
  }
  if (M === 'POST' && p === '/api/v1/auth/email-verification/resend') {
    const b = await readJSON(req, ['email'])
    const email = String(b.email ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err(400, 'invalid_email', 'некорректная почта')
    const reg = pendingRegs.get(email)
    if (reg && Date.now() - reg.at > 60 * 1000) {
      reg.token = crypto.randomBytes(24).toString('hex')
      reg.at = Date.now()
      console.log(`[mock] новое письмо для ${email}: http://localhost:5173/verify-email?token=${reg.token}`)
    }
    return send(res, 200, { message: 'Если регистрация ожидает подтверждения, письмо будет отправлено. Проверь почту и папку спам' })
  }
  if (M === 'POST' && p === '/api/v1/auth/login') {
    const b = await readJSON(req, ['email', 'password'])
    const x = users.find((y) => y.email === String(b.email ?? '').trim().toLowerCase())
    if (!x || x.pw !== hash(b.password ?? '')) throw err(401, 'invalid_credentials', 'неверная почта или пароль')
    return send(res, 200, { token: tokenFor(x), user: pub(x) })
  }
  if (p === '/api/auth/google') throw err(503, 'google_not_configured', 'вход через Google не настроен')
  if (M === 'POST' && p === '/api/v1/auth/password-reset/request') {
    await readJSON(req, ['email'])
    return send(res, 200, { message: 'Если почта зарегистрирована, письмо отправлено' })
  }
  if (M === 'POST' && p === '/api/v1/auth/password-reset/confirm') {
    const b = await readJSON(req, ['token', 'password'])
    if (b.token !== 'demo') throw err(400, 'invalid_token', 'ссылка недействительна или устарела')
    if ((b.password ?? '').length < 8) throw err(400, 'invalid_fields', 'пароль от 8 символов')
    return send(res, 200, { message: 'пароль изменён' })
  }
  if (p === '/api/v1/me') {
    const user = need()
    if (M === 'GET') return send(res, 200, pub(user))
    if (M === 'PUT') {
      const b = await readJSON(req, ['email', 'name'])
      if (!b.email || !b.name?.trim()) throw err(400, 'invalid_fields', 'email и name обязательны')
      if (b.email.trim().toLowerCase() !== user.email) throw err(400, 'email_change_requires_verification', 'смена почты пока недоступна')
      user.name = b.name.trim()
      return send(res, 200, pub(user))
    }
  }

  // избранное
  if (p === '/api/v1/me/favorites') {
    const user = need()
    const set = favorites.get(user.id) ?? new Set()
    favorites.set(user.id, set)
    if (M === 'GET') {
      const l = activities.filter((a) => set.has(a.id) && isPublic(a))
      return send(res, 200, { items: l.map(toCard), total: l.length, page: 1, limit: 100 })
    }
    const { card_id } = await readJSON(req, ['card_id'])
    if (typeof card_id !== 'string') throw err(400, 'invalid_body', 'card_id — строка')
    if (!activities.some((a) => a.id === card_id && isPublic(a))) throw err(404, 'not_found', 'карточка не найдена')
    if (set.has(card_id)) throw err(409, 'favorite_exists', 'уже в избранном')
    set.add(card_id)
    return send(res, 201)
  }
  if ((m = p.match(/^\/api\/v1\/me\/favorites\/(\d+)$/)) && M === 'DELETE') {
    const user = need()
    favorites.get(user.id)?.delete(m[1])
    return send(res, 204)
  }

  // кабинет владельца
  if (p === '/api/v1/me/organization') {
    const user = owner()
    const o = myOrg(user)
    if (M === 'GET') {
      if (!o) throw err(404, 'not_found', 'профиль организации не найден')
      const { owner_id, ...rest } = o
      return send(res, 200, { ...rest, locations: locations.filter((l) => l.org_id === o.id) })
    }
    const b = await readJSON(req, ['name', 'organization_type', 'description', 'phone', 'email', 'website', 'city_id', 'district_id', 'messengers', 'locations'])
    if (!b.name?.trim() || !b.phone?.trim() || !(b.city_id > 0)) throw err(400, 'invalid_fields', 'название, телефон и город обязательны')
    if (typeof b.city_id !== 'number') throw err(400, 'invalid_body', 'city_id — число')
    if (!['school', 'studio', 'art_house', 'sports_school', 'private_master'].includes(b.organization_type)) throw err(400, 'invalid_fields', 'недопустимый тип организации')
    if (b.website && !b.website.startsWith('https://')) throw err(400, 'invalid_fields', 'сайт должен начинаться с https://')
    if ((b.messengers ?? []).length > 4) throw err(400, 'invalid_fields', 'не более четырёх мессенджеров')
    const data = { name: b.name.trim(), type: b.organization_type, description: b.description, phone: b.phone, email: b.email, website: b.website, city_id: String(b.city_id), district_id: b.district_id ? String(b.district_id) : undefined, messengers: b.messengers ?? [] }
    if ((b.locations ?? []).length > 50) throw err(400, 'invalid_fields', 'не более 50 точек')
    for (const l of b.locations ?? []) {
      if (typeof l.city_id !== 'string' || !l.address?.trim()) throw err(400, 'invalid_fields', 'у точки нужны city_id (строка) и address')
      if ((l.latitude == null) !== (l.longitude == null)) throw err(400, 'invalid_fields', 'координаты точки — обе или ни одной')
    }
    let oo = o
    if (o) Object.assign(o, data)
    else {
      oo = addOrg(data.name, user.id, b.city_id - 1)
      Object.assign(oo, data)
      // addOrg создаёт демо-точку — у новой организации точки только из запроса
      for (let i = locations.length - 1; i >= 0; i--) if (locations[i].org_id === oo.id) locations.splice(i, 1)
    }
    for (const l of b.locations ?? []) {
      let loc = l.id ? locations.find((x) => x.id === l.id && x.org_id === oo.id) : locations.find((x) => x.org_id === oo.id && x.city_id === l.city_id && x.address === l.address.trim())
      if (l.id && !loc) throw err(403, 'forbidden', 'точка принадлежит другой организации')
      const cityIdx = +l.city_id - 1
      const d = districts.find((x) => x.id === l.district_id)
      if (!loc) {
        loc = { id: String(Math.max(0, ...locations.map((x) => +x.id)) + 1), org_id: oo.id }
        locations.push(loc)
      }
      Object.assign(loc, { name: l.name ?? null, city_id: l.city_id, city: CITY[cityIdx][0], district_id: d?.id, district: d?.name, address: l.address.trim(), latitude: l.latitude ?? undefined, longitude: l.longitude ?? undefined, phone: l.phone ?? undefined })
    }
    const { owner_id, ...rest } = oo
    return send(res, 200, { ...rest, locations: locations.filter((l) => l.org_id === oo.id).map((l) => ({ ...strip({ ...l, org_id: undefined }), groups_count: 0 })) })
  }
  if (p === '/api/v1/me/password' && M === 'POST') {
    const user = need()
    const b = await readJSON(req, ['current_password', 'new_password'])
    if (user.pw !== hash(b.current_password ?? '')) throw err(403, 'invalid_current_password', 'текущий пароль неверный')
    const n = String(b.new_password ?? '')
    if (Buffer.byteLength(n) < 8 || Buffer.byteLength(n) > 256 || n === b.current_password) throw err(400, 'invalid_fields', 'новый пароль 8–256 байт и отличается от текущего')
    user.pw = hash(n)
    return send(res, 200, { message: 'Пароль изменён' })
  }
  const ownedOf = (user) => {
    const o = myOrg(user)
    return o ? activities.filter((a) => a.organization_id === o.id) : []
  }
  const ownedView = (a) => ({ ...toCard(a), status: a.status, rejection_reason: a.rejection_reason, is_active: a.is_active })
  const applyInput = (user, b, a) => {
    const o = myOrg(user)
    if (!o) throw err(422, 'organization_required', 'сначала заполните профиль организации')
    if (!b.name?.trim() || b.name.length > 200) throw err(400, 'invalid_fields', 'название обязательно (до 200 символов)')
    if (typeof b.direction_id !== 'string' || !catById.has(b.direction_id)) throw err(400, 'invalid_fields', 'direction_id — строка с ID направления')
    const rt = b.record_type ?? 'activity'
    if ((user.account_type === 'service_owner') !== (rt === 'service')) throw err(403, 'forbidden', 'тип записи не соответствует аккаунту')
    if (rt === 'activity' && !['individual', 'group', 'both'].includes(b.class_type)) throw err(400, 'invalid_fields', 'class_type обязателен')
    if (rt === 'service' && b.class_type != null) throw err(400, 'invalid_fields', 'у услуги class_type не задаётся')
    if (!['online', 'offline', 'both'].includes(b.class_format)) throw err(400, 'invalid_fields', 'class_format')
    const keyToLoc = {}
    for (const l of b.locations ?? []) {
      const allowed = ['key', 'id', 'name', 'city_id', 'district_id', 'address', 'latitude', 'longitude', 'phone', 'source_type', 'source_url']
      for (const k of Object.keys(l)) if (!allowed.includes(k)) throw err(400, 'invalid_body', `неизвестное поле locations.${k}`)
      if (typeof l.city_id !== 'string') throw err(400, 'invalid_body', 'locations.city_id — строка')
      if (l.phone && !/^\+373 \d{3} \d{5}$/.test(l.phone)) throw err(400, 'invalid_fields', 'телефон места: +373 XXX XXXXX')
      let loc = l.id ? locations.find((x) => x.id === l.id && x.org_id === o.id) : null
      if (l.id && !loc) throw err(403, 'forbidden', 'место принадлежит другой организации')
      const cityIdx = +l.city_id - 1
      const d = districts.find((x) => x.id === l.district_id)
      const data = { city_id: l.city_id, city: CITY[cityIdx][0], district_id: d?.id, district: d?.name, address: l.address, latitude: l.latitude ?? undefined, longitude: l.longitude ?? undefined, phone: l.phone ?? undefined, name: l.name }
      if (!loc) {
        loc = { id: String(locations.length + 1), org_id: o.id }
        locations.push(loc)
      }
      Object.assign(loc, data)
      keyToLoc[l.key] = loc
    }
    const groups = (b.groups ?? []).map((g, i) => {
      const loc = keyToLoc[g.location_key]
      if (!loc) throw err(400, 'invalid_fields', `groups[${i}].location_key не найден среди locations`)
      if (g.price_from > 0 && !g.price_period) throw err(400, 'invalid_fields', 'price_period обязателен при цене > 0')
      for (const s of g.schedules ?? []) if (!(s.weekday >= 1 && s.weekday <= 7) || !/^\d\d:\d\d$/.test(s.start_time)) throw err(400, 'invalid_fields', 'расписание: weekday 1..7, время HH:MM')
      return strip({
        id: `${Date.now()}${i}`,
        name: g.name ?? undefined,
        age_from: g.age_from ?? undefined,
        age_to: g.age_to ?? undefined,
        price_from: g.price_from,
        price_to: g.price_to ?? undefined,
        price_period: g.price_period ?? undefined,
        location: loc,
        seats: g.seats ?? undefined,
        schedules: (g.schedules ?? []).map((s) => strip({ weekday: s.weekday, start_time: s.start_time + ':00', end_time: s.end_time + ':00', note: s.note ?? undefined })),
      })
    })
    Object.assign(a, { name: b.name.trim(), description: b.description, record_type: rt, direction_id: b.direction_id, class_type: b.class_type, class_format: b.class_format, phone: b.phone ?? undefined, groups, organization_id: o.id, updated_at: new Date().toISOString() })
    return a
  }
  if (p === '/api/v1/me/activities') {
    const user = owner()
    if (M === 'GET') return send(res, 200, ownedOf(user).slice(0, 100).map(ownedView))
    const b = await readJSON(req, ['name', 'description', 'record_type', 'direction_id', 'class_type', 'class_format', 'phone', 'locations', 'groups'])
    const a = { id: String(Math.max(0, ...activities.map((x) => +x.id)) + 1), status: 'draft', is_active: true, photos: [], videos: [], created_at: new Date().toISOString() }
    applyInput(user, b, a)
    a.slug = `${slugify(a.name) || 'activity'}-${a.id}`
    activities.push(a)
    return send(res, 201, { id: a.id, slug: a.slug, status: a.status })
  }
  if ((m = p.match(/^\/api\/v1\/me\/activities\/(\d+)(\/[a-z]+)?$/))) {
    const user = owner()
    const a = ownedOf(user).find((x) => x.id === m[1])
    if (!a) throw err(404, 'not_found', 'секция не найдена')
    const sub = m[2]
    if (!sub && M === 'GET') return send(res, 200, ownedView(a))
    if (!sub && M === 'PUT') {
      const b = await readJSON(req, ['name', 'description', 'record_type', 'direction_id', 'class_type', 'class_format', 'phone', 'locations', 'groups'])
      applyInput(user, b, a)
      if (a.status === 'published') a.status = 'pending'
      if (a.status === 'rejected') a.status = 'draft'
      return send(res, 200, ownedView(a))
    }
    if (!sub && M === 'DELETE') {
      if (!['draft', 'rejected'].includes(a.status)) throw err(409, 'invalid_status', 'удалить можно только черновик или отклонённую')
      activities.splice(activities.indexOf(a), 1)
      return send(res, 204)
    }
    if (sub === '/submit' && M === 'POST') {
      if (!['draft', 'rejected'].includes(a.status)) throw err(409, 'invalid_status', 'нельзя отправить в текущем статусе')
      const ready = a.groups.length && a.groups.every((g) => g.age_from != null && g.location?.address && g.location.latitude != null && g.schedules.length)
      if (!ready) throw err(422, 'not_ready', 'нужны группы с возрастом, адрес с координатами и расписание')
      a.status = 'pending'
      a.rejection_reason = undefined
      return send(res, 200, { id: a.id, status: a.status })
    }
    if (sub === '/unpublish' && M === 'POST') {
      if (a.status !== 'published' || !a.is_active) throw err(409, 'invalid_status', 'анкета не опубликована')
      a.is_active = false
      return send(res, 200, { id: a.id, status: a.status })
    }
    if (sub === '/videos' && M === 'POST') {
      const f = (await readForm(req)).get('file')
      if (!f || f.type !== 'video/mp4') throw err(415, 'invalid_video', 'нужен MP4')
      if (f.size > 50 * 1024 * 1024) throw err(413, 'file_too_large', 'больше 50 МБ')
      const name = `uploads/${crypto.randomUUID()}.mp4`
      fs.mkdirSync(path.join(MEDIA, 'uploads'), { recursive: true })
      fs.writeFileSync(path.join(MEDIA, name), Buffer.from(await f.arrayBuffer()))
      const v = { id: String(Date.now()), path: name, position: a.videos.length }
      a.videos.push(v)
      return send(res, 201, v)
    }
  }
  if ((m = p.match(/^\/api\/v1\/me\/activities\/(\d+)\/media\/(\d+)$/)) && M === 'DELETE') {
    const user = owner()
    const a = ownedOf(user).find((x) => x.id === m[1])
    if (!a) throw err(404, 'not_found', 'секция не найдена')
    a.photos = a.photos.filter((x) => x.id !== m[2])
    a.videos = a.videos.filter((x) => x.id !== m[2])
    a.photos.forEach((x, i) => (x.is_cover = i === 0))
    if (a.status === 'published') a.status = 'pending'
    return send(res, 204)
  }
  if (p === '/api/v1/upload' && M === 'POST') {
    const user = owner()
    const fd = await readForm(req)
    const a = ownedOf(user).find((x) => x.id === fd.get('activity_id'))
    if (!a) throw err(404, 'not_found', 'секция не найдена')
    const f = fd.get('file')
    if (!f || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) throw err(415, 'unsupported_file', 'JPG, PNG или WebP')
    if (f.size > 10 * 1024 * 1024) throw err(413, 'file_too_large', 'больше 10 МБ')
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[f.type]
    const name = `uploads/${crypto.randomUUID()}${ext}`
    fs.mkdirSync(path.join(MEDIA, 'uploads'), { recursive: true })
    fs.writeFileSync(path.join(MEDIA, name), Buffer.from(await f.arrayBuffer()))
    const ph = { id: String(Date.now()), path: name, alt_text: fd.get('caption') ?? undefined, position: a.photos.length, is_cover: a.photos.length === 0 }
    a.photos.push(strip(ph))
    return send(res, 201, ph)
  }

  // модерация
  if (p.startsWith('/api/v1/moderation/')) {
    const user = need()
    if (user.account_type !== 'moderator') throw err(403, 'forbidden', 'только модератор')
    if (p === '/api/v1/moderation/reports' && M === 'GET') {
      const st = u.searchParams.get('status') || 'open'
      const tt = u.searchParams.get('target_type')
      const l = reports.filter((r) => r.status === st && (!tt || r.target_type === tt)).map(({ reporter_id, ...v }) => v)
      return send(res, 200, { items: l, total: l.length, page: 1, limit: 100 })
    }
    if ((m = p.match(/^\/api\/v1\/moderation\/reports\/(\d+)\/decision$/)) && M === 'POST') {
      const rep = reports.find((r) => r.id === m[1])
      if (!rep) throw err(404, 'not_found', 'жалоба не найдена')
      if (rep.status !== 'open') throw err(409, 'already_decided', 'решение уже принято')
      const b = await readJSON(req, ['action', 'reason'])
      if (b.action === 'hide') {
        if (!b.reason?.trim()) throw err(400, 'invalid_fields', 'выберите hide с причиной до 1000 символов либо dismiss')
        rep.status = 'hidden'
        rep.hide_reason = b.reason.trim()
        if (rep.target_type === 'review') reviews.find((r) => r.id === rep.target_id).hidden = true
        if (rep.target_type === 'card') activities.find((a) => a.id === rep.target_id).is_active = false
      } else if (b.action === 'dismiss') rep.status = 'dismissed'
      else throw err(400, 'invalid_fields', 'action: hide или dismiss')
      const { reporter_id, ...view } = rep
      return send(res, 200, { report: view })
    }

    if (p === '/api/v1/moderation/activities' && M === 'GET') {
      const st = u.searchParams.get('status') ?? 'pending'
      if (!['pending', 'published', 'rejected'].includes(st)) throw err(400, 'invalid_query', 'status')
      return send(res, 200, activities.filter((a) => a.status === st).map((a) => strip({ id: a.id, slug: a.slug, name: a.name, status: a.status, rejection_reason: a.rejection_reason, photos: a.photos.slice(0, 1) })))
    }
    if ((m = p.match(/^\/api\/v1\/moderation\/activities\/(\d+)(\/approve|\/reject)?$/))) {
      const a = activities.find((x) => x.id === m[1])
      if (!a) throw err(404, 'not_found', 'не найдено')
      if (!m[2] && M === 'GET') return send(res, 200, ownedView(a))
      if (a.status !== 'pending') throw err(409, 'invalid_status', 'решение уже принято')
      if (m[2] === '/approve') {
        a.status = 'published'
        a.is_active = true
        a.contacts_checked_at = new Date().toISOString().slice(0, 10)
      } else {
        const { comment } = await readJSON(req, ['comment'])
        if (!comment || comment.trim().length < 3 || comment.length > 1000) throw err(400, 'invalid_fields', 'комментарий 3–1000 символов')
        a.status = 'rejected'
        a.rejection_reason = comment.trim()
      }
      return send(res, 200, { id: a.id, status: a.status })
    }
  }
  // ---- медиа отзыва (есть в project-pmr) ----
  if ((m = p.match(/^\/api\/v1\/reviews\/(\d+)\/(photos|videos)$/)) && M === 'POST') {
    const user = need()
    const r = reviews.find((x) => x.id === m[1] && x.author_id === user.id)
    if (!r) throw err(404, 'not_found', 'доступный отзыв не найден у этого пользователя')
    const video = m[2] === 'videos'
    if ((video && r.videos.length >= 1) || (!video && r.photos.length >= 5)) throw err(409, 'media_limit', 'к отзыву можно прикрепить до пяти фото и одного видео')
    const f = (await readForm(req)).get('file')
    if (!f) throw err(400, 'missing_file', 'прикрепите файл в поле file')
    if (video ? f.type !== 'video/mp4' : !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) throw err(415, 'invalid_media', 'неподдерживаемый формат')
    const ext = video ? '.mp4' : { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[f.type]
    const name = `uploads/${crypto.randomUUID()}${ext}`
    fs.mkdirSync(path.join(MEDIA, 'uploads'), { recursive: true })
    fs.writeFileSync(path.join(MEDIA, name), Buffer.from(await f.arrayBuffer()))
    const item = { id: String(Date.now()), path: name, position: (video ? r.videos : r.photos).length }
    if (video) r.videos.push(item)
    else r.photos.push({ ...item, is_cover: false })
    return send(res, 201, { ...item, media_type: video ? 'video' : 'photo' })
  }
  if ((m = p.match(/^\/api\/v1\/reviews\/(\d+)\/media\/(\d+)$/)) && M === 'DELETE') {
    const user = need()
    const r = reviews.find((x) => x.id === m[1] && x.author_id === user.id)
    if (!r) throw err(404, 'not_found', 'файл не найден у вашего отзыва')
    r.photos = r.photos.filter((x) => x.id !== m[2])
    r.videos = r.videos.filter((x) => x.id !== m[2])
    return send(res, 204)
  }

  // ---- жалобы (есть в project-pmr) ----
  if (p === '/api/v1/reports' && M === 'POST') {
    const user = need()
    const b = await readJSON(req, ['target_type', 'target_id', 'reason', 'detail'])
    if (!['card', 'review', 'media'].includes(b.target_type) || typeof b.target_id !== 'string' || !b.reason || b.reason.length > 120 || (b.detail ?? '').length > 2000)
      throw err(400, 'invalid_fields', 'укажите тип card, review или media, положительный target_id, причину до 120 и описание до 2000 символов')
    let card, excerpt
    if (b.target_type === 'card') {
      card = activities.find((a) => a.id === b.target_id)
      excerpt = card?.name
    } else if (b.target_type === 'review') {
      const r = reviews.find((x) => x.id === b.target_id)
      card = r && activities.find((a) => a.id === r.activity_id)
      excerpt = r?.text.slice(0, 200)
    }
    if (!card) throw err(404, 'not_found', 'запись не найдена или недоступна')
    if (reports.some((x) => x.reporter_id === user.id && x.target_type === b.target_type && x.target_id === b.target_id && x.status === 'open'))
      throw err(409, 'report_exists', 'вы уже пожаловались на эту запись')
    const rep = {
      id: String(reports.length + 1),
      reporter_id: user.id,
      target_type: b.target_type,
      target_id: b.target_id,
      card_id: card.id,
      card_slug: card.slug,
      card_title: card.name,
      target_excerpt: excerpt,
      reporter_name: user.name,
      reason: b.reason,
      detail: b.detail ?? '',
      status: 'open',
      hide_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    reports.push(rep)
    const { reporter_id, ...view } = rep
    return send(res, 201, view)
  }

  // ---- ЗАГОТОВКИ (в Go их ещё нет, контракт — BACKEND_INTEGRATION.md §4) ----
  if ((m = p.match(/^\/api\/v1\/reviews\/(\d+)\/vote$/)) && M === 'POST') {
    const user = need()
    const { value } = await readJSON(req, ['value'])
    if (![1, -1, null].includes(value)) throw err(400, 'invalid_fields', 'value: 1, -1 или null')
    const r = reviews.find((x) => x.id === m[1])
    if (!r) throw err(404, 'not_found', 'отзыв не найден')
    const k = `${user.id}:${m[1]}`
    if (value === null || reviewVotes.get(k) === value) reviewVotes.delete(k)
    else reviewVotes.set(k, value)
    return send(res, 200, reviewView(r).votes)
  }
  if ((m = p.match(/^\/api\/v1\/reviews\/(\d+)\/comments$/))) {
    const r = reviews.find((x) => x.id === m[1])
    if (!r) throw err(404, 'not_found', 'отзыв не найден')
    if (M === 'GET') return send(res, 200, { items: comments.filter((c) => c.review_id === r.id) })
    const user = need()
    const { text } = await readJSON(req, ['text'])
    if (!text?.trim() || text.length > 1000) throw err(400, 'invalid_fields', 'текст 1–1000 знаков')
    const a = activities.find((x) => x.id === r.activity_id)
    const c = { id: String(comments.length + 1), review_id: r.id, author_id: user.id, author_name: user.name, text: text.trim(), is_organization: orgOf(a)?.owner_id === user.id, created_at: new Date().toISOString() }
    comments.push(c)
    return send(res, 201, c)
  }
  if (p === '/api/v1/requests' && M === 'POST') {
    const b = await readJSON(req, ['query', 'city_id', 'contact'])
    if (!b.query?.trim()) throw err(400, 'invalid_fields', 'опишите, что ищете')
    requests.push({ ...b, id: String(requests.length + 1) })
    return send(res, 201, { id: String(requests.length) })
  }
  if (p === '/api/v1/search/popular' && M === 'GET') return send(res, 200, { items: ['танцы', 'футбол', 'английский', 'рисование', 'плавание'] })
  if (p === '/api/v1/me/organization/cover' && M === 'POST') {
    const user = owner()
    const o = myOrg(user)
    if (!o) throw err(404, 'not_found', 'сначала заполните профиль организации')
    const f = (await readForm(req)).get('file')
    if (!f) throw err(400, 'missing_file', 'прикрепите файл в поле file')
    const name = `uploads/${crypto.randomUUID()}.jpg`
    fs.mkdirSync(path.join(MEDIA, 'uploads'), { recursive: true })
    fs.writeFileSync(path.join(MEDIA, name), Buffer.from(await f.arrayBuffer()))
    o.cover_path = name
    return send(res, 200, { cover_path: name })
  }
  if ((m = p.match(/^\/api\/v1\/me\/activities\/(\d+)\/republish$/)) && M === 'POST') {
    const user = owner()
    const a = ownedOf(user).find((x) => x.id === m[1])
    if (!a) throw err(404, 'not_found', 'секция не найдена')
    if (a.status !== 'published' || a.is_active) throw err(409, 'invalid_status', 'анкета не снята с публикации')
    a.is_active = true
    return send(res, 200, { id: a.id, status: a.status })
  }

  throw err(404, 'not_found', `нет маршрута ${M} ${p}`)
}

http
  .createServer((req, res) => {
    handle(req, res).catch((e) => {
      if (e?.status) return send(res, e.status, { error: { code: e.code, message: e.message } })
      console.error(e)
      send(res, 500, { error: { code: 'internal_error', message: String(e?.message ?? e) } })
    })
  })
  .on('error', (e) => {
    // уже запущен в другом окне — не падаем, используем тот
    if (e.code === 'EADDRINUSE') console.log(`Тестовый API уже запущен на порту ${PORT}`)
    else throw e
  })
  .listen(PORT, () => console.log(`Тестовый API: http://localhost:${PORT}  (${activities.length} анкет, вход: user@test.md / password123)`))
