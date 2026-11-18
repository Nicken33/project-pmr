// Избранное: набор ID карточек текущего пользователя (для сердечек на карточках).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Api } from '../api/endpoints'
import { useAuth } from './auth'
import { useToast } from './toast'
import { errorText } from '../api/client'

interface Fav {
  ids: Set<string>
  toggle: (cardId: string) => void
  reload: () => void
}

const Ctx = createContext<Fav>({ ids: new Set(), toggle: () => {}, reload: () => {} })

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())
  const nav = useNavigate()
  const toast = useToast()

  const reload = useCallback(() => {
    if (!user) return setIds(new Set())
    Api.favorites(1, 100)
      .then((r) => setIds(new Set((r.items ?? []).map((c) => c.id))))
      .catch(() => {})
  }, [user])

  useEffect(reload, [reload])

  const toggle = useCallback(
    (cardId: string) => {
      if (!user) {
        nav('/login', { state: { from: location.pathname } })
        return
      }
      const has = ids.has(cardId)
      const next = new Set(ids)
      if (has) next.delete(cardId)
      else next.add(cardId)
      setIds(next) // сразу показываем, при ошибке откатываем
      ;(has ? Api.removeFavorite(cardId) : Api.addFavorite(cardId)).catch((e) => {
        setIds(ids)
        toast(errorText(e), 'error')
      })
    },
    [ids, user, nav, toast],
  )

  return <Ctx.Provider value={{ ids, toggle, reload }}>{children}</Ctx.Provider>
}

export const useFavorites = () => useContext(Ctx)
