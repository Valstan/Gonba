'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { HeartLike } from './HeartLike'
import type { LentaMedia } from './lentaTypes'
import { deleteSubmission, isMine } from './ugcClient'

/**
 * Полноэкранный лайтбокс «Народной ленты». Контролируется из LentaFeed: получает медиа
 * ОДНОГО поста (`media`, пост-в-стиле-ВК) и активный `index`, состояние перелистывания
 * не хранит. Навигация: ‹/›, ←/→, Esc, клик по фону — закрыть; на телефоне свайп (фото).
 * Видео играет в оверлее (нативные controls). Панель действий под медиа: лайк, «на весь
 * экран» (Fullscreen API + CSS-разворот, работает и на iOS), поделиться, удалить своё.
 */
export function LentaLightbox({
  submissionId,
  media,
  index,
  caption,
  authorName,
  liked = false,
  likeCount = 0,
  onClose,
  onToggleLike,
  onRemoved,
  onNavigate,
}: {
  submissionId?: number
  media: LentaMedia[]
  index: number
  caption: string | null
  authorName: string | null
  liked?: boolean
  likeCount?: number
  onClose: () => void
  onToggleLike?: () => void
  onRemoved?: (id: number) => void
  onNavigate: (i: number) => void
}) {
  const n = media.length
  const current = media[index]

  const dialogRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  // Точка касания для свайпа + флаг «только что был свайп» (чтобы тап-после-свайпа
  // не закрыл оверлей следующим за touchend кликом-фоном).
  const touchRef = useRef<{ x: number; y: number } | null>(null)
  const swipedRef = useRef(false)

  // Развёрнут ли на весь экран (CSS-разворот; + Fullscreen API где поддержан).
  const [expanded, setExpanded] = useState(false)

  const [mine, setMine] = useState(false)
  useEffect(() => {
    setMine(submissionId != null && isMine('submission', submissionId))
  }, [submissionId])
  const canDelete = submissionId != null && mine

  const go = useCallback((i: number) => onNavigate(((i % n) + n) % n), [n, onNavigate])

  const collapse = useCallback(() => {
    setExpanded(false)
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.()
    } catch {
      /* ignore */
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = dialogRef.current
    const willExpand = !expanded
    setExpanded(willExpand)
    try {
      if (willExpand) void el?.requestFullscreen?.()
      else if (document.fullscreenElement) void document.exitFullscreen?.()
    } catch {
      /* iOS: div-fullscreen недоступен — CSS-разворот всё равно применился */
    }
  }, [expanded])

  // Клавиатура (Esc / ←/→) + focus-trap по Tab + блокировка прокрутки фона.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expanded) collapse()
        else onClose()
      } else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
      else if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button')
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [index, go, onClose, expanded, collapse])

  // Синхронизация CSS-разворота с реальным выходом из Fullscreen (Esc/жест браузера).
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setExpanded(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      try {
        if (document.fullscreenElement) void document.exitFullscreen?.()
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Упреждающая подгрузка соседних кадров (±2) — чтобы листание свайпом/стрелками
  // шло плавно без «раздумий»: следующие фото уже в кэше браузера к моменту показа.
  useEffect(() => {
    for (let d = -2; d <= 2; d += 1) {
      if (d === 0) continue
      const m = media[(((index + d) % n) + n) % n]
      if (m && m.kind === 'photo' && m.mediaUrl) {
        const img = new Image()
        img.src = m.mediaUrl
      }
    }
  }, [index, media, n])

  // Фокус: при открытии — на «Закрыть»; при закрытии — обратно на элемент-триггер.
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()
    return () => {
      trigger?.focus?.()
    }
  }, [])

  function onTouchStart(e: React.TouchEvent) {
    // На видео свайп не перехватываем — там нативный скраббер (горизонтальный drag).
    if ((e.target as HTMLElement).closest('video')) {
      touchRef.current = null
      return
    }
    const tp = e.touches[0]
    touchRef.current = { x: tp.clientX, y: tp.clientY }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchRef.current
    touchRef.current = null
    if (!start || n < 2) return
    const tp = e.changedTouches[0]
    const dx = tp.clientX - start.x
    const dy = tp.clientY - start.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      // был свайп → подавим закрытие по клику-фону, идущее следом за touchend
      swipedRef.current = true
      go(index + (dx < 0 ? 1 : -1))
    }
  }

  // Тап по фону закрывает; но если только что был свайп — пропускаем один клик.
  function onBackdropClick() {
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    onClose()
  }

  // «Поделиться» текущим кадром: системный share (телефон), иначе — URL в буфер.
  const [shared, setShared] = useState(false)
  async function share() {
    const url = current?.mediaUrl
    if (!url) return
    const abs = url.startsWith('http') ? url : `${window.location.origin}${url}`
    try {
      if (navigator.share) {
        await navigator.share({ text: caption || undefined, url: abs })
        return
      }
    } catch {
      return // отмена пользователем — не ошибка
    }
    try {
      await navigator.clipboard.writeText(abs)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      /* нет clipboard — молча */
    }
  }

  async function del() {
    if (submissionId == null || !onRemoved) return
    if (typeof window !== 'undefined' && !window.confirm('Удалить публикацию?')) return
    const ok = await deleteSubmission(submissionId)
    if (ok) onRemoved(submissionId) // LentaFeed уберёт из ленты и закроет лайтбокс
  }

  if (!current) return null

  return (
    <div
      className={`lightbox${expanded ? ' is-expanded' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр публикации"
      ref={dialogRef}
      onClick={onBackdropClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        ref={closeBtnRef}
        className="lightbox-btn lightbox-close"
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
      >
        ×
      </button>

      {n > 1 && (
        <button
          className="lightbox-btn lightbox-nav prev"
          type="button"
          aria-label="Предыдущий кадр"
          onClick={(e) => {
            e.stopPropagation()
            go(index - 1)
          }}
        >
          ‹
        </button>
      )}

      <figure className="lightbox-fig" onClick={(e) => e.stopPropagation()}>
        {current.kind === 'video' ? (
          <video
            key={index}
            className="lightbox-video"
            src={current.mediaUrl}
            poster={current.posterUrl ?? undefined}
            controls
            autoPlay
            playsInline
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={index} src={current.mediaUrl} alt={caption || authorName || 'Фото'} />
        )}
        {(caption || authorName) && (
          <figcaption>
            {caption}
            {caption && authorName ? ' — ' : ''}
            {authorName}
          </figcaption>
        )}
      </figure>

      {n > 1 && (
        <button
          className="lightbox-btn lightbox-nav next"
          type="button"
          aria-label="Следующий кадр"
          onClick={(e) => {
            e.stopPropagation()
            go(index + 1)
          }}
        >
          ›
        </button>
      )}

      {n > 1 && (
        <span className="lightbox-count">
          {index + 1} / {n}
        </span>
      )}

      {/* Панель действий под медиа: лайк · на весь экран · поделиться · удалить своё. */}
      <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
        {onToggleLike && (
          <button
            type="button"
            className={`lightbox-act lightbox-like${liked ? ' is-on' : ''}`}
            onClick={onToggleLike}
            aria-pressed={liked}
            aria-label={liked ? 'Убрать лайк' : 'Нравится'}
          >
            <HeartLike filled={liked} size={24} />
            <span>{likeCount}</span>
          </button>
        )}

        <button
          type="button"
          className={`lightbox-act${expanded ? ' is-on' : ''}`}
          onClick={toggleFullscreen}
          aria-pressed={expanded}
          aria-label={expanded ? 'Свернуть' : 'На весь экран'}
        >
          <svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {expanded ? (
              <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            ) : (
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            )}
          </svg>
        </button>

        <button
          type="button"
          className={`lightbox-act${shared ? ' is-on' : ''}`}
          onClick={share}
          aria-label="Поделиться"
          title="Поделиться"
        >
          {shared ? '✓' : '📤'}
        </button>

        {canDelete && onRemoved && (
          <button type="button" className="lightbox-act lightbox-act--danger" onClick={del} aria-label="Удалить">
            🗑
          </button>
        )}
      </div>
    </div>
  )
}
