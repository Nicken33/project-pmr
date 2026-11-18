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
    Promise.allSettled([Api.cities(), Api.categories()]).then(([c, k]) => {
      if (c.status === 'fulfilled') setCities(c.value ?? [])
      if (k.status === 'fulfilled') setCategories(k.value ?? [])
      setLoaded(true)
    })
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
