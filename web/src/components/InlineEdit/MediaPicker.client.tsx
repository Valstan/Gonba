'use client'

import React, { useCallback, useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type MediaDoc = {
  id: number | string
  url?: string | null
  alt?: string | null
  filename?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  /** Выбрана существующая картинка — отдаём id + url превью. */
  onSelect: (id: number | string, url: string | null) => void
}

/**
 * Один thumbnail грида со своим индикатором загрузки. На холодном кэше Я.Диска
 * первый показ картинки = ~1с round-trip (MISS) — спиннер поверх плитки даёт
 * понять, что грузится, а не пусто/сломано. Отдельный компонент нужен, чтобы у
 * каждой плитки было собственное состояние загрузки.
 */
const PickerThumb: React.FC<{ doc: MediaDoc; onPick: () => void }> = ({ doc, onPick }) => {
  const [imgLoading, setImgLoading] = useState(Boolean(doc.url))
  return (
    <button
      type="button"
      onClick={onPick}
      className="group relative aspect-square overflow-hidden rounded-md border bg-muted hover:ring-2 hover:ring-primary"
      title={doc.filename || doc.alt || String(doc.id)}
    >
      {doc.url ? (
        <>
          {/* плоский img — в гриде их много, next/image тут избыточен */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={doc.url}
            alt={doc.alt || ''}
            loading="lazy"
            onLoad={() => setImgLoading(false)}
            onError={() => setImgLoading(false)}
            className="h-full w-full object-cover"
          />
          {imgLoading ? (
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground/80" />
            </span>
          ) : null}
        </>
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">нет</span>
      )}
    </button>
  )
}

/**
 * Пикер существующих картинок из библиотеки Media (которые уже на сайте/Я.Диске).
 * Позволяет «подцепить» уже загруженный файл, не создавая дубль на Я.Диске.
 * Источник — Payload REST `GET /api/media` (cookie-auth).
 */
export const MediaPicker: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const [docs, setDocs] = useState<MediaDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async (search: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '48', depth: '0', sort: '-createdAt' })
      const q = search.trim()
      if (q) {
        // поиск по имени файла или alt
        params.set('where[or][0][filename][like]', q)
        params.set('where[or][1][alt][like]', q)
      }
      const res = await fetch(`/api/media?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Не удалось загрузить список (${res.status})`)
      const data = (await res.json()) as { docs?: MediaDoc[] }
      setDocs(Array.isArray(data.docs) ? data.docs : [])
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      void load('')
    }
  }, [open, load])

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Выбрать из загруженных</DialogTitle>
          <DialogDescription>
            Картинки, уже загруженные на сайт (Я.Диск). Выберите, чтобы не загружать дубль.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void load(query)
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени файла…"
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Найти
          </button>
        </form>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Загружаем…</p>
          ) : docs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {docs.map((d) => (
                <PickerThumb
                  key={d.id}
                  doc={d}
                  onPick={() => {
                    onSelect(d.id, d.url ?? null)
                    onClose()
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
