// Короткие всплывающие уведомления внизу экрана.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Kind = 'info' | 'error' | 'success'
type ToastFn = (text: string, kind?: Kind) => void

const Ctx = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; text: string; kind: Kind }[]>([])
  const push = useCallback<ToastFn>((text, kind = 'info') => {
    const id = Date.now() + Math.random()
    setItems((l) => [...l, { id, text, kind }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4000)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
