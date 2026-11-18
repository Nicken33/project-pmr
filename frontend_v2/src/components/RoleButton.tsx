import { Link, useLocation } from 'react-router-dom'
import { Building2, ClipboardList, ShieldCheck } from 'lucide-react'
import { isOwner } from '../api/endpoints'
import type { User } from '../api/types'
import { ROLE_LABEL, useRoleStats } from '../state/roleStats'
import { plural } from '../lib/format'

/** Кнопка рабочего места в шапке: владельцу — «Мои анкеты», модератору — «Модерация». */
export function RoleButton({ user }: { user: User | null }) {
  const { stats } = useRoleStats()
  const { pathname } = useLocation()
  if (!user) return null

  if (isOwner(user)) {
    const n = stats.rejected + stats.drafts
    const title = [
      stats.rejected && `${stats.rejected} ${plural(stats.rejected, 'отклонена', 'отклонены', 'отклонено')}`,
      stats.drafts && `${stats.drafts} ${plural(stats.drafts, 'черновик', 'черновика', 'черновиков')}`,
      stats.pending && `${stats.pending} на проверке`,
    ]
      .filter(Boolean)
      .join(', ')
    return (
      <Link to="/my" className={`role-btn ${pathname.startsWith('/my') ? 'is-active' : ''}`} title={title || 'Мои анкеты'}>
        <ClipboardList size={20} />
        <span className="role-btn__label">Мои анкеты</span>
        {n > 0 && <span className={`role-btn__badge ${stats.rejected ? 'is-alert' : ''}`}>{n}</span>}
      </Link>
    )
  }

  if (user.account_type === 'moderator') {
    const n = stats.queue + stats.reports
    const title = [`На проверке: ${stats.queue}`, stats.overdue && `просрочено: ${stats.overdue}`, `жалоб: ${stats.reports}`].filter(Boolean).join(', ')
    return (
      <Link to="/moderation" className={`role-btn ${pathname.startsWith('/moderation') ? 'is-active' : ''}`} title={title}>
        <ShieldCheck size={20} />
        <span className="role-btn__label">Модерация</span>
        {n > 0 && <span className={`role-btn__badge ${stats.overdue ? 'is-alert' : ''}`}>{n}</span>}
      </Link>
    )
  }
  return null
}

/** Маленький значок роли в углу аватара и плашка роли в меню. */
export function RoleMark({ user }: { user: User }) {
  if (user.account_type === 'user') return null
  const Icon = user.account_type === 'moderator' ? ShieldCheck : Building2
  return (
    <span className={`role-mark role-mark--${user.account_type}`} title={ROLE_LABEL[user.account_type]} aria-label={ROLE_LABEL[user.account_type]}>
      <Icon size={11} strokeWidth={2.6} />
    </span>
  )
}

export function RoleChip({ user }: { user: User }) {
  if (user.account_type === 'user') return null
  return <span className={`role-chip role-chip--${user.account_type}`}>{ROLE_LABEL[user.account_type]}</span>
}
