import { useEffect, useState } from 'react'

/**
 * «Телефон» = узкий экран или сенсорный ввод без мыши.
 * «Рядом со мной» показываем только на телефоне: на компьютере геопозиция по сети неточная (±км).
 */
const QUERY = '(max-width: 900px), (hover: none) and (pointer: coarse)'

export function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches
}

export function useIsPhone(): boolean {
  const [v, setV] = useState(isPhone)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setV(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return v
}
