// Карта на Leaflet + OpenStreetMap (бесплатно, без ключей).
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { DEFAULT_MAP_CENTER } from '../config'
import { clearManualPos, getManualPos, setManualPos } from '../lib/myPos'
import { fmtDist } from '../lib/useGeo'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  title?: string
  html?: string // содержимое всплывающей подсказки
}

const pin = L.divIcon({
  className: 'map-pin',
  html: '<svg viewBox="0 0 24 32" width="28" height="36"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0z" fill="#E5484D"/><circle cx="12" cy="11.5" r="4.6" fill="#fff"/></svg>',
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  popupAnchor: [0, -32],
})

const meIcon = L.divIcon({ className: 'map-me', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] })

export function MapView({
  points,
  zoom = 14,
  className,
  onPick,
  cluster,
  circle,
  locate,
  me,
  onLocate,
}: {
  points: MapPoint[]
  zoom?: number
  className?: string
  onPick?: (p: [number, number]) => void
  /** группировать метки при отдалении (ТЗ §3.5.2) */
  cluster?: boolean
  /** круг «рядом со мной»: центр и радиус в метрах */
  circle?: { lat: number; lng: number; radius: number } | null
  /** кнопка «Где я» на карте: показывает моё местоположение */
  locate?: boolean
  /** уже известные координаты пользователя (точка «Вы здесь» без нажатия) */
  me?: [number, number] | null
  /** сообщить наверх, что координаты получены */
  onLocate?: (c: [number, number]) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const circleRef = useRef<L.Circle | null>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const locateRef = useRef(onLocate)
  locateRef.current = onLocate
  const meLayer = useRef<L.LayerGroup | null>(null)
  const watchId = useRef<number | null>(null)

  const hintRef = useRef<HTMLDivElement | null>(null)
  const fitKey = useRef('') // чтобы не сбрасывать масштаб, если метки не поменялись

  /** Подсказка внизу карты: «примерно ±N км» или «указано вручную · сбросить». */
  const setHint = (html: string | null) => {
    const h = hintRef.current
    if (!h) return
    h.style.display = html ? '' : 'none'
    h.innerHTML = html ?? ''
  }

  /**
   * Рисуем «Вы здесь»: синяя точка + круг точности.
   * Точку можно перетащить на правильное место — оно запоминается (компьютер без GPS ошибается на километры).
   */
  const drawMe = (lat: number, lng: number, acc?: number, manual = false) => {
    const m = map.current
    if (!m) return
    meLayer.current?.remove()
    const g = L.layerGroup()
    if (acc && !manual) L.circle([lat, lng], { radius: acc, color: '#2f80ed', weight: 1, fillColor: '#2f80ed', fillOpacity: 0.08, interactive: false }).addTo(g)
    const mk = L.marker([lat, lng], { icon: meIcon, zIndexOffset: 1000, keyboard: false, draggable: true, title: 'Вы здесь — можно перетащить' })
      .bindTooltip(manual ? 'Вы здесь (указано вручную)' : 'Вы здесь', { direction: 'top', offset: [0, -10] })
      .addTo(g)
    mk.on('dragend', () => {
      const p = mk.getLatLng()
      const c: [number, number] = [+p.lat.toFixed(5), +p.lng.toFixed(5)]
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
      setManualPos(c)
      drawMe(c[0], c[1], undefined, true)
      locateRef.current?.(c)
    })
    meLayer.current = g.addTo(m)
    if (manual) setHint('Ваше место указано вручную. <button type="button" data-reset>Определить заново</button>')
    else if (acc && acc > 300)
      setHint(`Местоположение примерное (±${fmtDist(acc)}) — компьютер без GPS определяет его по сети. <b>Перетащите синюю точку</b> на своё место.`)
    else setHint(null)
  }

  /** Запуск определения: ручная точка важнее «по сети». */
  const startLocate = (btn?: HTMLElement, force = false) => {
    const m = map.current
    if (!m) return
    const manual = force ? null : getManualPos()
    if (manual) {
      drawMe(manual[0], manual[1], undefined, true)
      m.setView(manual, Math.max(m.getZoom(), 15), { animate: false })
      locateRef.current?.(manual)
      btn?.classList.add('is-on')
      return
    }
    if (!navigator.geolocation) return alert('Браузер не умеет определять местоположение')
    btn?.classList.add('is-busy')
    let first = true
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        btn?.classList.remove('is-busy')
        btn?.classList.add('is-on')
        const c: [number, number] = [+pos.coords.latitude.toFixed(5), +pos.coords.longitude.toFixed(5)]
        drawMe(c[0], c[1], pos.coords.accuracy)
        if (first) {
          // при большой ошибке показываем весь круг, чтобы было видно, насколько примерно
          if (pos.coords.accuracy > 300) m.fitBounds(L.latLng(c).toBounds(pos.coords.accuracy * 2), { animate: false })
          else m.setView(c, Math.max(m.getZoom(), 15), { animate: false })
          locateRef.current?.(c)
          first = false
        }
      },
      () => {
        btn?.classList.remove('is-busy')
        alert('Не удалось определить местоположение. Разрешите доступ к геопозиции в настройках браузера.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  useEffect(() => {
    if (!box.current || map.current) return
    const m = L.map(box.current, { scrollWheelZoom: false, attributionControl: true }).setView(DEFAULT_MAP_CENTER, zoom)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => pickRef.current?.([+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]))
    layer.current = (
      cluster
        ? L.markerClusterGroup({
            showCoverageOnHover: false,
            maxClusterRadius: 45,
            iconCreateFunction: (c) => L.divIcon({ className: 'map-cluster', html: `<span>${c.getChildCount()}</span>`, iconSize: [40, 40] }),
          })
        : L.layerGroup()
    ).addTo(m)
    map.current = m
    if (locate) {
      // кнопка «Где я» в углу карты
      const Ctl = L.Control.extend({
        onAdd: () => {
          const b = L.DomUtil.create('button', 'map-locate')
          b.type = 'button'
          b.title = 'Показать, где я'
          b.setAttribute('aria-label', 'Показать моё местоположение')
          b.innerHTML =
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>'
          L.DomEvent.disableClickPropagation(b)
          L.DomEvent.on(b, 'click', () => startLocate(b))
          return b
        },
      })
      new Ctl({ position: 'topleft' }).addTo(m)
    }
    const Hint = L.Control.extend({
      onAdd: () => {
        const d = L.DomUtil.create('div', 'map-hint-box')
        d.style.display = 'none'
        L.DomEvent.disableClickPropagation(d)
        L.DomEvent.on(d, 'click', (e) => {
          if ((e.target as HTMLElement).hasAttribute('data-reset')) {
            clearManualPos()
            startLocate(box.current?.querySelector('.map-locate') as HTMLElement, true)
          }
        })
        hintRef.current = d
        return d
      },
    })
    new Hint({ position: 'bottomleft' }).addTo(m)
    // контейнер может поменять размер после вёрстки — пересчитываем плитки
    let alive = true
    const ro = new ResizeObserver(() => alive && m.invalidateSize({ animate: false }))
    ro.observe(box.current)
    return () => {
      alive = false
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      ro.disconnect()
      m.stop() // гасим анимацию приближения, иначе Leaflet падает при уходе со страницы
      m.off()
      m.remove()
      map.current = null
      fitKey.current = '' // новая карта должна снова встать на метки
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    const key = valid.map((p) => p.id).join(',') + '|' + (circle ? `${circle.lat},${circle.lng},${circle.radius}` : '')
    const refit = key !== fitKey.current
    fitKey.current = key
    for (const p of valid) {
      const mk = L.marker([p.lat, p.lng], { icon: pin, title: p.title })
      if (p.html) mk.bindPopup(p.html)
      mk.addTo(g)
    }
    circleRef.current?.remove()
    circleRef.current = circle ? L.circle([circle.lat, circle.lng], { radius: circle.radius, color: '#6545c6', weight: 1.5, fillOpacity: 0.06 }).addTo(m) : null
    if (!refit) return // те же метки — масштаб и положение пользователя не трогаем
    if (circle) {
      m.fitBounds(circleRef.current!.getBounds(), { padding: [20, 20], animate: false })
      return
    }
    if (valid.length === 1) m.setView([valid[0].lat, valid[0].lng], zoom, { animate: false })
    else if (valid.length > 1) m.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 15, animate: false })
  }, [points, zoom, circle])

  // координаты пришли снаружи (например, «Рядом со мной») — тоже показываем точку
  useEffect(() => {
    if (me) {
      const manual = getManualPos()
      drawMe(me[0], me[1], undefined, !!manual && manual[0] === me[0] && manual[1] === me[1])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.[0], me?.[1]])

  return <div ref={box} className={`mapview ${className ?? ''}`} />
}
