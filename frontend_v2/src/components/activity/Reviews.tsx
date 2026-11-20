import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MessageCircle, Paperclip, Play, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { Api } from '../../api/endpoints'
import { Planned } from '../../api/planned'
import type { Review, ReviewComment } from '../../api/types'
import { errorText } from '../../api/client'
import { mediaUrl } from '../../config'
import { hasFeature } from '../../features'
import { useAuth } from '../../state/auth'
import { useToast } from '../../state/toast'
import { fmtDate, plural } from '../../lib/format'
import { compressImage } from '../../lib/imageCheck'
import { ReportButton } from '../ReportButton'

const MIN = 1 // бэк: 1–600 знаков после trim
const MAX = 600
const MAX_PHOTOS = 5
const draftKey = (id: string) => `talentro.reviewDraft.${id}`

type MediaItem = { path: string; video: boolean }

export function Reviews({ activityId, isOwnerOfCard }: { activityId: string; isOwnerOfCard: boolean }) {
  const { user } = useAuth()
  const toast = useToast()
  const loc = useLocation()
  const [items, setItems] = useState<Review[]>([])
  const [total, setTotal] = useState(0)
  const [all, setAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<{ list: MediaItem[]; i: number } | null>(null)

  useEffect(() => {
    setLoading(true)
    // ТЗ §3.3.14: 5 последних, дальше «Показать все»
    Api.reviews(activityId, 1, all ? 100 : 5)
      .then((r) => {
        setItems(r.items ?? [])
        setTotal(r.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activityId, all])

  const mine = user && items.some((r) => r.author_id === user.id)

  return (
    <section className="reviews panel" id="reviews">
      <h2>
        Отзывы <span className="count">({total})</span>
      </h2>
      <p className="reviews__note">Мнение посетителя: мы не проверяем, что автор был на занятии.</p>

      {loading && !items.length ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <p className="muted reviews__empty">Отзывов пока нет. Будьте первым!</p>
      ) : (
        <ul className="reviews__list">
          {items.map((r) => (
            <ReviewItem key={r.id} r={r} onOpenMedia={(list, i) => setViewer({ list, i })} />
          ))}
        </ul>
      )}

      {!all && items.length < total && (
        <button type="button" className="btn btn--soft reviews__more" disabled={loading} onClick={() => setAll(true)}>
          Показать все ({total})
        </button>
      )}

      <div className="review-form">
        <h3>Написать отзыв</h3>
        <p className="muted">Поделитесь впечатлениями о занятиях</p>
        {!user ? (
          <p className="review-form__gate">
            <Link to="/login" state={{ from: loc.pathname + '#reviews' }}>
              Войдите
            </Link>
            , чтобы оставить отзыв.
          </p>
        ) : isOwnerOfCard ? (
          <p className="review-form__gate">Нельзя оставлять отзыв на свою секцию.</p>
        ) : mine ? (
          <p className="review-form__gate">Вы уже оставили отзыв на эту секцию.</p>
        ) : (
          <ReviewForm
            activityId={activityId}
            onDone={(r) => {
              setItems((l) => [r, ...l])
              setTotal((t) => t + 1)
              toast('Спасибо! Отзыв опубликован', 'success')
            }}
          />
        )}
      </div>

      {viewer && <MediaViewer list={viewer.list} start={viewer.i} onClose={() => setViewer(null)} />}
    </section>
  )
}

function ReviewItem({ r, onOpenMedia }: { r: Review; onOpenMedia: (list: MediaItem[], i: number) => void }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const [full, setFull] = useState(false)
  const [long, setLong] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const [votes, setVotes] = useState(r.votes ?? { plus: 0, minus: 0 })
  const [comments, setComments] = useState<ReviewComment[] | null>(null)
  const [thread, setThread] = useState(false)
  const [reply, setReply] = useState('')
  const media: MediaItem[] = [...(r.photos ?? []).map((p) => ({ path: p.path, video: false })), ...(r.videos ?? []).map((v) => ({ path: v.path, video: true }))]

  useEffect(() => {
    const el = textRef.current
    if (el) setLong(el.scrollHeight > el.clientHeight + 2)
  }, [r.text])

  const needLogin = () => nav('/login', { state: { from: loc.pathname + '#reviews' } })

  const vote = async (v: 1 | -1) => {
    if (!user) return needLogin()
    try {
      setVotes(await Planned.voteReview(r.id, v))
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  const openThread = () => {
    setThread((t) => !t)
    if (comments === null)
      Planned.reviewComments(r.id)
        .then((x) => setComments(x.items ?? []))
        .catch(() => setComments([]))
  }

  const sendReply = async () => {
    if (!user) return needLogin()
    if (!reply.trim()) return
    try {
      const c = await Planned.addReviewComment(r.id, reply.trim())
      setComments((l) => [...(l ?? []), c])
      setReply('')
    } catch (e) {
      toast(errorText(e), 'error')
    }
  }

  return (
    <li className="review">
      <div className="review__head">
        <span className="review__ava">{(r.author_name || 'Г').slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{r.author_name || 'Гость'}</b>
          <small>{fmtDate(r.created_at)}</small>
        </div>
        {hasFeature('review_votes') && (
          <div className="review__votes">
            <button type="button" onClick={() => vote(1)} aria-label="Плюс отзыву">
              <ThumbsUp size={18} /> {votes.plus}
            </button>
            <button type="button" onClick={() => vote(-1)} aria-label="Минус отзыву">
              <ThumbsDown size={18} /> {votes.minus}
            </button>
          </div>
        )}
      </div>
      <p ref={textRef} className={`review__text ${full ? '' : 'review__text--clamp'}`}>
        {r.text}
      </p>
      {long && !full && (
        <button type="button" className="link-btn review__more" onClick={() => setFull(true)}>
          Показать полностью
        </button>
      )}
      {media.length > 0 && (
        <div className="review__media">
          {media.map((m, i) => (
            <button key={m.path} type="button" className="review__thumb" onClick={() => onOpenMedia(media, i)} aria-label={m.video ? 'Смотреть видео' : 'Открыть фото'}>
              {m.video ? (
                <>
                  <video src={mediaUrl(m.path)} muted preload="metadata" />
                  <span className="review__play">
                    <Play size={18} fill="currentColor" />
                  </span>
                </>
              ) : (
                <img src={mediaUrl(m.path)} alt="" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}
      <div className="review__actions">
        {hasFeature('review_comments') && (
          <button type="button" className="btn btn--soft btn--sm" onClick={openThread} aria-expanded={thread}>
            <MessageCircle size={14} /> {r.comments_count ? `${r.comments_count} ${plural(r.comments_count, 'ответ', 'ответа', 'ответов')}` : 'Ответить'}
          </button>
        )}
        <ReportButton target="review" targetId={r.id} />
      </div>
      {thread && (
        <div className="review__thread">
          {comments === null ? (
            <div className="muted">Загрузка…</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className={`review__comment ${c.is_organization ? 'is-org' : ''}`}>
                <b>
                  {c.author_name}
                  {c.is_organization && ' · Ответ организации'}
                </b>
                <p>{c.text}</p>
              </div>
            ))
          )}
          <div className="review__reply">
            <input className="input" placeholder="Ваш ответ…" maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
            <button type="button" className="btn btn--solid btn--sm" onClick={sendReply} disabled={!reply.trim()}>
              Отправить
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function ReviewForm({ activityId, onDone }: { activityId: string; onDone: (r: Review) => void }) {
  const toast = useToast()
  const [text, setText] = useState(() => localStorage.getItem(draftKey(activityId)) ?? '')
  const [agree, setAgree] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)

  // черновик в localStorage (ТЗ §10.19)
  useEffect(() => {
    if (text) localStorage.setItem(draftKey(activityId), text)
    else localStorage.removeItem(draftKey(activityId))
  }, [text, activityId])

  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f))
    setUrls(u)
    return () => u.forEach(URL.revokeObjectURL)
  }, [files])

  const len = text.trim().length
  const invalid = len > 0 && (len < MIN || len > MAX)
  const photos = files.filter((f) => f.type.startsWith('image/'))
  const videos = files.filter((f) => f.type === 'video/mp4')

  const pick = (list: File[]) => {
    const next = [...files]
    for (const f of list) {
      const isImg = ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
      const isVid = f.type === 'video/mp4'
      if (!isImg && !isVid) {
        setErr('Фото: JPG, PNG, WebP. Видео: MP4 до 30 секунд')
        continue
      }
      if (isImg && next.filter((x) => x.type.startsWith('image/')).length >= MAX_PHOTOS) {
        setErr(`Не больше ${MAX_PHOTOS} фото`)
        continue
      }
      if (isVid && next.some((x) => x.type === 'video/mp4')) {
        setErr('Можно одно видео')
        continue
      }
      if (f.size > (isVid ? 50 : 10) * 1024 * 1024) {
        setErr(`«${f.name}» слишком большой`)
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  const send = async () => {
    if (len < MIN) return setErr('Напишите текст отзыва')
    if (len > MAX) return setErr(`Отзыв — не длиннее ${MAX} знаков`)
    if (!agree) return setErr('Нужно согласие с условиями пользования')
    setErr('')
    try {
      setBusy('Публикуем…')
      const r = await Api.addReview(activityId, text.trim())
      const done: Review = { ...r, photos: [], videos: [] }
      for (const [i, f] of files.entries()) {
        setBusy(`Загружаем файл ${i + 1} из ${files.length}…`)
        try {
          if (f.type === 'video/mp4') {
            const m = await Api.uploadReviewMedia(r.id, 'videos', f)
            done.videos!.push({ id: m.id, path: m.path, position: m.position })
          } else {
            const m = await Api.uploadReviewMedia(r.id, 'photos', await compressImage(f))
            done.photos!.push({ id: m.id, path: m.path, position: m.position, is_cover: false })
          }
        } catch (e) {
          toast(`Отзыв сохранён, файл «${f.name}» не загрузился: ${errorText(e)}`, 'error')
        }
      }
      localStorage.removeItem(draftKey(activityId))
      setText('')
      setFiles([])
      onDone(done)
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <label className="review-form__box" aria-invalid={invalid}>
        <span className="sr-only">Текст отзыва</span>
        <textarea
          value={text}
          maxLength={MAX + 50}
          onChange={(e) => {
            setText(e.target.value)
            setErr('')
          }}
          placeholder="Расскажите, что вам понравилось и что можно улучшить..."
          aria-invalid={invalid}
        />
        <span className="review-form__meta">
          <span>
            До {MAX} знаков
          </span>
          <span className={invalid ? 'is-bad' : ''}>
            {len} / {MAX}
          </span>
        </span>
      </label>

      {files.length > 0 && (
        <div className="review__media review-form__files">
          {files.map((f, i) => (
            <div key={urls[i] ?? i} className="review__thumb">
              {f.type === 'video/mp4' ? <video src={urls[i]} muted /> : <img src={urls[i]} alt="" />}
              <button type="button" className="review-form__rm" aria-label="Убрать файл" onClick={() => setFiles(files.filter((_, k) => k !== i))}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="check review-form__agree">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          Согласен(на) с{' '}
          <Link to="/terms" target="_blank">
            условиями пользования
          </Link>
        </span>
      </label>
      {err && <p className="field-error">{err}</p>}
      <div className="review-form__actions">
        <button type="button" className="btn btn--soft review-form__attach" onClick={() => input.current?.click()} disabled={photos.length >= MAX_PHOTOS && videos.length >= 1}>
          <Paperclip size={16} /> Прикрепить фото / видео
        </button>
        <span className="muted review-form__limits">До 5 фото и 1 видео</span>
        <button type="button" className="btn btn--solid" onClick={send} disabled={!!busy || len < MIN || len > MAX || !agree}>
          {busy || 'Отправить отзыв'}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? [])
          e.target.value = ''
          pick(list)
        }}
      />
    </>
  )
}

/** Просмотр фото/видео отзыва на весь экран. */
function MediaViewer({ list, start, onClose }: { list: MediaItem[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % list.length)
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + list.length) % list.length)
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [list.length, onClose])
  const m = list[i]
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="lightbox__media" onClick={(e) => e.stopPropagation()}>
        {m.video ? <video src={mediaUrl(m.path)} controls autoPlay playsInline /> : <img src={mediaUrl(m.path)} alt="" />}
      </div>
      <button type="button" className="lightbox__close" aria-label="Закрыть" onClick={onClose}>
        <X />
      </button>
      {list.length > 1 && <span className="lightbox__count">{`${i + 1} / ${list.length}`}</span>}
    </div>,
    document.body,
  )
}
