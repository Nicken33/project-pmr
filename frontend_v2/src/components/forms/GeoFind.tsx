import { useState } from 'react'
import { Search } from 'lucide-react'
import { geocode } from '../../lib/geocode'
import { useRefs } from '../../state/refs'

/** Кнопка «Найти на карте по адресу»: ставит метку по введённому тексту, без клика по карте. */
export function GeoFind({ address, cityId, onFound }: { address: string; cityId: string; onFound: (p: [number, number]) => void }) {
  const { cities } = useRefs()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const city = cities.find((c) => c.id === cityId)?.name

  return (
    <span className="geofind">
      <button
        type="button"
        className="btn btn--soft btn--sm"
        disabled={busy || !address.trim()}
        title={address.trim() ? '' : 'Сначала введите улицу и дом'}
        onClick={async () => {
          setBusy(true)
          setMsg('')
          try {
            const p = await geocode(address, city)
            if (p) onFound(p)
            else setMsg('Адрес не нашёлся — уточните или поставьте метку на карте')
          } catch {
            setMsg('Поиск адреса сейчас недоступен — поставьте метку на карте')
          } finally {
            setBusy(false)
          }
        }}
      >
        <Search size={14} /> {busy ? 'Ищем…' : 'Найти на карте по адресу'}
      </button>
      {msg && <span className="geofind__msg">{msg}</span>}
    </span>
  )
}
