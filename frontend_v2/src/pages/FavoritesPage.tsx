import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Api } from '../api/endpoints'
import type { Card } from '../api/types'
import { errorText } from '../api/client'
import { useFavorites } from '../state/favorites'
import { CardMini } from '../components/cards/CardMini'

export default function FavoritesPage() {
  const { ids, toggle, markSeen } = useFavorites()
  // открыли «Избранное» — всё просмотрено, красный бейдж в шапке пропадает
  useEffect(markSeen, [markSeen])
  const [items, setItems] = useState<Card[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    Api.favorites(1, 100)
      .then((r) => setItems(r.items ?? []))
      .catch((e) => setErr(errorText(e)))
  }, [])

  // снятое сердечко сразу убирает карточку из списка
  const shown = (items ?? []).filter((c) => ids.has(c.id))

  return (
    <div>
      <h1 className="page-title">
        Избранное <span className="count">({items ? shown.length : '…'})</span>
      </h1>
      {err ? (
        <div className="empty panel">
          <h3>Не удалось загрузить избранное</h3>
          <p>{err}</p>
        </div>
      ) : !items ? (
        <div className="spinner" />
      ) : shown.length === 0 ? (
        <div className="empty panel">
          <h3>Пока пусто</h3>
          <p>
            Нажимайте ♡ на карточках, чтобы сохранить их здесь. <Link to="/catalog">Перейти в каталог</Link>
          </p>
        </div>
      ) : (
        <div className="fav-grid">
          {shown.map((c) => (
            <CardMini key={c.id} c={c} onRemove={() => toggle(c.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
