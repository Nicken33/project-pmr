import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Camera,
  Clock3,
  LayoutGrid,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Square,
  UsersRound,
  X,
} from 'lucide-react'
import { Api } from '../../api/endpoints'
import type { Category, District } from '../../api/types'
import { useRefs } from '../../state/refs'
import { counts, descendants, EMPTY, runSearch, toApi, type Filters, type TimeOfDay } from '../../lib/filters'
import { WEEKDAYS, fmtNum, plural } from '../../lib/format'
import { useIsPhone } from '../../lib/device'

type SectionKey = 'location' | 'category' | 'price' | 'format' | 'age' | 'days' | 'times'

interface Props {
  value: Filters
  onApply: (f: Filters) => void
  coords: [number, number] | null
  requestCoords: () => void
  /** Мобильный режим: панель открыта поверх страницы */
  onClose?: () => void
}

export function FiltersPanel({ value, onApply, coords, requestCoords, onClose }: Props) {
  const { cities, categories } = useRefs()
  const phone = useIsPhone()
  const [draft, setDraft] = useState<Filters>(value)
  const [open, setOpen] = useState<Set<SectionKey>>(new Set())
  const [total, setTotal] = useState<number | null>(null)
  const cnt = counts(draft)

  useEffect(() => setDraft(value), [value])

  // «Показать N результатов»: N пересчитываем при каждом изменении черновика
  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      const plan = toApi({ ...draft, page: 1 }, categories, coords)
      if (!plan.refine) plan.params.limit = 1
      runSearch(plan, (p) => Api.search(p, ctrl.signal))
        .then((r) => setTotal(r.total))
        .catch(() => {})
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [draft, categories, coords])

  const set = (patch: Partial<Filters>) => setDraft((d) => ({ ...d, ...patch, page: 1 }))
  const toggleOpen = (k: SectionKey) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const reset = () => {
    const f = { ...EMPTY, q: draft.q, sort: draft.sort }
    setDraft(f)
    onApply(f)
  }

  const cityName = cities.find((c) => c.id === draft.city)?.name

  return (
    <aside className={`filters panel ${onClose ? 'filters--sheet' : ''}`} aria-label="Фильтры">
      <div className="filters__head">
        <h2>Фильтры</h2>
        <button type="button" className="filters__reset" onClick={reset}>
          <RotateCcw size={11} strokeWidth={2.4} /> Сбросить
        </button>
        {onClose && (
          <button type="button" className="icon-btn filters__close" aria-label="Закрыть фильтры" onClick={onClose}>
            <X />
          </button>
        )}
      </div>

      <div className="filters__list">
        <Section
          k="location"
          icon={<MapPin size={17} />}
          title="Расположение"
          sub="Город · район"
          picked={draft.city ? `${cityName ?? ''}${draft.districts.length ? ' — ' : ''}` : ''}
          pickedExtra={draft.districts.length ? <DistrictNames city={draft.city} ids={draft.districts} /> : null}
          count={cnt.location}
          open={open}
          onToggle={toggleOpen}
        >
          <p className="filters__hint">Выберите город, затем район</p>
          <LocationTree draft={draft} set={set} />
        </Section>

        <Section
          k="category"
          icon={<LayoutGrid size={17} />}
          title="Категория"
          sub="Услуги · занятия"
          picked={[draft.kind === 'activity' ? 'Занятия' : draft.kind === 'service' ? 'Услуги' : '', pickedCategories(categories, draft.cats)].filter(Boolean).join(': ')}
          count={cnt.category + cnt.kind}
          open={open}
          onToggle={toggleOpen}
        >
          <p className="filters__label">Тип записи</p>
          <div className="row filters__radios">
            {(
              [
                ['', 'Все'],
                ['activity', 'Занятия'],
                ['service', 'Услуги'],
              ] as const
            ).map(([v, label]) => (
              <label className="check" key={v}>
                <input type="radio" name="kind" checked={draft.kind === v} onChange={() => set({ kind: v })} />
                {label}
              </label>
            ))}
          </div>
          <p className="filters__hint">Тип → направление → поднаправление</p>
          <CategoryTree tree={categories} selected={draft.cats} onChange={(cats) => set({ cats })} />
        </Section>

        <Section
          k="price"
          icon={<Banknote size={17} />}
          title="Цена"
          sub="Диапазон или бесплатно"
          picked={
            draft.priceMode === 'free'
              ? 'Бесплатно'
              : draft.priceMode === 'range'
                ? [draft.priceMin !== undefined && `от ${fmtNum(draft.priceMin)}`, draft.priceMax !== undefined && `до ${fmtNum(draft.priceMax)}`]
                    .filter(Boolean)
                    .join(' ') + ' руб.'
                : ''
          }
          count={cnt.price}
          open={open}
          onToggle={toggleOpen}
        >
          <p className="filters__label">Способ выбора цены</p>
          <div className="row filters__radios">
            <label className="check">
              <input type="radio" name="price" checked={draft.priceMode !== 'free'} onChange={() => set({ priceMode: 'range' })} />
              Диапазон
            </label>
            <label className="check">
              <input type="radio" name="price" checked={draft.priceMode === 'free'} onChange={() => set({ priceMode: 'free' })} />
              Бесплатно
            </label>
          </div>
          <div className="filters__range" aria-disabled={draft.priceMode === 'free'}>
            <NumField
              label="От, руб."
              value={draft.priceMin}
              disabled={draft.priceMode === 'free'}
              onChange={(v) => set({ priceMin: v, priceMode: v === undefined && draft.priceMax === undefined ? '' : 'range' })}
            />
            <NumField
              label="До, руб."
              value={draft.priceMax}
              disabled={draft.priceMode === 'free'}
              onChange={(v) => set({ priceMax: v, priceMode: v === undefined && draft.priceMin === undefined ? '' : 'range' })}
            />
          </div>
          <p className="filters__micro">Можно указать одну или обе границы</p>
        </Section>

        <Section
          k="format"
          icon={<Square size={17} />}
          title="Формат"
          sub="Онлайн · офлайн"
          picked={[draft.online && 'Онлайн', draft.offline && 'Офлайн'].filter(Boolean).join(', ')}
          count={cnt.format}
          open={open}
          onToggle={toggleOpen}
        >
          <div className="filters__checks">
            <label className="check">
              <input type="checkbox" checked={draft.online} onChange={(e) => set({ online: e.target.checked })} />
              Онлайн
            </label>
            <label className="check">
              <input type="checkbox" checked={draft.offline} onChange={(e) => set({ offline: e.target.checked })} />
              Офлайн
            </label>
          </div>
        </Section>

        <Section
          k="age"
          icon={<UsersRound size={17} />}
          title="Возраст"
          sub="От · до 99 лет"
          picked={
            cnt.age
              ? `${draft.ageMin ?? 0}–${draft.ageMax ?? 99} ${plural(draft.ageMax ?? 99, 'год', 'года', 'лет')}`
              : ''
          }
          count={cnt.age}
          open={open}
          onToggle={toggleOpen}
        >
          <div className="filters__age">
            <span>От</span>
            <NumField value={draft.ageMin} max={99} onChange={(v) => set({ ageMin: v })} label="Возраст от" hideLabel />
            <span>До</span>
            <NumField value={draft.ageMax} max={99} onChange={(v) => set({ ageMax: v })} label="Возраст до" hideLabel />
          </div>
        </Section>

        <Section
          k="days"
          icon={<CalendarDays size={17} />}
          title="День недели"
          sub="Пн · Вт · Ср · Чт · Пт · Сб · Вс"
          picked={draft.days
            .slice()
            .sort()
            .map((d) => WEEKDAYS[d - 1].slice(0, 2))
            .join(', ')}
          count={cnt.days}
          open={open}
          onToggle={toggleOpen}
        >
          <div className="filters__checks">
            {WEEKDAYS.map((w, i) => (
              <label className="check" key={w}>
                <input
                  type="checkbox"
                  checked={draft.days.includes(i + 1)}
                  onChange={(e) => set({ days: e.target.checked ? [...draft.days, i + 1] : draft.days.filter((d) => d !== i + 1) })}
                />
                {w}
              </label>
            ))}
          </div>
        </Section>

        <Section
          k="times"
          icon={<Clock3 size={17} />}
          title="Время"
          sub="Утро · день · вечер"
          picked={draft.times.map((t) => TIMES[t]).join(', ')}
          count={cnt.times}
          open={open}
          onToggle={toggleOpen}
        >
          <div className="filters__checks">
            {(Object.keys(TIMES) as TimeOfDay[]).map((t) => (
              <label className="check" key={t}>
                <input
                  type="checkbox"
                  checked={draft.times.includes(t)}
                  onChange={(e) => set({ times: e.target.checked ? [...draft.times, t] : draft.times.filter((x) => x !== t) })}
                />
                {TIMES[t]}
              </label>
            ))}
          </div>
        </Section>
      </div>

      <div className="filters__foot">
        <Toggle icon={<BadgeCheck size={18} />} label="Проверенные" on={draft.verified} onChange={(v) => set({ verified: v })} />
        {phone && (
        <Toggle
            icon={<MapPin size={18} />}
            label="Рядом со мной"
            on={draft.near}
            onChange={(v) => {
              if (v) requestCoords()
              set({ near: v })
            }}
          />
        )}
        <Toggle icon={<Camera size={18} />} label="Только с фото" on={draft.withPhoto} onChange={(v) => set({ withPhoto: v })} />
        <button
          type="button"
          className="btn btn--primary btn--block filters__apply"
          onClick={() => {
            onApply(draft)
            onClose?.()
          }}
        >
          {total === null ? 'Показать результаты' : `Показать ${fmtNum(total)} ${plural(total, 'результат', 'результата', 'результатов')}`}
        </button>
      </div>
    </aside>
  )
}

