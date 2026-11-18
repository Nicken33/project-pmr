import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, X } from 'lucide-react'
import { isOwner } from '../api/endpoints'
import { useAuth } from '../state/auth'
import { useRoleStats } from '../state/roleStats'
import { plural } from '../lib/format'

/** Полоска для владельца: отклонённые анкеты и черновики ждут его действий. Закрывается до конца сессии. */
export function OwnerNotice() {
  const { user } = useAuth()
  const { stats } = useRoleStats()
  const [, rerender] = useState(0)
  const { rejected, drafts } = stats
  // скрыто, пока числа не поменяются (новый отказ покажет полоску снова)
  const hidden = sessionStorage.getItem('talentro.ownerNotice') === rejected + ':' + drafts
  if (!isOwner(user) || hidden) return null
  if (!rejected && !drafts) return null

  const parts = [
    rejected && `${rejected} ${plural(rejected, 'анкета отклонена', 'анкеты отклонены', 'анкет отклонено')} модератором`,
    drafts && `${drafts} ${plural(drafts, 'черновик ждёт', 'черновика ждут', 'черновиков ждут')} отправки на проверку`,
  ].filter(Boolean)

  return (
    <div className={`owner-notice ${rejected ? 'is-alert' : ''}`} role="status">
      <AlertCircle size={20} />
      <span>{parts.join(', ')}.</span>
      <Link to="/my" className="btn btn--solid btn--sm">
        Открыть «Мои анкеты»
      </Link>
      <button
        type="button"
        className="owner-notice__close"
        aria-label="Скрыть"
        onClick={() => {
          sessionStorage.setItem('talentro.ownerNotice', rejected + ':' + drafts)
          rerender((n) => n + 1)
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}
