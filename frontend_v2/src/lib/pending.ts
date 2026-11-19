// Регистрация с подтверждением почты: до подтверждения сессии нет, поэтому то,
// что человек заполнил, держим в браузере и дописываем после первого входа.
import type { OrganizationInput } from '../api/types'

/** Адрес/филиал организации из формы регистрации (уйдёт в первую анкету как точка проведения). */
export interface DraftBranch {
  name: string | null
  city_id: string
  district_id: string | null
  address: string
  lat: number | null
  lng: number | null
}

export interface OrgDraft {
  email: string
  org: OrganizationInput
  branches: DraftBranch[]
  /** обложка, сжатая в data: URL (загрузится, когда бэк сделает /me/organization/cover) */
  cover?: string
}

const ORG = 'talentro.orgDraft'
const MAIL = 'talentro.pendingEmail'

const read = <T,>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null') as T | null
  } catch {
    return null
  }
}

export const orgDraft = {
  get: () => read<OrgDraft>(ORG),
  set: (d: OrgDraft) => {
    try {
      localStorage.setItem(ORG, JSON.stringify(d))
    } catch {
      // нет места (большая обложка) — сохраняем без неё
      localStorage.setItem(ORG, JSON.stringify({ ...d, cover: undefined }))
    }
  },
  clear: () => localStorage.removeItem(ORG),
}

/** Почта, на которую ушло письмо (для экрана «Проверьте почту» после обновления страницы). */
export const pendingEmail = {
  get: () => sessionStorage.getItem(MAIL) ?? '',
  set: (e: string) => sessionStorage.setItem(MAIL, e),
  clear: () => sessionStorage.removeItem(MAIL),
}

export const fileToDataUrl = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(f)
  })

export const dataUrlToFile = async (url: string, name = 'cover.jpg') => {
  const b = await (await fetch(url)).blob()
  return new File([b], name, { type: b.type || 'image/jpeg' })
}