const TIMES: Record<TimeOfDay, string> = { morning: 'Утро', day: 'День', evening: 'Вечер' }

function Section(props: {
  k: SectionKey
  icon: ReactNode
  title: string
  sub: string
  picked?: string
  pickedExtra?: ReactNode
  count: number
  open: Set<SectionKey>
  onToggle: (k: SectionKey) => void
  children: ReactNode
}) {
  const isOpen = props.open.has(props.k)
  const id = `flt-${props.k}`
  return (
    <section className={`fsec ${isOpen ? 'fsec--open' : ''}`}>
      <button type="button" className="fsec__row" aria-expanded={isOpen} aria-controls={id} onClick={() => props.onToggle(props.k)}>
        <span className="fsec__icon">{props.icon}</span>
        <span className="fsec__text">
          <b>{props.title}</b>
          <small>{props.sub}</small>
          {!isOpen && (props.picked || props.pickedExtra) && (
            <em>
              {props.picked}
              {props.pickedExtra}
            </em>
          )}
        </span>
        {props.count > 0 && <span className="fsec__count">{props.count}</span>}
        <span className="fsec__pm">{isOpen ? <Minus size={18} /> : <Plus size={18} />}</span>
      </button>
      {isOpen && (
        <div className="fsec__body" id={id}>
          {props.children}
        </div>
      )}
    </section>
  )
}

