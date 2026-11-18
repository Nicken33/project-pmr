import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Api } from '../api/endpoints'
import type { Card } from '../api/types'
import { useRefs } from '../state/refs'
import { fromSearch, runSearch, toApi, toSearch } from '../lib/filters'
import { cardPrice } from '../lib/format'
import { useGeo } from '../lib/useGeo'
import { FiltersPanel } from '../components/catalog/FiltersPanel'
import { MapView, type MapPoint } from '../components/MapView'
import { SlidersHorizontal } from 'lucide-react'
import { cardLink } from '../components/cards/CardParts'

// Отдельного API карты нет: берём точки из групп карточек поиска (до 100 штук).
export default function MapPage() {
  const [sp, setSp] = useSearchParams()
  const filters = useMemo(() => fromSearch(sp), [sp])
  const { categories, loaded } = useRefs()
  const { coords, request } = useGeo()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(false)
  const useNear = filters.near || filters.sort === 'near'
  const geoForQuery = useNear ? coords : null

  useEffect(() => {
    if (!loaded) return
    // координаты нужны запросу только для «Рядом со мной» — иначе перетаскивание точки перезагружало бы метки
    const plan = toApi({ ...filters, page: 1 }, categories, geoForQuery)
    const ctrl = new AbortController()
    setLoading(true)
    plan.params.limit = 100
    runSearch(plan, (p) => Api.search(p, ctrl.signal))
      .then((r) => setCards(r.items))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [filters, categories, geoForQuery, loaded])

  const points = useMemo<MapPoint[]>(() => {
    const out: MapPoint[] = []
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    for (const c of cards) {
      const seen = new Set<string>()
      for (const g of c.groups ?? []) {
        const l = g.location
        if (!l || l.latitude == null || l.longitude == null || seen.has(l.id)) continue
        seen.add(l.id)
        out.push({
          id: `${c.id}-${l.id}`,
          lat: l.latitude,
          lng: l.longitude,
          title: c.name,
          html: `<div class="map-popup"><a href="${cardLink(c)}?point=${encodeURIComponent(l.id)}">${esc(c.name)}</a><br>${esc(l.address)}<br><b>${esc(cardPrice(c))}</b></div>`,
        })
      }
    }
    return out
  }, [cards])

  return (
    <div className="map-page">
      <div className="catalog__side">
        <FiltersPanel value={filters} onApply={(f) => setSp(toSearch(f))} coords={coords} requestCoords={request} />
      </div>
      <div style={{ position: 'relative' }}>
        <button type="button" className="btn btn--outline catalog__filters-btn" style={{ margin: '0 0 10px' }} onClick={() => setSheet(true)}>
          <SlidersHorizontal size={18} /> Фильтры
        </button>
        {filters.near && coords && (
          <div className="radius-chips" role="group" aria-label="Радиус поиска">
            {[500, 1000, 3000, 10000].map((r) => (
              <button
                key={r}
                type="button"
                className={`achip ${(filters.radius ?? 3000) === r ? 'is-on' : ''}`}
                onClick={() => setSp(toSearch({ ...filters, radius: r }))}
              >
                {r < 1000 ? `${r} м` : `${r / 1000} км`}
              </button>
            ))}
          </div>
        )}
        {filters.near && !coords && (
          <p className="map-hint">
            Разрешите доступ к местоположению — иначе список не будет отсортирован по расстоянию. Можно выбрать город вручную в фильтрах.
          </p>
        )}
        <MapView
          points={points}
          zoom={13}
          cluster
          locate
          me={coords}
          circle={filters.near && coords ? { lat: coords[0], lng: coords[1], radius: filters.radius ?? 3000 } : null}
        />
        {!loading && points.length === 0 && (
          <div className="toast" style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 500 }}>
            Нет занятий с адресом на карте
          </div>
        )}
      </div>
      {sheet && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Фильтры" onClick={() => setSheet(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <FiltersPanel value={filters} onApply={(f) => setSp(toSearch(f))} coords={coords} requestCoords={request} onClose={() => setSheet(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
