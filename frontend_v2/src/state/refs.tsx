// Справочники (города, направления) — грузятся один раз на всё приложение.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Api } from '../api/endpoints'
import type { Category, City } from '../api/types'

interface Refs {
  cities: City[]
  categories: Category[]
  loaded: boolean
  /** Плоский словарь id → направление, с родителем */
  catIndex: Map<string, { cat: Category; parent?: Category; root: Category }>
}

const Ctx = createContext<Refs>({ cities: [], categories: [], loaded: false, catIndex: new Map() })

export function RefsProvider({ children }: { children: ReactNode }) {
  const [cities, setCities] = useState<City[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    let timer = 0
    // при сбое сети повторяем (2, 4, 8… до 30 с) и при возврате на вкладку — иначе списки городов останутся пустыми
    const load = (attempt = 0) =>
      Promise.allSettled([Api.cities(), Api.categories()]).then(([c, k]) => {
        if (!alive) return
        if (c.status === 'fulfilled') setCities(c.value ?? [])
        if (k.status === 'fulfilled') setCategories(k.value ?? [])
        setLoaded(true)
        timer = 0
        if (c.status === 'rejected' || k.status === 'rejected') timer = window.setTimeout(() => load(attempt + 1), Math.min(30000, 2000 * 2 ** attempt))
      })
    load()
    const onFocus = () => {
      if (timer) {
        clearTimeout(timer)
        timer = 0
        load()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const catIndex = useMemo(() => {
    const m: Refs['catIndex'] = new Map()
    const walk = (list: Category[], root?: Category, parent?: Category) => {
      for (const c of list) {
        const r = root ?? c
        m.set(c.id, { cat: c, parent, root: r })
        if (c.children) walk(c.children, r, c)
      }
    }
    walk(categories)
    return m
  }, [categories])

  return <Ctx.Provider value={{ cities, categories, loaded, catIndex }}>{children}</Ctx.Provider>
}

export const useRefs = () => useContext(Ctx)
