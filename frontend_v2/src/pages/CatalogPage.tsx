import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, LayoutGrid, List, SlidersHorizontal } from 'lucide-react'
import { Api } from '../api/endpoints'
import type { Card, Paged } from '../api/types'
import { errorText } from '../api/client'
import { useRefs } from '../state/refs'
import { EMPTY, fromSearch, toApi, toSearch, counts, runSearch, isEmpty, findPath, type Filters, type SortKey } from '../lib/filters'
import { fmtNum, plural } from '../lib/format'
import { useGeo } from '../lib/useGeo'
import { useIsPhone } from '../lib/device'
import { FiltersPanel } from '../components/catalog/FiltersPanel'
import { Hero } from '../components/catalog/Hero'
import { CategoryBar } from '../components/catalog/CategoryBar'
import { CardMini } from '../components/cards/CardMini'
import { CardFull } from '../components/cards/CardFull'
import { ActiveChips } from '../components/catalog/ActiveChips'
import { OwnerNotice } from '../components/OwnerNotice'
import { NotFoundRequest, PopularSearches } from '../components/catalog/NotFoundHelp'
import { rememberFilters } from '../lib/groups'

const SORTS: { v: SortKey; label: string }[] = [
  { v: 'relevance', label: 'По популярности' },
  { v: 'rating', label: 'По рейтингу' },
  { v: 'new', label: 'Сначала новые' },
  { v: 'updated_week', label: 'Обновлённые за неделю' },
  { v: 'free', label: 'Сначала бесплатные' },
  { v: 'near', label: 'Ближе ко мне' },
]

