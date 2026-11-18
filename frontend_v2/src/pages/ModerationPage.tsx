import { useCallback, useEffect, useState } from 'react'
import { Api } from '../api/endpoints'
import type { ContentReport, ModerationItem, OwnedActivity } from '../api/types'
import { errorText } from '../api/client'
import { useToast } from '../state/toast'
import { useRoleStats } from '../state/roleStats'
import { Clock3 } from 'lucide-react'
import { NoPhoto } from '../components/cards/CardParts'
import { mediaUrl } from '../config'
import { ageText, fmtDate, plural, priceText, WD_SHORT, CLASS_TYPE_TEXT, FORMAT_TEXT } from '../lib/format'
import { STATUS_TEXT } from '../lib/owner'

type Tab = 'pending' | 'published' | 'rejected' | 'reports'

// ТЗ §3.9.3: отказ — с комментарием из списка типовых причин + свободный текст
const REASONS = [
  'Нет точки на карте у адреса',
  'Не заполнено расписание',
  'Неверный или нерабочий телефон',
  'Нет фото или фото не по теме',
  'Описание не по теме или с рекламой',
  'Неверное направление',
  'Дубликат существующей анкеты',
]

export default function ModerationPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<(ModerationItem & { waitingSince?: string })[] | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<OwnedActivity | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const { refresh: refreshStats } = useRoleStats()

  const load = useCallback(() => {
    if (tab === 'reports') return
    setItems(null)
    Api.moderationQueue(tab as 'pending')
      .then(async (l) => {
        const list = l ?? []
        if (tab !== 'pending') return setItems(list)
        // ТЗ §3.9.1: дольше всех ждёт — выше. В списке нет даты, берём updated_at из карточки
        // (анкета на проверке не меняется, значит это момент отправки). Запросы — параллельно, до 50.
        const withDates = await Promise.all(
          list.slice(0, 50).map((it) =>
            Api.moderationItem(it.id)
              .then((d) => ({ ...it, waitingSince: d.updated_at }))
              .catch(() => ({ ...it, waitingSince: undefined as string | undefined })),
          ),
        )
        withDates.sort((a, b) => (a.waitingSince ?? '9').localeCompare(b.waitingSince ?? '9'))
        setItems([...withDates, ...list.slice(50)])
      })
      .catch((e) => setErr(errorText(e)))
  }, [tab])
  useEffect(load, [load])

  const show = async (id: string) => {
    try {
      setComment('')
      setOpen(await Api.moderationItem(id))
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  const decide = async (approve: boolean) => {
    if (!open) return
    if (!approve && (comment.trim().length < 3 || comment.trim().length > 1000)) return toast('Причина отказа — от 3 до 1000 символов', 'error')
    setBusy(true)
    try {
      if (approve) await Api.approve(open.id)
      else await Api.reject(open.id, comment.trim())
      toast(approve ? 'Анкета опубликована' : 'Анкета отклонена', 'success')
      refreshStats()
      setOpen(null)
      load()
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Модерация</h1>
      <div className="mod-tabs" role="tablist">
        {(['pending', 'published', 'rejected', 'reports'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`btn ${tab === t ? 'btn--solid' : 'btn--soft'}`} onClick={() => setTab(t)}>
            {t === 'reports' ? 'Жалобы' : STATUS_TEXT[t]}
          </button>
        ))}
      </div>
      {tab === 'reports' ? (
        <ReportsQueue />
      ) : err ? (
        <p className="form-error">{err}</p>
      ) : !items ? (
        <div className="spinner" />
      ) : !items.length ? (
        <div className="empty panel">
          <h3>Очередь пуста</h3>
        </div>
      ) : (
        <div className="mod-rows">
          {items.map((it) => (
            <article key={it.id} className={`mod-row panel ${it.waitingSince && businessDaysSince(it.waitingSince) > 2 ? 'is-overdue' : ''}`}>
              <div className="mod-row__photo">
                {it.photos?.[0] ? <img src={mediaUrl(it.photos[0].path)} alt="" loading="lazy" /> : <NoPhoto big={false} />}
              </div>
              <div className="mod-row__info">
                <h3>{it.name}</h3>
                <div className="mod-row__meta">
                  <span className={`chip st-chip st-chip--${it.status}`}>{STATUS_TEXT[it.status] ?? it.status}</span>
                  {it.waitingSince && (
                    <span className={`mod-wait ${businessDaysSince(it.waitingSince) > 2 ? 'is-overdue' : ''}`}>
                      <Clock3 size={14} /> Ждёт {waitText(it.waitingSince)}
                      {businessDaysSince(it.waitingSince) > 2 && ' · срок 2 рабочих дня прошёл'}
                    </span>
                  )}
                </div>
                {it.rejection_reason && <div className="oitem__reason">{it.rejection_reason}</div>}
              </div>
              <div className="mod-row__actions">
                <button type="button" className="btn btn--solid" onClick={() => show(it.id)}>
                  {it.status === 'pending' ? 'Проверить' : 'Открыть'}
                </button>
                {it.status === 'published' && (
                  <a className="btn btn--soft" href={`/activity/${it.slug || it.id}`} target="_blank" rel="noreferrer">
                    На сайте
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="modal" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="modal__body modal__body--wide" onClick={(e) => e.stopPropagation()}>
            <h2>{open.name}</h2>
            <p className="muted">
              {open.organization} · {open.direction} · {FORMAT_TEXT[open.class_format]}
              {open.class_type ? ` · ${CLASS_TYPE_TEXT[open.class_type]}` : ''}
            </p>
            {!!open.photos?.length && (
              <div className="media-grid">
                {open.photos.map((p) => (
                  <div key={p.id} className="photopick__item">
                    <img src={mediaUrl(p.path)} alt="" />
                  </div>
                ))}
              </div>
            )}
            {open.description && <p style={{ whiteSpace: 'pre-line' }}>{open.description}</p>}
            {(open.groups ?? []).map((g) => (
              <div key={g.id} className="ebox">
                <b>{g.name || ageText(g.age_from, g.age_to)}</b> · {ageText(g.age_from, g.age_to)} · {priceText(g.price_from, g.price_period, false)}
                <br />
                {g.location?.city}, {g.location?.address}
                {g.location?.latitude == null && <span className="field-error"> · нет точки на карте</span>}
                <br />
                {(g.schedules ?? []).map((s) => `${WD_SHORT[s.weekday - 1]} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`).join(', ') || 'нет расписания'}
              </div>
            ))}
            {open.status === 'pending' ? (
              <>
                <div className="mod-reasons">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`achip ${comment.includes(r) ? 'is-on' : ''}`}
                      onClick={() => setComment((c) => (c.includes(r) ? c.replace(r, '').replace(/^[\s;]+|[\s;]+$/g, '').replace(/;\s*;/g, ';') : c ? `${c}; ${r}` : r))}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Причина отказа (если отклоняете) — выберите выше или напишите</span>
                  <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
                </label>
                <div className="row row--wrap" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn--soft" onClick={() => setOpen(null)}>
                    Закрыть
                  </button>
                  <button type="button" className="btn btn--danger" disabled={busy} onClick={() => decide(false)}>
                    Отклонить
                  </button>
                  <button type="button" className="btn btn--solid" disabled={busy} onClick={() => decide(true)}>
                    Одобрить
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="btn btn--soft" onClick={() => setOpen(null)}>
                Закрыть
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Очередь жалоб (ТЗ §3.9.7): GET /api/v1/moderation/reports, решение — hide с причиной или dismiss. */
function ReportsQueue() {
  const toast = useToast()
  const [status, setStatus] = useState<'open' | 'hidden' | 'dismissed'>('open')
  const [list, setList] = useState<ContentReport[] | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setList(null)
    setErr('')
    Api.moderationReports({ status, limit: 100 })
      .then((r) => setList(r.items ?? []))
      .catch((e) => setErr(errorText(e)))
  }, [status])
  useEffect(load, [load])

  const decide = async (r: ContentReport, action: 'hide' | 'dismiss') => {
    let reason: string | undefined
    if (action === 'hide') {
      reason = prompt('Причина скрытия (увидит автор):', r.reason) ?? undefined
      if (!reason?.trim()) return
    }
    try {
      await Api.decideReport(r.id, { action, reason: reason?.trim() })
      toast(action === 'hide' ? 'Скрыто' : 'Оставлено', 'success')
      load()
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  const TARGET = { card: 'Анкета', review: 'Отзыв', media: 'Фото/видео' } as const
  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        {(['open', 'hidden', 'dismissed'] as const).map((s) => (
          <button key={s} type="button" className={`achip ${status === s ? 'is-on' : ''}`} onClick={() => setStatus(s)}>
            {{ open: 'Новые', hidden: 'Скрытые', dismissed: 'Оставленные' }[s]}
          </button>
        ))}
      </div>
      {err ? (
        <p className="form-error">{err}</p>
      ) : !list ? (
        <div className="spinner" />
      ) : !list.length ? (
        <div className="empty panel">
          <h3>Жалоб нет</h3>
        </div>
      ) : (
        <div className="reports">
          {list.map((r) => (
            <div key={r.id} className="report panel">
              <div className="report__head">
                <span className="chip">{TARGET[r.target_type]}</span>
                <a href={`/activity/${r.card_slug || r.card_id}`} target="_blank" rel="noreferrer">
                  {r.card_title}
                </a>
                <small className="muted">{fmtDate(r.created_at)}</small>
              </div>
              <blockquote className="report__excerpt">{r.target_excerpt}</blockquote>
              <p>
                <b>{r.reason}</b>
                {r.detail && ` — ${r.detail}`}
              </p>
              <p className="muted">От: {r.reporter_name || 'пользователь'}</p>
              {r.hide_reason && <p className="oitem__reason">Скрыто: {r.hide_reason}</p>}
              {r.status === 'open' && (
                <div className="row row--wrap" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn--soft" onClick={() => decide(r, 'dismiss')}>
                    Оставить
                  </button>
                  <button type="button" className="btn btn--danger" onClick={() => decide(r, 'hide')}>
                    Скрыть с причиной
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Сколько рабочих дней (пн–пт) прошло с момента отправки. */
function businessDaysSince(iso: string) {
  const start = new Date(iso)
  const now = new Date()
  let days = 0
  const d = new Date(start)
  while (d < now) {
    d.setDate(d.getDate() + 1)
    if (d > now) break
    const wd = d.getDay()
    if (wd !== 0 && wd !== 6) days++
  }
  return days
}

function waitText(iso: string) {
  const h = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 36e5))
  if (h < 24) return `${h} ч`
  const d = Math.round(h / 24)
  return `${d} ${plural(d, 'день', 'дня', 'дней')}`
}
