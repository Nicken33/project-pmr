import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { NoPhoto } from '../cards/CardParts'
import type { Photo, Video } from '../../api/types'
import { mediaUrl } from '../../config'

type Slide = { kind: 'photo'; p: Photo } | { kind: 'video'; v: Video }

/** Галерея секции: слайдер + просмотр на весь экран в полном качестве (без обрезки). */
export function Gallery({
  photos,
  videos,
  name,
  overlay,
  directionId,
}: {
  photos: Photo[]
  videos: Video[]
  name: string
  overlay?: React.ReactNode
  directionId?: string
}) {
  const slides: Slide[] = [
    ...[...photos].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position).map((p) => ({ kind: 'photo' as const, p })),
    ...[...videos].sort((a, b) => a.position - b.position).map((v) => ({ kind: 'video' as const, v })),
  ]
  const [i, setI] = useState(0)
  const [full, setFull] = useState(false)
  const n = slides.length
  const cur = slides[Math.min(i, n - 1)]
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n])

  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFull(false)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [full, go])

  // свайп пальцем на телефоне
  const [touchX, setTouchX] = useState<number | null>(null)
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => setTouchX(e.touches[0].clientX),
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX === null) return
      const dx = e.changedTouches[0].clientX - touchX
      if (Math.abs(dx) > 40 && n > 1) go(dx < 0 ? 1 : -1)
      setTouchX(null)
    },
  }

  const media = (s: Slide, inFull: boolean) =>
    s.kind === 'photo' ? (
      inFull ? (
        <img src={mediaUrl(s.p.path)} alt={s.p.alt_text ?? name} decoding="async" draggable={false} />
      ) : (
        <FitImage src={mediaUrl(s.p.path)!} alt={s.p.alt_text ?? name} />
      )
    ) : (
      <video src={mediaUrl(s.v.path)} controls playsInline preload="metadata" autoPlay={inFull} />
    )

  return (
    <>
      <div className="gallery" {...swipe}>
        {!cur ? (
          <NoPhoto directionId={directionId} big />
        ) : (
          <button type="button" className="gallery__open" onClick={() => setFull(true)} aria-label="Открыть фото на весь экран">
            {media(cur, false)}
            {cur.kind === 'photo' && (
              <span className="gallery__zoom" aria-hidden>
                <Maximize2 size={16} />
              </span>
            )}
          </button>
        )}
        {overlay}
        {n > 1 && (
          <>
            <button type="button" className="gallery__nav gallery__nav--prev" onClick={() => go(-1)} aria-label="Предыдущее фото">
              <ChevronLeft />
            </button>
            <button type="button" className="gallery__nav gallery__nav--next" onClick={() => go(1)} aria-label="Следующее фото">
              <ChevronRight />
            </button>
            <div className="gallery__dots">
              {slides.map((_, k) => (
                <button key={k} type="button" aria-label={`Фото ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} />
              ))}
            </div>
          </>
        )}
      </div>

      {full &&
        cur &&
        createPortal(
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={name} onClick={() => setFull(false)} {...swipe}>
          <div className="lightbox__media" onClick={(e) => e.stopPropagation()}>
            {media(cur, true)}
          </div>
          <button type="button" className="lightbox__close" aria-label="Закрыть" onClick={() => setFull(false)}>
            <X />
          </button>
          {n > 1 && (
            <>
              <button type="button" className="lightbox__nav lightbox__nav--prev" aria-label="Предыдущее" onClick={(e) => (e.stopPropagation(), go(-1))}>
                <ChevronLeft size={30} />
              </button>
              <button type="button" className="lightbox__nav lightbox__nav--next" aria-label="Следующее" onClick={(e) => (e.stopPropagation(), go(1))}>
                <ChevronRight size={30} />
              </button>
              <span className="lightbox__count">
                {i + 1} / {n}
              </span>
            </>
          )}
        </div>,
          document.body,
        )}
    </>
  )
}

/**
 * Фото в слайдере. Если оно меньше слота (владелец загрузил маленькую картинку),
 * не растягиваем его в «мыло», а показываем в натуральном размере на размытом фоне из него же.
 */
function FitImage({ src, alt }: { src: string; alt: string }) {
  const [small, setSmall] = useState(false)
  return (
    <span className={`fitimg ${small ? 'fitimg--small' : ''}`}>
      {small && <img className="fitimg__bg" src={src} alt="" aria-hidden />}
      <img
        className="fitimg__main"
        src={src}
        alt={alt}
        decoding="async"
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget
          const box = img.parentElement!.getBoundingClientRect()
          const need = box.width * Math.min(window.devicePixelRatio || 1, 2) * 0.75
          setSmall(img.naturalWidth < need)
        }}
      />
    </span>
  )
}
