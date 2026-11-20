import { useState } from 'react'
import { Heart, Share2, ThumbsDown, ThumbsUp, Check } from 'lucide-react'
import { categoryIcon } from '../../lib/categoryIcons'
import type { Card } from '../../api/types'
import { mediaUrl } from '../../config'
import { useFavorites } from '../../state/favorites'
import { useToast } from '../../state/toast'
import { useRefs } from '../../state/refs'
import { coverOf, fmtDate } from '../../lib/format'

export function cardLink(c: Card) {
  return `/activity/${c.slug || c.id}`
}

/**
 * Короткое имя направления для плашки: «Спорт и физическая активность» → «Спорт»,
 * «Практические навыки» → «Навыки», «Услуги, другое» → «Услуги».
 */
const SHORT: Record<string, string> = { 'Социальная деятельность': 'Социальное' }

export function shortCategory(name: string) {
  if (SHORT[name]) return SHORT[name]
  const head = name.split(/\s+и\s+|,/)[0].trim()
  const words = head.split(/\s+/)
  const w = words.length > 1 ? words[words.length - 1] : words[0]
  return w ? w[0].toUpperCase() + w.slice(1) : name
}

export function useChip(c: Card) {
  const { catIndex } = useRefs()
  const e = catIndex.get(c.direction_id)
  return shortCategory(e?.root.name ?? c.direction ?? '')
}

/** Заглушка без фото: фирменный градиент + значок направления. */
export function NoPhoto({ directionId, fallbackName, big }: { directionId?: string; fallbackName?: string; big?: boolean }) {
  const { catIndex } = useRefs()
  const name = (directionId && catIndex.get(directionId)?.root.name) || fallbackName || ''
  const icon = categoryIcon(name)
  return (
    <div className={`nophoto ${big ? 'nophoto--big' : ''}`} aria-label="Фото пока нет" role="img">
      <span className="nophoto__icon" style={{ maskImage: `url("${icon}")`, WebkitMaskImage: `url("${icon}")` }} />
      {big && <span className="nophoto__text">Фото пока нет</span>}
    </div>
  )
}

export function Cover({ c, className }: { c: Card; className?: string }) {
  const src = mediaUrl(coverOf(c))
  const [broken, setBroken] = useState(false)
  return (
    <div className={`cover ${className ?? ''}`}>
      {src && !broken ? (
        <img src={src} alt={c.cover_alt ?? c.name} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <NoPhoto directionId={c.direction_id} fallbackName={c.direction} />
      )}
    </div>
  )
}

export function Votes({ c, small }: { c: Card; small?: boolean }) {
  const s = small ? 15 : 17
  return (
    <span className="votes">
      <span>
        <ThumbsUp size={s} fill={c.my_vote === 1 ? 'currentColor' : 'none'} /> {c.rating?.likes ?? 0}
      </span>
      <span>
        <ThumbsDown size={s} fill={c.my_vote === -1 ? 'currentColor' : 'none'} /> {c.rating?.dislikes ?? 0}
      </span>
    </span>
  )
}

export function Checked({ c }: { c: Card }) {
  if (!c.verified && !c.contacts_checked_at)
    return (
      <span className="checked checked--approx" title="Данные ещё не проверены командой">
        данные ориентировочные
      </span>
    )
  return (
    <span className="checked" title="Контакты проверены">
      <Check size={11} strokeWidth={3} /> {fmtDate(c.contacts_checked_at ?? c.updated_at)}
    </span>
  )
}

export function FavShare({ c }: { c: Card }) {
  const { ids, toggle } = useFavorites()
  const toast = useToast()
  const on = ids.has(c.id)
  const share = async () => {
    const url = `${location.origin}${cardLink(c)}`
    try {
      if (navigator.share) await navigator.share({ title: c.name, url })
      else {
        await navigator.clipboard.writeText(url)
        toast('Ссылка скопирована', 'success')
      }
    } catch {
      /* пользователь закрыл окно «Поделиться» */
    }
  }
  return (
    <div className="favshare">
      <button
        type="button"
        className={`favshare__btn ${on ? 'is-on' : ''}`}
        aria-pressed={on}
        aria-label={on ? 'Убрать из избранного' : 'В избранное'}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggle(c.id)
        }}
      >
        <Heart size={18} fill={on ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        className="favshare__btn"
        aria-label="Поделиться"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          share()
        }}
      >
        <Share2 size={17} />
      </button>
    </div>
  )
}