function Toggle({ icon, label, on, onChange }: { icon: ReactNode; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="ftoggle">
      <span className="ftoggle__icon">{icon}</span>
      <span className="ftoggle__label">{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />
    </div>
  )
}

function NumField(props: {
  label: string
  value?: number
  onChange: (v: number | undefined) => void
  disabled?: boolean
  max?: number
  hideLabel?: boolean
}) {
  return (
    <label className="numfield">
      <span className={props.hideLabel ? 'sr-only' : ''}>{props.label}</span>
      <input
        className="input"
        inputMode="numeric"
        disabled={props.disabled}
        value={props.value ?? ''}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '')
          if (raw === '') return props.onChange(undefined)
          let n = Number(raw)
          if (props.max !== undefined) n = Math.min(n, props.max)
          props.onChange(n)
        }}
      />
    </label>
  )
}

// ---------- Расположение: города → районы ----------

const districtCache = new Map<string, Promise<District[]>>()
function loadDistricts(city: string) {
  if (!districtCache.has(city)) districtCache.set(city, Api.districts(city).catch(() => []))
  return districtCache.get(city)!
}

function useDistricts(city: string | null) {
  const [list, setList] = useState<District[] | null>(null)
  useEffect(() => {
    if (!city) return
    let alive = true
    loadDistricts(city).then((l) => alive && setList(l))
    return () => {
      alive = false
    }
  }, [city])
  return list
}

