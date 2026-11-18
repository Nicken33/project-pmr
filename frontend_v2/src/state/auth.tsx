import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Api } from '../api/endpoints'
import { setUnauthorizedHandler, tokenStore } from '../api/client'
import type { AuthToken, User } from '../api/types'

interface AuthState {
  user: User | null
  ready: boolean // true, когда проверили сохранённый токен
  signIn: (t: AuthToken) => void
  signOut: () => void
  setUser: (u: User) => void
}

const Ctx = createContext<AuthState>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  const signOut = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(signOut)
    if (!tokenStore.get()) {
      setReady(true)
      return
    }
    Api.me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true))
  }, [signOut])

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      signIn: (t) => {
        tokenStore.set(t.token)
        setUser(t.user)
      },
      signOut,
      setUser,
    }),
    [user, ready, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
