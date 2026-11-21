// Поиск координат по адресу текстом (OpenStreetMap Nominatim, бесплатно, без ключа).
// Используется по кнопке «Найти на карте» — один запрос на нажатие (правило Nominatim: не чаще 1 в секунду).

let last = 0

/** Возвращает [широта, долгота] или null, если адрес не найден. */
export async function geocode(address: string, city?: string): Promise<[number, number] | null> {
  const q = [address.trim(), city?.trim(), 'Приднестровье'].filter(Boolean).join(', ')
  if (!address.trim()) return null
  const wait = 1100 - (Date.now() - last)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  last = Date.now()
  const tryQuery = async (text: string) => {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ru&countrycodes=md&q=${encodeURIComponent(text)}`
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error('geocode')
    const list = (await r.json()) as { lat: string; lon: string }[]
    return list[0] ? ([+(+list[0].lat).toFixed(6), +(+list[0].lon).toFixed(6)] as [number, number]) : null
  }
  // сначала с городом и регионом; если не нашлось — без региона
  return (await tryQuery(q)) ?? (city ? await tryQuery(`${address.trim()}, ${city.trim()}`) : null)
}