function DistrictNames({ city, ids }: { city: string; ids: string[] }) {
  const list = useDistricts(city)
  if (!list) return null
  return <>{list.filter((d) => ids.includes(d.id)).map((d) => d.name).join(', ')}</>
}

function LocationTree({ draft, set }: { draft: Filters; set: (p: Partial<Filters>) => void }) {
  const { cities } = useRefs()
  const [expanded, setExpanded] = useState<string | null>(draft.city || null)
  if (!cities.length) return <p className="filters__micro">Список городов недоступен</p>
  return (
    <ul className="ftree">
      {cities.map((c) => {
        const isOpen = expanded === c.id
        const whole = draft.city === c.id && !draft.districts.length
        return (
          <li key={c.id}>
            <div className="ftree__row ftree__row--root">
              <button
                type="button"
                className="ftree__pm"
                aria-label={isOpen ? 'Свернуть' : 'Раскрыть'}
                onClick={() => setExpanded(isOpen ? null : c.id)}
              >
                {isOpen ? <Minus size={12} /> : <Plus size={12} />}
              </button>
              <button
                type="button"
                className={`ftree__name ${draft.city === c.id ? 'is-on' : ''}`}
                onClick={() => {
                  // выбор всего города (API фильтрует по одному городу)
                  set(draft.city === c.id && !draft.districts.length ? { city: '', districts: [] } : { city: c.id, districts: [] })
                  setExpanded(c.id)
                }}
              >
                {c.name}
              </button>
              {whole && <span className="ftree__tag">весь город</span>}
            </div>
            {isOpen && <DistrictList city={c.id} draft={draft} set={set} />}
          </li>
        )
      })}
    </ul>
  )
}

function DistrictList({ city, draft, set }: { city: string; draft: Filters; set: (p: Partial<Filters>) => void }) {
  const list = useDistricts(city)
  if (!list) return <div className="filters__micro">Загрузка…</div>
  if (!list.length) return <div className="filters__micro ftree__nest">Районов нет</div>
  const sel = draft.city === city ? draft.districts : []
  return (
    <ul className="ftree__nest">
      {list.map((d) => (
        <li key={d.id}>
          <label className="check">
            <input
              type="checkbox"
              checked={sel.includes(d.id)}
              onChange={(e) => {
                const next = e.target.checked ? [...sel, d.id] : sel.filter((x) => x !== d.id)
                // сняли последний район — снимаем и город, иначе фильтр «весь город» остаётся и число результатов не возвращается
                set(next.length ? { city, districts: next } : { city: '', districts: [] })
              }}
            />
            {d.name}
          </label>
        </li>
      ))}
    </ul>
  )
}

// ---------- Категории: тип → направление → поднаправление ----------

function pickedCategories(tree: Category[], ids: string[]) {
  if (!ids.length) return ''
  const names: string[] = []
  const walk = (l: Category[]) => {
    for (const c of l) {
      if (ids.includes(c.id)) names.push(c.name)
      else if (c.children) walk(c.children)
    }
  }
  walk(tree)
  return names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '')
}

/** Выбранные «листья» узла: если узел выбран целиком — считаем все его потомки выбранными. */
function useSelectionState(tree: Category[], selected: string[]) {
  return useMemo(() => {
    const sel = new Set(selected)
    const covered = new Set<string>()
    const mark = (c: Category, inherited: boolean) => {
      const on = inherited || sel.has(c.id)
      if (on) covered.add(c.id)
      c.children?.forEach((ch) => mark(ch, on))
    }
    tree.forEach((c) => mark(c, false))
    return covered
  }, [tree, selected])
}

