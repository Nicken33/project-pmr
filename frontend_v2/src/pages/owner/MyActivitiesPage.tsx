import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock3, Flower2, MapPin, Pencil } from 'lucide-react'
import { Api } from '../../api/endpoints'
import type { Organization, OwnedActivity } from '../../api/types'
import { ApiError, errorText } from '../../api/client'
import { useToast } from '../../state/toast'
import { Checked, Cover, Votes, cardLink, useChip } from '../../components/cards/CardParts'
import { allSchedules, cardPrice, placeLine, scheduleText } from '../../lib/format'
import { STATUS_TEXT } from '../../lib/owner'
import { useRoleStats } from '../../state/roleStats'
import { Planned } from '../../api/planned'
import { hasFeature } from '../../features'

type StatusFilter = '' | 'draft' | 'pending' | 'published' | 'rejected'

export default function MyActivitiesPage() {
  const [org, setOrg] = useState<Organization | null | undefined>(undefined)
  const [items, setItems] = useState<OwnedActivity[] | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('')
  const nav = useNavigate()

  const { refresh } = useRoleStats()
  const load = useCallback(() => {
    refresh()
    Api.myOrganization().then(setOrg, (e) => setOrg(e instanceof ApiError && e.status === 404 ? null : undefined))
    Api.myActivities()
      .then((l) => setItems(l ?? []))
      .catch((e) => setErr(errorText(e)))
  }, [refresh])
  useEffect(load, [load])

  const shown = (items ?? []).filter((a) => !filter || a.status === filter)

  if (org === null)
    return (
      <div className="empty panel narrow">
        <h3>Сначала заполните профиль организации</h3>
        <p>Без него нельзя создавать анкеты.</p>
        <p style={{ marginTop: 16 }}>
          <Link to="/my/organization" className="btn btn--solid">
            Заполнить профиль
          </Link>
        </p>
      </div>
    )

  return (
    <div>
      <div className="owner-head">
        <div>
          {org && (
            <Link to="/my/organization" className="owner-head__org" title="Профиль организации">
              <span className="logo-dot">
                <Flower2 size={20} />
              </span>
              {org.name}
            </Link>
          )}
          <h1>Мои анкеты {items && `(${items.length})`}</h1>
          <p>Управляйте анкетами ваших услуг и отслеживайте их статус</p>
        </div>
        <div className="owner-head__tools">
          <select className="input select" value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)} aria-label="Фильтр по статусу">
            <option value="">Фильтр: все</option>
            {Object.entries(STATUS_TEXT).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--solid" onClick={() => nav('/my/new')}>
            + Новая анкета
          </button>
        </div>
      </div>

      {err ? (
        <div className="empty panel">
          <h3>Не удалось загрузить анкеты</h3>
          <p>{err}</p>
        </div>
      ) : !items ? (
        <div className="spinner" />
      ) : shown.length === 0 ? (
        <div className="empty panel owner-list">
          <h3>{items.length ? 'Нет анкет с таким статусом' : 'Анкет пока нет'}</h3>
          {!items.length && <p>Создайте первую анкету — после проверки модератором она появится в каталоге.</p>}
        </div>
      ) : (
        <div className="owner-list">
          {shown.map((a) => (
            <OwnerItem key={a.id} a={a} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function OwnerItem({ a, onChanged }: { a: OwnedActivity; onChanged: () => void }) {
  const toast = useToast()
  const nav = useNavigate()
  const chip = useChip(a)
  const [reason, setReason] = useState(false)
  const [busy, setBusy] = useState(false)
  const place = placeLine(a)

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      toast(ok, 'success')
      onChanged()
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`oitem oitem--${a.status}`}>
      <div>
        <div className="oitem__photo">
          <Cover c={a} />
        </div>
        <div className="oitem__name">{a.name}</div>
      </div>
      <div className="oitem__info">
        <div className="oitem__org">
          <span>{a.organization}</span>
          {chip && <span className="chip">{chip}</span>}
        </div>
        <div className="row">
          <Clock3 size={16} /> {scheduleText(allSchedules(a))}
        </div>
        <div className="row">
          <MapPin size={16} />
          <span>
            {place.area}
            {place.address && <br />}
            {place.address}
          </span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <Votes c={a} small />
          <Checked c={a} />
        </div>
        <b style={{ color: 'var(--text-2)' }}>{cardPrice(a)}</b>
      </div>
      <div className="oitem__side">
        <div className={`oitem__status st-${a.status}`}>
          {a.status === 'published' && !a.is_active ? 'Снято с публикации' : (STATUS_TEXT[a.status] ?? a.status)}
        </div>
        <button type="button" className="btn btn--soft" disabled={busy} onClick={() => nav(`/my/${a.id}/edit`)}>
          <Pencil size={14} /> Редактировать
        </button>
        {a.status === 'published' && a.is_active && (
          <button
            type="button"
            className="btn btn--soft"
            disabled={busy}
            onClick={() => confirm('Снять анкету с публикации?') && act(() => Api.unpublishActivity(a.id), 'Анкета снята с публикации')}
          >
            Снять с публикации
          </button>
        )}
        {a.status === 'published' && a.is_active && (
          <Link to={cardLink(a)} className="btn btn--soft">
            Просмотреть
          </Link>
        )}
        {a.status === 'published' && !a.is_active &&
          (hasFeature('republish') ? (
            <button type="button" className="btn btn--soft" disabled={busy} onClick={() => act(() => Planned.republish(a.id), 'Анкета снова в каталоге')}>
              Вернуть в публикацию
            </button>
          ) : (
            <div className="oitem__hint">Анкета скрыта из каталога. Чтобы вернуть, отредактируйте и сохраните — она уйдёт на проверку.</div>
          ))}
        {a.status === 'rejected' && (
          <button type="button" className="btn btn--soft" onClick={() => setReason((v) => !v)}>
            Причина отказа
          </button>
        )}
        {reason && <div className="oitem__reason">{a.rejection_reason || 'Модератор не указал причину'}</div>}
        {(a.status === 'draft' || a.status === 'rejected') && (
          <>
            <button type="button" className="btn btn--soft" disabled={busy} onClick={() => act(() => Api.submitActivity(a.id), 'Анкета отправлена на проверку')}>
              Отправить на проверку
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={busy}
              onClick={() => confirm(`Удалить анкету «${a.name}»? Это нельзя отменить.`) && act(() => Api.deleteActivity(a.id), 'Анкета удалена')}
            >
              Удалить
            </button>
          </>
        )}
      </div>
    </article>
  )
}
