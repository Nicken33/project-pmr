// Счётчики для ролей — только из существующих маршрутов API:
//   владелец:   GET /api/v1/me/activities           → черновики, отклонённые, на проверке
//               GET /api/v1/me/organization          → id организации (чтобы узнать «свою» анкету)
//   модератор:  GET /api/v1/moderation/activities    → на проверке (+ дата из карточки → просрочка)
//               GET /api/v1/moderation/reports       → новые жалобы
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Api, isOwner } from '../api/endpoints'
import { useAuth } from './auth'

export interface RoleStats {
  /** владелец */
  orgId: string | null
  drafts: number
  rejected: number
  pending: number
  /** модератор */
  queue: number
  overdue: number
  reports: number
}

const EMPTY: RoleStats = { orgId: null, drafts: 0, rejected: 0, pending: 0, queue: 0, overdue: 0, reports: 0 }
const Ctx = createContext<{ stats: RoleStats; refresh: () => void }>({ stats: EMPTY, refresh: () => {} })

export function businessDaysSince(iso: string) {
  const now = new Date()
  const d = new Date(iso)
  let days = 0
  while (true) {
    d.setDate(d.getDate() + 1)
    if (d > now) break
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) days++
  }
  return days
}

export function RoleStatsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [stats, setStats] = useState<RoleStats>(EMPTY)
  const last = useRef(0)

  const refresh = useCallback(async () => {
    last.current = Date.now()
    if (!user) return setStats(EMPTY)
    if (isOwner(user)) {
      const [org, list] = await Promise.allSettled([Api.myOrganization(), Api.myActivities()])
      const items = list.status === 'fulfilled' ? (list.value ?? []) : []
      setStats({
        ...EMPTY,
        orgId: org.status === 'fulfilled' ? org.value.id : null,
        drafts: items.filter((a) => a.status === 'draft').length,
        rejected: items.filter((a) => a.status === 'rejected').length,
        pending: items.filter((a) => a.status === 'pending').length,
      })
    } else if (user.account_type === 'moderator') {
      const [queue, reports] = await Promise.allSettled([Api.moderationQueue('pending'), Api.moderationReports({ status: 'open', limit: 1 })])
      const q = queue.status === 'fulfilled' ? (queue.value ?? []) : []
      // просрочка: дата отправки есть только в карточке — смотрим до 20 самых первых
      const dates = await Promise.all(q.slice(0, 20).map((it) => Api.moderationItem(it.id).then((d) => d.updated_at, () => '')))
      setStats({
        ...EMPTY,
        queue: q.length,
        overdue: dates.filter((d) => d && businessDaysSince(d) > 2).length,
        reports: reports.status === 'fulfilled' ? reports.value.total : 0,
      })
    } else setStats(EMPTY)
  }, [user])

  // обновляем при входе, при смене страницы и раз в 2 минуты
  useEffect(() => {
    refresh()
  }, [refresh])
  // при переходах — не чаще раза в 30 секунд
  useEffect(() => {
    if (Date.now() - last.current > 30000) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  useEffect(() => {
    if (!user) return
    const t = setInterval(refresh, 120000)
    return () => clearInterval(t)
  }, [user, refresh])

  return <Ctx.Provider value={{ stats, refresh }}>{children}</Ctx.Provider>
}

export const useRoleStats = () => useContext(Ctx)

/** Подпись роли для значка. */
export const ROLE_LABEL: Record<string, string> = {
  section_owner: 'Организация',
  service_owner: 'Услуги',
  owner_activity: 'Организация',
  owner_service: 'Услуги',
  moderator: 'Модератор',
}
