import { useEffect, useRef } from 'react'
import { Api, isOwner } from '../api/endpoints'
import { ApiError } from '../api/client'
import { Planned } from '../api/planned'
import { hasFeature } from '../features'
import { dataUrlToFile, orgDraft } from '../lib/pending'
import { useAuth } from './auth'
import { useRoleStats } from './roleStats'
import { useToast } from './toast'

/**
 * После первого входа владельца сохраняет профиль организации из формы регистрации
 * (до подтверждения почты сессии нет, поэтому сохранить сразу было нельзя).
 * Адреса и метки остаются в черновике — их подставит редактор первой анкеты.
 */
export function OrgDraftSync() {
  const { user } = useAuth()
  const { refresh } = useRoleStats()
  const toast = useToast()
  const running = useRef(false)

  useEffect(() => {
    const d = orgDraft.get()
    if (!user || !isOwner(user) || !d || running.current) return
    if (d.email !== user.email.toLowerCase()) return
    running.current = true
    ;(async () => {
      try {
        const has = await Api.myOrganization().then(
          () => true,
          (e) => (e instanceof ApiError && e.status === 404 ? false : Promise.reject(e)),
        )
        if (!has) {
          await Api.saveOrganization(d.org)
          if (d.cover && hasFeature('org_cover')) await Planned.uploadOrgCover(await dataUrlToFile(d.cover)).catch(() => {})
          toast('Профиль организации сохранён. Теперь добавьте первую секцию или услугу', 'success')
          refresh()
        }
        orgDraft.set({ ...d, cover: undefined, org: d.org, email: d.email }) // обложка больше не нужна
      } catch {
        // попробуем при следующем входе
      } finally {
        running.current = false
      }
    })()
  }, [user, toast, refresh])

  return null
}
