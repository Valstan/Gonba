'use client'

import React, { useCallback, useEffect, useState } from 'react'

export type CloudImage = {
  id: string
  url: string
  alt: string
  width: number | null
  height: number | null
}

type Props = {
  initialItems: CloudImage[]
  totalDocs: number
  perPage: number
}

type MediaRestDoc = {
  id: number | string
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
  mimeType?: string | null
}

/**
 * Публичная фотогалерея «Облако». Первая страница рендерится на сервере (SSR,
 * ISR revalidate), дальше подгрузка через публичный REST `/api/media`
 * (коллекция Media — read: anyone). Клик по фото открывает лайтбокс
 * со стрелками и клавиатурной навигацией.
 */
export const CloudGallery: React.FC<Props> = ({ initialItems, totalDocs, perPage }) => {
  const [items, setItems] = useState<CloudImage[]>(initialItems)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<number | null>(null)

  const hasMore = items.length < totalDocs

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setError(null)
    const next = page + 1
    try {
      const params = new URLSearchParams({
        depth: '0',
        limit: String(perPage),
        page: String(next),
        sort: '-createdAt',
        'where[mimeType][like]': 'image',
      })
      const res = await fetch(`/api/media?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { docs?: MediaRestDoc[] } = await res.json()
      const more: CloudImage[] = (data.docs || [])
        .map((d) => ({
          id: String(d.id),
          url: d.url || `/api/media/file/${d.id}`,
          alt: d.alt || '',
          width: d.width ?? null,
          height: d.height ?? null,
        }))
        .filter((d) => Boolean(d.url))
      // Дедуп по id на случай пересечения страниц.
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...more.filter((m) => !seen.has(m.id))]
      })
      setPage(next)
    } catch (err) {
      setError('Не удалось загрузить ещё фото. Попробуйте ещё раз.')
      console.warn('[cloud-gallery] load more failed:', (err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page, perPage])

  const close = useCallback(() => setLightbox(null), [])
  const prev = useCallback(
    () => setLightbox((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [items.length],
  )
  const next = useCallback(
    () => setLightbox((i) => (i === null ? null : (i + 1) % items.length)),
    [items.length],
  )

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightbox, close, prev, next])

  const current = lightbox === null ? null : items[lightbox]

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((img, index) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightbox(index)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={img.alt || 'Открыть фото'}
          >
            {/* Прокси /api/media/file/[id] — обычный <img>, без next/image-доменов */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {hasMore ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-6 py-2 text-sm font-medium transition-colors hover:bg-accent/40 disabled:opacity-60"
          >
            {loading ? 'Загрузка…' : 'Показать ещё'}
          </button>
          <p className="text-xs text-muted-foreground">
            Показано {items.length} из {totalDocs}
          </p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : (
        <p className="mt-8 text-center text-xs text-muted-foreground">Показаны все {totalDocs} фото</p>
      )}

      {current ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            aria-label="Закрыть"
          >
            ×
          </button>
          {items.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  prev()
                }}
                className="absolute left-2 top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white hover:bg-white/20 sm:left-4"
                aria-label="Предыдущее фото"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
                className="absolute right-2 top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl text-white hover:bg-white/20 sm:right-4"
                aria-label="Следующее фото"
              >
                ›
              </button>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
          />
        </div>
      ) : null}
    </div>
  )
}
