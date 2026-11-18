import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../state/toast'
import { getManualPos } from './myPos'

/**
 * Координаты пользователя для «Рядом со мной». Спрашиваем только по нажатию.
 * Если пользователь сам поставил точку на карте — берём её (она точнее, чем «по сети»).
 */
export function useGeo() {
  const [coords, setCoords] = useState<[number, number] | null>(() => getManualPos())
  const toast = useToast()

  // точку поправили на карте — обновляемся
  useEffect(() => {
    const on = () => {
      const m = getManualPos()
      if (m) setCoords(m)
    }
    window.addEventListener('talentro:mypos', on)
    return () => window.removeEventListener('talentro:mypos', on)
  }, [])

  const request = useCallback(() => {
    if (coords) return
    if (!navigator.geolocation) {
      toast('Браузер не умеет определять местоположение', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords([+p.coords.latitude.toFixed(5), +p.coords.longitude.toFixed(5)])
        if (p.coords.accuracy > 500)
          toast(`Местоположение примерное (±${fmtDist(p.coords.accuracy)}). Его можно поправить на карте — перетащите синюю точку`, 'info')
      },
      () => toast('Не удалось определить местоположение — разрешите доступ в браузере', 'error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 600000 },
    )
  }, [coords, toast])
  return { coords, request }
}

export function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',').replace(',0', '')} км` : `${Math.round(m / 10) * 10} м`
}
