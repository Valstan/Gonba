'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildHighlightSegments, tieredSearch } from '@/utilities/tieredSearch'
import type { TieredResult } from '@/utilities/tieredSearch'

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

/** Сколько плиток показываем в гриде за раз. */
const VISIBLE_LIMIT = 48
/** Размер страницы при загрузке индекса библиотеки. */
const PAGE_SIZE = 200
/** Потолок индекса: библиотека ~500 записей; вырастет сильно — перейдём на серверный поиск. */
const MAX_DOCS = 1000
/** Минимум символов для запуска поиска. */
const MIN_QUERY_CHARS = 2
const DEBOUNCE_MS = 250

/** Текст, по которому ищем: имя файла + alt. */
const docSearchText = (doc: MediaDoc): string =>
  [doc.filename, doc.alt].filter(Boolean).join(' ')

/**
 * Один thumbnail грида со своим индикатором загрузки. На холодном кэше Я.Диска
 * первый показ картинки = ~1с round-trip (MISS) — спиннер поверх плитки даёт
 * понять, что грузится, а не пусто/сломано. Отдельный компонент нужен, чтобы у
 * каждой плитки было собственное состояние загрузки.
 */
const PickerThumb: React.FC<{
  doc: MediaDoc
  caption?: React.ReactNode
  onPick: () => void
}> = ({ doc, caption, onPick }) => {
  const [imgLoading, setImgLoading] = useState(Boolean(doc.url))
  return (
    <button
      type="button"
      onClick={onPick}
      className="group relative flex flex-col overflow-hidden rounded-md border bg-muted hover:ring-2 hover:ring-primary"
      title={doc.filename || doc.alt || String(doc.id)}
    >
      <span className="relative block aspect-square w-full overflow-hidden">
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
          <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            нет
          </span>
        )}
      </span>
      {caption ? (
        <span className="block w-full truncate px-1 py-0.5 text-left text-[10px] leading-tight text-muted-foreground">
          {caption}
        </span>
      ) : null}
    </button>
  )
}

/** Подпись плитки с подсветкой совпадения (tier 1). */
const matchCaption = (result: TieredResult<MediaDoc>): React.ReactNode => {
  const text = docSearchText(result.item)
  if (!text) return null
  if (result.ranges.length === 0) return text
  return buildHighlightSegments(text, result.ranges).map((seg, i) =>
    seg.hit ? (
      <mark key={i} className="rounded-sm bg-amber-200/80 px-0 text-foreground">
        {seg.text}
      </mark>
    ) : (
      <React.Fragment key={i}>{seg.text}</React.Fragment>
    ),
  )
}

/**
 * Пикер существующих картинок из библиотеки Media (которые уже на сайте/Я.Диске).
 * Позволяет «подцепить» уже загруженный файл, не создавая дубль на Я.Диске.
 *
 * Поиск — многоуровневый клиентский (`tieredSearch`, pool #035): substring в любом
 * месте → subsequence → fuzzy, с RU↔EN раскладкой и подсветкой. Для этого при
 * открытии один раз подтягивается лёгкий индекс всей библиотеки (id/url/alt/filename,
 * Payload REST `GET /api/media`, cookie-auth) — при ~500 записях это дешевле и
 * мгновеннее, чем серверный round-trip на каждый ввод.
 */
export const MediaPicker: React.FC<Props> = ({ open, onClose, onSelect }) => {
  const [docs, setDocs] = useState<MediaDoc[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const all: MediaDoc[] = []
      let page = 1
      let total = 0
      // постранично до MAX_DOCS — индекс лёгкий (без depth), картинки лениво грузит грид
      for (;;) {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          page: String(page),
          depth: '0',
          sort: '-createdAt',
        })
        const res = await fetch(`/api/media?${params.toString()}`, { credentials: 'include' })
        if (!res.ok) throw new Error(`Не удалось загрузить список (${res.status})`)
        const data = (await res.json()) as {
          docs?: MediaDoc[]
          totalDocs?: number
          hasNextPage?: boolean
        }
        const batch = Array.isArray(data.docs) ? data.docs : []
        all.push(...batch)
        total = typeof data.totalDocs === 'number' ? data.totalDocs : all.length
        // batch.length === 0 — страховка от вечного цикла при кривом ответе API
        if (!data.hasNextPage || batch.length === 0 || all.length >= MAX_DOCS) break
        page += 1
      }
      setDocs(all)
      setTotalDocs(total)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setAppliedQuery('')
      void loadAll()
    }
  }, [open, loadAll])

  // debounce ввода → appliedQuery
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setAppliedQuery(query), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const searching = appliedQuery.trim().length >= MIN_QUERY_CHARS

  const results = useMemo(
    () => (searching ? tieredSearch(docs, appliedQuery, docSearchText) : []),
    [searching, docs, appliedQuery],
  )

  const fuzzyOnly = searching && results.length > 0 && results[0].tier > 1

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
            // Enter — применить немедленно, не дожидаясь debounce
            if (debounceRef.current) clearTimeout(debounceRef.current)
            setAppliedQuery(query)
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: имя файла или alt, в любом месте…"
            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </form>

        {error ? (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {fuzzyOnly ? (
          <p className="text-xs text-muted-foreground">
            Точных совпадений нет — показаны похожие.
          </p>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Загружаем…</p>
          ) : searching ? (
            results.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {results.slice(0, VISIBLE_LIMIT).map((r) => (
                  <PickerThumb
                    key={r.item.id}
                    doc={r.item}
                    caption={matchCaption(r)}
                    onPick={() => {
                      onSelect(r.item.id, r.item.url ?? null)
                      onClose()
                    }}
                  />
                ))}
              </div>
            )
          ) : docs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {docs.slice(0, VISIBLE_LIMIT).map((d) => (
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
              {totalDocs > VISIBLE_LIMIT ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Показаны последние {Math.min(VISIBLE_LIMIT, docs.length)} из {totalDocs} — уточните
                  поиском.
                </p>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
