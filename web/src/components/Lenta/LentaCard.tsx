'use client'

import { useEffect, useState } from 'react'

import { HeartLike } from './HeartLike'
import { LentaComments } from './LentaComments'
import type { LentaItem, LentaMedia } from './lentaTypes'
import { deleteSubmission, hasViewed, isMine, ugcHeaders, viewSubmission } from './ugcClient'

// Миниатюра одного медиа в мозаике поста: фото — <img>, видео — постер/заглушка с ▶.
// Своё состояние broken (битый URL → иконка-фолбэк). overlay — «+N» на последней плитке.
function MediaThumb({
  media,
  alt,
  label,
  overlay,
  onOpen,
}: {
  media: LentaMedia
  alt: string
  label: string
  overlay?: string | null
  onOpen: () => void
}) {
  const [broken, setBroken] = useState(false)
  const isVideo = media.kind === 'video'
  return (
    <button type="button" className="lenta-thumb" onClick={onOpen} aria-label={label}>
      {!broken && (isVideo ? media.posterUrl : media.mediaUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={(isVideo ? media.posterUrl : media.mediaUrl) as string}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="lenta-fallback" aria-hidden="true">
          {isVideo ? '🎬' : '📷'}
        </span>
      )}
      {isVideo && (
        <span className="lenta-play" aria-hidden="true">
          ▶
        </span>
      )}
      {overlay && (
        <span className="lenta-thumb-more" aria-hidden="true">
          +{overlay}
        </span>
      )}
    </button>
  )
}

// Карточка ленты с медиа и взаимодействием: лайк/отмена (оптимистично, дедуп
// localStorage + серверный 409), поделиться (Web Share), пожаловаться, комментарии
// (раскрываемый тред), удалить свою публикацию (по токену). Медиа — напрямую с
// Object Storage. Пост-в-стиле-ВК: одна подпись — несколько файлов (item.media),
// мозаикой; клик по любому открывает галерею поста с этого кадра (onOpenMedia(index)).
export function LentaCard({
  item,
  liked,
  onToggleLike,
  onRemoved,
  onOpenMedia,
}: {
  item: LentaItem
  liked: boolean
  onToggleLike: () => void
  onRemoved?: (id: number) => void
  onOpenMedia?: (mediaIndex: number) => void
}) {
  const [viewCount, setViewCount] = useState(item.viewCount)
  const [viewed, setViewed] = useState(false)
  const [reported, setReported] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(item.commentCount)
  const [mine, setMine] = useState(false)
  const [actErr, setActErr] = useState(false)

  // «Моё»/жалоба — из localStorage после гидрации (иначе SSR/CSR расходятся). Лайк
  // поднят в LentaFeed (общий с лайтбоксом) → сюда приходит пропсом.
  useEffect(() => {
    try {
      if (localStorage.getItem(`ugc-reported:${item.id}`)) setReported(true)
    } catch {
      /* приватный режим — игнор */
    }
    if (hasViewed(item.id)) setViewed(true)
    setMine(isMine('submission', item.id))
  }, [item.id])

  // Открытие медиа (лайтбокс/видео) = просмотр поста. Засчитываем один раз на браузер,
  // оптимистично инкрементим счётчик; если сервер не засчитал (уже было) — откат.
  function openMedia(mediaIndex: number) {
    if (!viewed) {
      setViewed(true)
      setViewCount((c) => c + 1)
      void viewSubmission(item.id).then((counted) => {
        if (!counted) setViewCount((c) => Math.max(item.viewCount, c - 1))
      })
    }
    onOpenMedia?.(mediaIndex)
  }

  async function del() {
    if (typeof window !== 'undefined' && !window.confirm('Удалить публикацию?')) return
    setActErr(false)
    const ok = await deleteSubmission(item.id)
    if (ok) onRemoved?.(item.id)
    else setActErr(true)
  }

  async function report() {
    if (reported) return
    setReported(true)
    try {
      localStorage.setItem(`ugc-reported:${item.id}`, '1')
    } catch {
      /* игнор */
    }
    try {
      await fetch('/api/content-reports', {
        method: 'POST',
        headers: ugcHeaders(),
        body: JSON.stringify({ targetType: 'submission', targetId: item.id }),
      })
    } catch {
      /* молча — пометка «пожаловались» уже стоит */
    }
  }

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
    const text = item.caption || 'Народная лента — Гоньба'
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Народная лента', text, url })
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`)
      }
    } catch {
      /* отмена — молча */
    }
  }

  const media =
    item.media.length > 0
      ? item.media
      : [{ kind: item.kind, mediaUrl: item.mediaUrl, posterUrl: item.posterUrl, width: item.width, height: item.height }]
  // Мозаика: показываем до 4 плиток; если файлов больше — на 4-й бейдж «+N».
  const MAX_TILES = 4
  const tiles = media.slice(0, MAX_TILES)
  const extra = media.length - MAX_TILES
  const alt = item.caption || item.authorName || 'Фото'

  return (
    <li className="lenta-card">
      <div
        className={`lenta-media lenta-media--n${Math.min(media.length, MAX_TILES)}${media.length > 1 ? ' is-mosaic' : ''}`}
      >
        {tiles.map((m, i) => (
          <MediaThumb
            key={i}
            media={m}
            alt={alt}
            label={m.kind === 'video' ? 'Смотреть видео' : 'Открыть фото'}
            overlay={i === MAX_TILES - 1 && extra > 0 ? String(extra) : null}
            onOpen={() => openMedia(i)}
          />
        ))}
      </div>

      <div className="lenta-card-body">
        {item.caption && <p className="lenta-caption">{item.caption}</p>}
        <span className="lenta-byline">
          {item.authorName && <span className="lenta-author">{item.authorName}</span>}
          {mine && <span className="lenta-mine">Ваше</span>}
        </span>

        <div className="lenta-actions">
          <button
            type="button"
            className={`lenta-act lenta-act--like${liked ? ' is-on' : ''}`}
            onClick={onToggleLike}
            aria-pressed={liked}
            aria-label={liked ? 'Убрать лайк' : 'Нравится'}
          >
            <HeartLike filled={liked} /> {item.likeCount}
          </button>
          <button
            type="button"
            className={`lenta-act${commentsOpen ? ' is-on' : ''}`}
            onClick={() => setCommentsOpen((o) => !o)}
            aria-expanded={commentsOpen}
            aria-label="Комментарии"
          >
            💬 {commentCount}
          </button>
          <span className="lenta-stat" title="Просмотры" aria-label="Просмотры">
            👁 {viewCount}
          </span>
          <button type="button" className="lenta-act" onClick={share} aria-label="Поделиться">
            ↗
          </button>
          <button
            type="button"
            className="lenta-act lenta-act--report"
            onClick={report}
            disabled={reported}
            title={reported ? 'Жалоба отправлена' : 'Пожаловаться'}
            aria-label="Пожаловаться"
          >
            {reported ? '✓' : '⚑'}
          </button>
          {mine && (
            <button type="button" className="lenta-act lenta-act--danger" onClick={del} title="Удалить" aria-label="Удалить">
              🗑
            </button>
          )}
        </div>
        {actErr && (
          <p className="lenta-act-err" role="alert">
            Не получилось. Попробуйте ещё раз.
          </p>
        )}

        {commentsOpen && (
          <LentaComments
            submissionId={item.id}
            onAdded={() => setCommentCount((c) => c + 1)}
            onRemoved={() => setCommentCount((c) => Math.max(0, c - 1))}
          />
        )}
      </div>
    </li>
  )
}
