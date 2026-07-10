'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { HeartLike } from './HeartLike'
import type { LentaItem } from './lentaTypes'
import { viewSubmission } from './ugcClient'

// Один экран-слайд просмотра: конкретный кадр конкретного поста (мульти-файловые
// посты дают слайд на каждый файл).
type Slide = { item: LentaItem; mediaIdx: number }

/**
 * «Смотреть подряд» — вертикальный полноэкранный просмотр ленты в стиле клипов:
 * свайп/скролл вверх-вниз листает кадры (CSS scroll-snap), справа — лайк и
 * «поделиться», снизу — автор и подпись. Двойной тап по кадру — лайк с «взрывом»
 * сердца. Видео автоплеится (muted) когда слайд виден и ставится на паузу вне
 * экрана. Просмотр видимого слайда пингует счётчик просмотров (дедуп в
 * viewSubmission). Состояние лайков — общее с лентой (likedIds/onToggleLike
 * подняты в LentaFeed): счётчики синхронны.
 */
export function LentaFlow({
  items,
  likedIds,
  onToggleLike,
  onClose,
}: {
  items: LentaItem[]
  likedIds: Set<number>
  onToggleLike: (id: number) => void
  onClose: () => void
}) {
  const slides = useMemo(() => {
    const out: Slide[] = []
    for (const item of items) item.media.forEach((_, mediaIdx) => out.push({ item, mediaIdx }))
    return out
  }, [items])

  const rootRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  // Слайд, на котором сейчас «взрывается» сердце двойного тапа (null — нет анимации).
  const [burstAt, setBurstAt] = useState<number | null>(null)
  const lastTapRef = useRef<{ time: number; slide: number }>({ time: 0, slide: -1 })

  // Активный слайд — из позиции скролла (scroll-snap выравнивает по высоте экрана;
  // синхронный расчёт надёжнее IntersectionObserver и в фоновых вкладках).
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onScroll = () => {
      const h = root.clientHeight
      if (h > 0) setActive(Math.max(0, Math.min(Math.round(root.scrollTop / h), slides.length - 1)))
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [slides.length])

  // Смена активного слайда: пинг просмотра поста (дедуп внутри viewSubmission) +
  // автоплей его видео (muted) и пауза остальных.
  useEffect(() => {
    const slide = slides[active]
    if (slide) void viewSubmission(slide.item.id)
    const root = rootRef.current
    if (!root) return
    root.querySelectorAll<HTMLVideoElement>('[data-slide] video').forEach((v) => {
      const idx = Number(v.closest<HTMLElement>('[data-slide]')?.dataset.slide)
      if (idx === active) {
        v.play().catch(() => {
          /* автоплей мог быть запрещён — пользователь нажмёт сам */
        })
      } else v.pause()
    })
  }, [active, slides])

  // Esc — выход; ↑/↓ — листание; фон страницы не прокручивается.
  const scrollTo = useCallback((idx: number) => {
    const root = rootRef.current
    const el = root?.querySelector<HTMLElement>(`[data-slide="${idx}"]`)
    el?.scrollIntoView({ behavior: 'smooth' })
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        scrollTo(Math.min(active + 1, slides.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        scrollTo(Math.max(active - 1, 0))
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [active, slides.length, onClose, scrollTo])

  // Двойной тап/клик по кадру — лайк (только ставит, не снимает — как в клипах) + взрыв.
  function tapMedia(slideIdx: number, itemId: number) {
    const now = Date.now()
    const last = lastTapRef.current
    lastTapRef.current = { time: now, slide: slideIdx }
    if (now - last.time < 320 && last.slide === slideIdx) {
      if (!likedIds.has(itemId)) onToggleLike(itemId)
      setBurstAt(slideIdx)
      setTimeout(() => setBurstAt((b) => (b === slideIdx ? null : b)), 700)
    }
  }

  // «Поделиться» текущим кадром: системный share (телефон), иначе URL в буфер.
  const [shared, setShared] = useState(false)
  async function share(slide: Slide) {
    const url = slide.item.media[slide.mediaIdx]?.mediaUrl
    if (!url) return
    const absUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`
    try {
      if (navigator.share) {
        await navigator.share({ text: slide.item.caption || undefined, url: absUrl })
        return
      }
    } catch {
      return // отмена пользователем — не ошибка
    }
    try {
      await navigator.clipboard.writeText(absUrl)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      /* нет clipboard — молча */
    }
  }

  if (slides.length === 0) return null

  return (
    <div className="lenta-flow" role="dialog" aria-modal="true" aria-label="Смотреть подряд">
      <button type="button" className="lenta-flow-close" onClick={onClose} aria-label="Выйти из просмотра">
        ×
      </button>
      <span className="lenta-flow-counter" aria-hidden="true">
        {active + 1} / {slides.length}
      </span>
      {active === 0 && slides.length > 1 && <span className="lenta-flow-hint">Листайте вверх ↑</span>}

      <div className="lenta-flow-scroll" ref={rootRef}>
        {slides.map((slide, i) => {
          const m = slide.item.media[slide.mediaIdx]
          const liked = likedIds.has(slide.item.id)
          return (
            <section className="lenta-flow-slide" data-slide={i} key={`${slide.item.id}:${slide.mediaIdx}`}>
              <div className="lenta-flow-media" onPointerUp={() => tapMedia(i, slide.item.id)}>
                {m.kind === 'video' ? (
                  <video
                    src={m.mediaUrl}
                    poster={m.posterUrl ?? undefined}
                    muted
                    loop
                    playsInline
                    controls
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.mediaUrl}
                    alt={slide.item.caption || slide.item.authorName || 'Фото'}
                    loading={Math.abs(i - active) <= 2 ? 'eager' : 'lazy'}
                    draggable={false}
                  />
                )}
                {burstAt === i && (
                  <span className="lenta-flow-burst" aria-hidden="true">
                    <HeartLike filled size={96} />
                  </span>
                )}
              </div>

              <div className="lenta-flow-meta">
                {slide.item.authorName && <strong>{slide.item.authorName}</strong>}
                {slide.item.caption && <p>{slide.item.caption}</p>}
              </div>

              <div className="lenta-flow-rail">
                <button
                  type="button"
                  className={`lenta-flow-act${liked ? ' is-on' : ''}`}
                  onClick={() => onToggleLike(slide.item.id)}
                  aria-pressed={liked}
                  aria-label={liked ? 'Убрать лайк' : 'Нравится'}
                >
                  <HeartLike filled={liked} size={30} />
                  <span>{slide.item.likeCount}</span>
                </button>
                <button
                  type="button"
                  className={`lenta-flow-act${shared && i === active ? ' is-on' : ''}`}
                  onClick={() => share(slide)}
                  aria-label="Поделиться"
                >
                  {shared && i === active ? '✓' : '📤'}
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
