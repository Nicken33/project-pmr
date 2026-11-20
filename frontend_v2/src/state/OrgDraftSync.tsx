import { useEffect, useRef } from 'react'
import { Api, isOwner } from '../api/endpoints'
import { ApiError, errorText } from '../api/client'
import { dataUrlToFile, orgDraft } from '../lib/pending'
import { useAuth } from './auth'
import { useRoleStats } from './roleStats'
import { useToast } from './toast'

/**
 * После первого входа владельца сохраняет то, что он заполнил при регистрации
 * (до подтверждения почты сессии нет): 1) профиль организации вместе с адресами (PUT /me/organization),
 * 2) обложку (POST /me/organization/cover). Каждый шаг отмечается в черновике —
 * при ошибке при следующем входе повторится только несделанный шаг.
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
        if (!d.saved) {
          const has = await Api.myOrganization().then(
            () => true,
            (e) => (e instanceof ApiError && e.status === 404 ? false : Promise.reject(e)),
          )
          if (!has)
            await Api.saveOrganization({
              ...d.org,
              locations: d.branches.map((b) => ({
                name: b.name,
                city_id: b.city_id,
                district_id: b.district_id,
                address: b.address,
                latitude: b.lat,
                longitude: b.lng,
              })),
            })
          d.saved = true
          orgDraft.set(d)
          if (!has) toast('Профиль организации и адреса сохранены. Теперь добавьте первую секцию или услугу', 'success')
          refresh()
        }
        if (d.cover) {
          try {
            await Api.uploadOrgCover(await dataUrlToFile(d.cover))
          } catch (e) {
            toast(`Обложка не загрузилась: ${errorText(e)}. Добавьте её в «Профиле организации»`, 'error')
          }
        }
        orgDraft.clear()
      } catch {
        // сеть / сервер — попробуем при следующем входе
      } finally {
        running.current = false
      }
    })()
  }, [user, toast, refresh])

  return null
}