function CategoryTree({ tree, selected, onChange }: { tree: Category[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const covered = useSelectionState(tree, selected)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const groups = useMemo(() => {
    const act = tree.filter((c) => c.record_type !== 'service')
    const srv = tree.filter((c) => c.record_type === 'service')
    return [
      { id: 'type-activity', name: 'Занятия', children: act },
      { id: 'type-service', name: 'Услуги', children: srv },
    ].filter((g) => g.children.length)
  }, [tree])

  const toggleOpen = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // Сжимаем выбор: если выбраны все дети — оставляем родителя
  const normalize = (ids: Set<string>) => {
    const out = new Set(ids)
    const up = (c: Category): boolean => {
      if (!c.children?.length) return out.has(c.id)
      const all = c.children.map(up).every(Boolean)
      if (all) {
        c.children.forEach((ch) => descendants(ch).forEach((d) => out.delete(d)))
        out.add(c.id)
      }
      return out.has(c.id)
    }
    tree.forEach(up)
    return [...out]
  }

  const setNode = (c: Category, on: boolean, ancestors: Category[]) => {
    const ids = new Set(selected)
    descendants(c).forEach((d) => ids.delete(d))
    if (on) ids.add(c.id)
    else {
      // снимаем с выбранного предка и раскладываем его на братьев
      for (let i = ancestors.length - 1; i >= 0; i--) {
        const a = ancestors[i]
        if (ids.has(a.id)) {
          ids.delete(a.id)
          let child: Category | undefined = c
          for (let j = ancestors.length - 1; j >= i; j--) {
            const parent = ancestors[j]
            parent.children?.forEach((s) => s.id !== child!.id && ids.add(s.id))
            child = parent
          }
          break
        }
      }
    }
    onChange(normalize(ids))
  }

  const state = (c: Category): 'on' | 'off' | 'part' => {
    if (covered.has(c.id)) return 'on'
    const any = (x: Category): boolean => covered.has(x.id) || !!x.children?.some(any)
    return c.children?.some(any) ? 'part' : 'off'
  }

  const renderNode = (c: Category, depth: number, ancestors: Category[]): ReactNode => {
    const hasKids = !!c.children?.length
    const isOpen = openIds.has(c.id)
    const st = state(c)
    return (
      <li key={c.id}>
        <div className={`ftree__row ${depth === 0 ? 'ftree__row--root' : ''}`}>
          {hasKids ? (
            <button type="button" className="ftree__pm" aria-label={isOpen ? 'Свернуть' : 'Раскрыть'} onClick={() => toggleOpen(c.id)}>
              {isOpen ? <Minus size={12} /> : <Plus size={12} />}
            </button>
          ) : (
            <span className="ftree__pm ftree__pm--none" />
          )}
          <label className={`check ftree__label ${hasKids ? 'ftree__label--branch' : ''}`}>
            {!hasKids && <Tri state={st} onChange={(on) => setNode(c, on, ancestors)} />}
            <span>{c.name}</span>
          </label>
          {hasKids && <Tri state={st} onChange={(on) => setNode(c, on, ancestors)} className="ftree__tri-right" />}
        </div>
        {hasKids && isOpen && <ul className="ftree__nest">{c.children!.map((ch) => renderNode(ch, depth + 1, [...ancestors, c]))}</ul>}
      </li>
    )
  }

  if (!tree.length) return <p className="filters__micro">Направления недоступны</p>

  return (
    <ul className="ftree">
      {groups.map((g) => {
        const isOpen = !openIds.has(g.id) // типы раскрыты по умолчанию
        return (
          <li key={g.id}>
            <div className="ftree__row ftree__row--root">
              <button type="button" className="ftree__pm" onClick={() => toggleOpen(g.id)} aria-label={isOpen ? 'Свернуть' : 'Раскрыть'}>
                {isOpen ? <Minus size={12} /> : <Plus size={12} />}
              </button>
              <b className="ftree__type">{g.name}</b>
            </div>
            {isOpen && <ul className="ftree__nest">{g.children.map((c) => renderNode(c, 1, []))}</ul>}
          </li>
        )
      })}
    </ul>
  )
}

function Tri({ state, onChange, className }: { state: 'on' | 'off' | 'part'; onChange: (on: boolean) => void; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'part'
  }, [state])
  return (
    <span className={`check ${className ?? ''}`}>
      <input ref={ref} type="checkbox" checked={state === 'on'} onChange={(e) => onChange(e.target.checked)} />
    </span>
  )
}
