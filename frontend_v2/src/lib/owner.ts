import type { AccountType, Category, OrganizationType } from '../api/types'

export const ORG_TYPES: { v: OrganizationType; label: string }[] = [
  { v: 'school', label: 'Школа' },
  { v: 'sports_school', label: 'Спортивная школа' },
  { v: 'studio', label: 'Студия' },
  { v: 'art_house', label: 'Дом творчества' },
  { v: 'private_master', label: 'Частный мастер' },
]

/** Плоский список направлений для выпадающего списка: «Спорт › Футбол». */
export function flatDirections(tree: Category[], kind: 'activity' | 'service') {
  const out: { id: string; label: string; depth: number }[] = []
  const ok = (c: Category) => c.record_type === kind || c.record_type === 'both'
  const walk = (list: Category[], prefix: string, depth: number) => {
    for (const c of list) {
      if (ok(c)) out.push({ id: c.id, label: prefix + c.name, depth })
      if (c.children) walk(c.children, depth === 0 ? `${c.name} › ` : prefix, depth + 1)
    }
  }
  walk(tree, '', 0)
  return out
}

export const recordTypeFor = (acc?: AccountType) => (acc === 'service_owner' || acc === 'owner_service' ? 'service' : 'activity') as 'activity' | 'service'

export const STATUS_TEXT: Record<string, string> = {
  draft: 'Черновик',
  pending: 'На проверке',
  published: 'Опубликовано',
  rejected: 'Отклонено',
}
