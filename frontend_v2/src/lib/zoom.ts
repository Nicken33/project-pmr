// Масштаб сайта на широких экранах: макет рассчитан на ~1280 px, на 1920 px всё становится в 1,5 раза крупнее
// (без пустых полей по краям). Все брейкпоинты CSS ≤ 1280 px, поэтому раскладка при масштабе не ломается.
// В CSS высоту экрана брать как calc(100vh / var(--zoom, 1)) — vh внутри zoom увеличиваются.
const BASE = 1280
const MAX = 1.6

export function fitZoom() {
  const z = Math.min(MAX, Math.max(1, window.innerWidth / BASE))
  const root = document.documentElement
  root.style.setProperty('zoom', z === 1 ? '' : z.toFixed(3))
  root.style.setProperty('--zoom', z.toFixed(3))
}

export function initZoom() {
  fitZoom()
  window.addEventListener('resize', fitZoom)
}
