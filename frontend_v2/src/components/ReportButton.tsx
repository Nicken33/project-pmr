import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { Api } from '../api/endpoints'
import type { ReportTarget } from '../api/types'
import { errorText } from '../api/client'
import { useAuth } from '../state/auth'
import { useToast } from '../state/toast'

const REASONS: Record<ReportTarget, string[]> = {
  card: ['Данные устарели', 'Неверный телефон или адрес', 'Неверная цена или расписание', 'Организация закрылась', 'Мошенничество', 'Другое'],
  review: ['Оскорбления', 'Спам или реклама', 'Ложная информация', 'Личные данные', 'Не относится к занятию', 'Другое'],
  media: ['Неприемлемое изображение', 'Чужое фото', 'Личные данные', 'Не относится к занятию', 'Другое'],
}

/** «Пожаловаться» → POST /api/v1/reports (ТЗ §3.3.10, §3.9.7). Гостя отправляем на вход. */
export function ReportButton({ target, targetId, label, className }: { target: ReportTarget; targetId: string; label?: string; className?: string }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)

  const start = () => {
    if (!user) return nav('/login', { state: { from: loc.pathname } })
    setReason('')
    setDetail('')
    setOpen(true)
  }

  const send = async () => {
    if (!reason) return toast('Выберите причину', 'error')
    setBusy(true)
    try {
      await Api.report({ target_type: target, target_id: targetId, reason, detail: detail.trim() })
      toast('Жалоба отправлена модератору. Спасибо!', 'success')
      setOpen(false)
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className ?? 'link-btn report-btn'} onClick={start}>
        <Flag size={14} /> {label ?? 'Пожаловаться'}
      </button>
      {open &&
        createPortal(
          <div className="modal" role="dialog" aria-modal="true" aria-label="Жалоба" onClick={() => setOpen(false)}>
            <div className="modal__body" onClick={(e) => e.stopPropagation()}>
              <h2>{target === 'card' ? 'Сообщить о проблеме' : 'Пожаловаться'}</h2>
              <fieldset className="radios report-reasons">
                <legend>Что не так?</legend>
                <div>
                  {REASONS[target].map((r) => (
                    <label key={r} className="check">
                      <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                      {r}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="field">
                <span>Подробнее (необязательно)</span>
                <textarea className="textarea" maxLength={2000} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Что именно неверно? Как правильно?" />
              </label>
              <div className="row row--wrap" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn--soft" onClick={() => setOpen(false)}>
                  Отмена
                </button>
                <button type="button" className="btn btn--solid" disabled={busy || !reason} onClick={send}>
                  {busy ? 'Отправляем…' : 'Отправить'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
