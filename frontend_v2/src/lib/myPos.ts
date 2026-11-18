// Местоположение пользователя, которое он поправил вручную (перетащил точку «Вы здесь»).
// Компьютер без GPS определяет место по сети с ошибкой в километры — ручная точка важнее.
const KEY = 'talentro.myPos'

export function getManualPos(): [number, number] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    return Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) ? (v as [number, number]) : null
  } catch {
    return null
  }
}

export function setManualPos(c: [number, number]) {
  localStorage.setItem(KEY, JSON.stringify(c))
  window.dispatchEvent(new Event('talentro:mypos'))
}

export function clearManualPos() {
  localStorage.removeItem(KEY)
  window.dispatchEvent(new Event('talentro:mypos'))
}