export default function CatalogPage({ home }: { home?: boolean }) {
  const [sp, setSp] = useSearchParams()
  const loc = useLocation()
  const phone = useIsPhone()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => fromSearch(sp), [sp, phone])
  const { categories, loaded } = useRefs()
  const { coords, request } = useGeo()
  const [data, setData] = useState<Paged<Card> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [recommended, setRecommended] = useState<Card[] | null>(null)
  const [layout, setLayout] = useState<'grid' | 'list'>(() => (localStorage.getItem('talentro.layout') as 'list') || 'grid')
  const [sheet, setSheet] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const [retry, setRetry] = useState(0)
  const [related, setRelated] = useState<Card[]>([])

  // фильтры нужны странице секции, чтобы раскрыть подходящую группу
  useEffect(() => rememberFilters(sp.toString()), [sp])

  const apply = (f: Filters) => setSp(toSearch(f), { replace: false })

  // Нужна геопозиция, если она выбрана в адресе
  useEffect(() => {
    if (filters.near || filters.sort === 'near') request()
  }, [filters.near, filters.sort, request])

  // Каталог: прокрутить к списку
  useEffect(() => {
    if (!home && loc.pathname === '/catalog' && !sp.toString()) listRef.current?.scrollIntoView({ block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home])

  const PAGE = 20
  const plan = useMemo(() => {
    if (!loaded) return null
    const p = toApi({ ...filters, page: 1 }, categories, coords)
    // «Показать ещё»: грузим сразу все показанные порции одним запросом (до 100)
    p.params.page = 1
    p.params.limit = Math.min(100, PAGE * filters.page)
    return p
  }, [filters, categories, coords, loaded])

  useEffect(() => {
    if (!plan) return
    const ctrl = new AbortController()
    setLoading(true)
    setError('')
    runSearch(plan, (p) => Api.search(p, ctrl.signal))
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(errorText(e))
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false))
    return () => ctrl.abort()
  }, [plan, retry])

  // пусто → три карточки «рядом по теме»: то же наднаправление без остальных фильтров
  useEffect(() => {
    if (!data || data.total > 0) return setRelated([])
    const root = filters.cats.length ? (findPath(categories, filters.cats[0])?.[0]?.id ?? undefined) : undefined
    Api.search({ category: root, limit: 3 })
      .then((r) => setRelated(r.items ?? []))
      .catch(() => setRelated([]))
  }, [data, filters.cats, categories])

  useEffect(() => {
    Api.recommended(filters.city || undefined)
      .then((r) => setRecommended(r.items ?? []))
      .catch(() => setRecommended([]))
  }, [filters.city])

  const items = data?.items ?? []

  const activeRoot = filters.cats.length === 1 && categories.some((c) => c.id === filters.cats[0]) ? filters.cats[0] : null
  // выбрано только направление, других фильтров нет
  const onlyCategory = filters.cats.length > 0 && isEmpty({ ...filters, cats: [] }) && !filters.q
  const badge = Object.values(counts(filters)).reduce((a, b) => a + b, 0) + (filters.verified ? 1 : 0) + (filters.near ? 1 : 0) + (filters.withPhoto ? 1 : 0)

  return (
    <div className="catalog">
      <div className="catalog__side">
        <FiltersPanel value={filters} onApply={apply} coords={coords} requestCoords={request} />
      </div>

      <div className="catalog__main">
        <OwnerNotice />
        <Hero query={filters.q} onSearch={(q) => apply({ ...filters, q, page: 1 })} />

        <button type="button" className="btn btn--outline catalog__filters-btn" onClick={() => setSheet(true)}>
          <SlidersHorizontal size={18} /> Фильтры {badge > 0 && <span className="fsec__count">{badge}</span>}
        </button>

        <CategoryBar categories={categories} active={activeRoot} onPick={(id) => apply({ ...filters, cats: id ? [id] : [], page: 1 })} />

        {(recommended === null || recommended.length > 0) && (
          <section className="rec">
            <div className="sec-head">
              <h2>Рекомендуемое</h2>
              <Link to="/catalog?sort=rating" className="sec-head__more">
                Смотреть все <ArrowRight size={14} />
              </Link>
            </div>
            <div className="rec__row">
              {recommended === null
                ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton cmini-skel" />)
                : recommended.slice(0, 6).map((c) => <CardMini key={c.id} c={c} />)}
            </div>
          </section>
        )}

        <section className="all" ref={listRef}>
          <div className="sec-head">
            <h2>Все занятия и услуги</h2>
            {data && (
              <span className="sec-head__found">
                Найдено {fmtNum(data.total)} {plural(data.total, 'вариант', 'варианта', 'вариантов')}
              </span>
            )}
            <div className="sec-head__tools">
              <select
                className="sort"
                aria-label="Сортировка"
                value={filters.sort}
                onChange={(e) => {
                  const sort = e.target.value as SortKey
                  if (sort === 'near') request()
                  apply({ ...filters, sort, page: 1 })
                }}
              >
                {SORTS.filter((s) => s.v !== 'near' || phone).map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="viewtoggle" role="group" aria-label="Вид списка">
                {(['grid', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={layout === v}
                    aria-label={v === 'grid' ? 'Плиткой' : 'Списком'}
                    onClick={() => {
                      setLayout(v)
                      localStorage.setItem('talentro.layout', v)
                    }}
                  >
                    {v === 'grid' ? <LayoutGrid size={18} /> : <List size={20} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ActiveChips f={filters} onChange={apply} />

          {error ? (
            <div className="empty panel">
              <h3>Не удалось загрузить каталог</h3>
              <p>{error}</p>
              <button type="button" className="btn btn--solid" style={{ marginTop: 14 }} onClick={() => setRetry((n) => n + 1)}>
                Повторить
              </button>
            </div>
          ) : loading && !data ? (
            <div className={`cgrid cgrid--${layout}`}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="skeleton cfull-skel" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="empty panel">
              {onlyCategory ? (
                <>
                  <h3>В этом направлении пока нет анкет</h3>
                  <p>Загляните позже или выберите другое направление.</p>
                </>
              ) : (
                <>
                  <h3>Ничего не нашлось</h3>
                  <p>Попробуйте убрать часть фильтров или изменить запрос.</p>
                </>
              )}
              <button type="button" className="btn btn--solid" style={{ marginTop: 14 }} onClick={() => apply({ ...EMPTY, sort: filters.sort })}>
                Сбросить фильтры
              </button>
              {filters.q && <PopularSearches onPick={(q) => apply({ ...EMPTY, q })} />}
              {related.length > 0 && (
                <div className="related">
                  <h4>Рядом по теме</h4>
                  <div className="cgrid cgrid--grid">
                    {related.map((c) => (
                      <CardFull key={c.id} c={c} />
                    ))}
                  </div>
                </div>
              )}
              <NotFoundRequest query={filters.q} city={filters.city} />
            </div>
          ) : (
            <div className={`cgrid cgrid--${layout} ${loading ? 'is-loading' : ''}`}>
              {items.map((c) => (
                <CardFull key={c.id} c={c} layout={layout} filters={filters} near={coords} />
              ))}
            </div>
          )}

          {data && items.length < data.total && (
            <div className="showmore">
              <button
                type="button"
                className="btn btn--outline btn--lg"
                disabled={loading || filters.page * PAGE >= 100}
                onClick={() => setSp(toSearch({ ...filters, page: filters.page + 1 }), { replace: true, preventScrollReset: true })}
              >
                {loading ? 'Загружаем…' : `Показать ещё (${Math.min(PAGE, data.total - items.length)})`}
              </button>
              <span className="muted">
                Показано {items.length} из {data.total}
              </span>
            </div>
          )}
        </section>
      </div>

      {sheet && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Фильтры" onClick={() => setSheet(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <FiltersPanel value={filters} onApply={apply} coords={coords} requestCoords={request} onClose={() => setSheet(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
