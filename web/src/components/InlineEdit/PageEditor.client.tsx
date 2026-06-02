'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAdminMode } from '@/providers/AdminMode'
import { InlineImage } from './InlineImage.client'
import { LiteRichTextEditor } from './LiteRichTextEditor.client'
import { hasUnsupportedNodes, htmlToLexical, lexicalToHtml } from './lexical-lite'

type RawColumn = { richText?: unknown; [k: string]: unknown }
type RawMedia = number | string | { id?: number | string } | null | undefined
type RawArrayItem = { media?: RawMedia; image?: RawMedia; caption?: unknown; [k: string]: unknown }
type RawBlock = {
  blockType?: string
  columns?: RawColumn[]
  items?: RawArrayItem[]
  [k: string]: unknown
}
type RawHero = { type?: string; media?: RawMedia; [k: string]: unknown }
type RawPage = { id: number | string; title?: string; hero?: RawHero; layout?: RawBlock[] }

type EditField = { blockIndex: number; colIndex: number; html: string; unsupported: boolean }

// Обложка (hero) страницы — заменяется целиком, без подписи и без add/remove.
type HeroSlot = { mediaId: number | string | null; previewUrl: string | null }

// Элемент массива картинок (mediaBlock/gallery): media/image (required) + caption.
type ImageItem = {
  uid: string
  // Индекс в исходном block.items — чтобы при сохранении сохранить остальные поля
  // строки массива (включая её id). null — элемент добавлен в этой сессии.
  rawIndex: number | null
  mediaId: number | string | null
  previewUrl: string | null
  caption: string
}

// Редактируемый блок картинок (mediaBlock или gallery).
type ImageBlock = {
  blockIndex: number
  field: 'media' | 'image' // имя поля upload внутри элемента
  label: string
  minRows: number
  items: ImageItem[]
}

// Стабильные ключи React для добавляемых элементов (без зависимости от индекса).
let uidCounter = 0
const nextUid = () => `img-${(uidCounter += 1)}`

/** Достаёт id media-связи независимо от depth (id или объект {id}). */
function mediaIdOf(v: RawMedia): number | string | null {
  if (v == null) return null
  if (typeof v === 'object') return v.id ?? null
  return v
}

/**
 * URL превью по id — это канонический путь раздачи media (см. afterRead-хук
 * Media: doc.url = /api/media/file/{id}). Поэтому превью совпадает с тем, что
 * реально рендерится на странице, и не нужен доп. запрос за url при depth=0.
 */
function previewFor(id: number | string | null): string | null {
  return id == null ? null : `/api/media/file/${id}`
}

function captionOf(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/**
 * Кнопка «Редактировать страницу» (видна редактору при логине) + модалка правки
 * заголовка, текста Content-блоков и картинок (обложка + mediaBlock/gallery)
 * прямо на странице.
 *
 * Безопасность round-trip: layout/hero берём через GET /api/pages/{id}?depth=0
 * (связи/медиа как id — ничего не теряется при обратном PATCH). Меняем только
 * richText текстовых колонок, картинки и подписи. Сложные блоки — пока в админке.
 *
 * Картинки mediaBlock/gallery: можно заменить файл, править подпись (caption) и
 * добавлять/удалять элементы массива. Upload в элементе обязателен (required) —
 * перед сохранением проверяем, что у каждого элемента выбран файл, и не даём
 * удалить элементы ниже minRows (1). Обложка (hero) — только замена файла.
 */
export const PageEditor: React.FC<{ id: number | string; title: string }> = ({ id, title: initialTitle }) => {
  const { isAdmin } = useAdminMode()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [raw, setRaw] = useState<RawPage | null>(null)
  const [fields, setFields] = useState<EditField[]>([])
  const [hero, setHero] = useState<HeroSlot | null>(null)
  const [imageBlocks, setImageBlocks] = useState<ImageBlock[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openEditor = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    setTitle(initialTitle)
    try {
      const res = await fetch(`/api/pages/${id}?depth=0`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Не удалось загрузить страницу (${res.status})`)
      const page = (await res.json()) as RawPage
      setRaw(page)
      const layout = Array.isArray(page.layout) ? page.layout : []

      // 1. Текстовые колонки Content-блоков
      const list: EditField[] = []
      layout.forEach((block, bi) => {
        if (block?.blockType === 'content' && Array.isArray(block.columns)) {
          block.columns.forEach((col, ci) => {
            if (col && col.richText) {
              list.push({
                blockIndex: bi,
                colIndex: ci,
                html: lexicalToHtml(col.richText),
                unsupported: hasUnsupportedNodes(col.richText),
              })
            }
          })
        }
      })
      setFields(list)

      // 2. Обложка (hero) — media показываем только для полноэкранной/средней
      const heroType = page.hero?.type
      if (page.hero && (heroType === 'highImpact' || heroType === 'mediumImpact')) {
        const heroId = mediaIdOf(page.hero.media)
        setHero({ mediaId: heroId, previewUrl: previewFor(heroId) })
      } else {
        setHero(null)
      }

      // 3. Блоки картинок mediaBlock/gallery — с caption и add/remove
      const blocks: ImageBlock[] = []
      let mediaBlockNo = 0
      let galleryNo = 0
      layout.forEach((block, bi) => {
        if (block?.blockType === 'mediaBlock' && Array.isArray(block.items)) {
          mediaBlockNo += 1
          blocks.push({
            blockIndex: bi,
            field: 'media',
            label: `Медиаблок ${mediaBlockNo}`,
            minRows: 1,
            items: block.items.map((item, ii) => {
              const mid = mediaIdOf(item?.media)
              return { uid: nextUid(), rawIndex: ii, mediaId: mid, previewUrl: previewFor(mid), caption: captionOf(item?.caption) }
            }),
          })
        } else if (block?.blockType === 'gallery' && Array.isArray(block.items)) {
          galleryNo += 1
          const t = typeof block.title === 'string' && block.title.trim()
          const galleryLabel = t ? `«${(block.title as string).trim()}»` : `${galleryNo}`
          blocks.push({
            blockIndex: bi,
            field: 'image',
            label: `Галерея ${galleryLabel}`,
            minRows: 1,
            items: block.items.map((item, ii) => {
              const mid = mediaIdOf(item?.image)
              return { uid: nextUid(), rawIndex: ii, mediaId: mid, previewUrl: previewFor(mid), caption: captionOf(item?.caption) }
            }),
          })
        }
      })
      setImageBlocks(blocks)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setLoading(false)
    }
  }

  const updateItem = (blockIndex: number, uid: string, patch: Partial<ImageItem>) => {
    setImageBlocks((prev) =>
      prev.map((blk) =>
        blk.blockIndex === blockIndex
          ? { ...blk, items: blk.items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)) }
          : blk,
      ),
    )
  }

  const addItem = (blockIndex: number) => {
    setImageBlocks((prev) =>
      prev.map((blk) =>
        blk.blockIndex === blockIndex
          ? { ...blk, items: [...blk.items, { uid: nextUid(), rawIndex: null, mediaId: null, previewUrl: null, caption: '' }] }
          : blk,
      ),
    )
  }

  const removeItem = (blockIndex: number, uid: string) => {
    setImageBlocks((prev) =>
      prev.map((blk) =>
        blk.blockIndex === blockIndex ? { ...blk, items: blk.items.filter((it) => it.uid !== uid) } : blk,
      ),
    )
  }

  const save = async () => {
    if (!raw) return
    // Валидация required-upload: каждый элемент картиночного блока должен иметь файл.
    for (const blk of imageBlocks) {
      const empty = blk.items.findIndex((it) => it.mediaId == null)
      if (empty !== -1) {
        setError(`«${blk.label}»: у изображения ${empty + 1} не выбран файл — выберите файл или удалите элемент.`)
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const layout: RawBlock[] = JSON.parse(JSON.stringify(raw.layout || []))
      // текст
      for (const f of fields) {
        if (f.unsupported) continue
        const col = layout[f.blockIndex]?.columns?.[f.colIndex]
        if (col) col.richText = htmlToLexical(f.html)
      }
      // картинки блоков (mediaBlock/gallery): пересобираем items (caption + add/remove)
      for (const blk of imageBlocks) {
        const target = layout[blk.blockIndex]
        if (!target) continue
        const rawItems = Array.isArray(target.items) ? target.items : []
        target.items = blk.items.map((it) => {
          // Сохраняем исходный объект строки (включая её id и будущие поля),
          // переопределяя только upload-поле и подпись.
          const base: RawArrayItem =
            it.rawIndex != null && rawItems[it.rawIndex] ? { ...rawItems[it.rawIndex] } : {}
          base[blk.field] = it.mediaId
          base.caption = it.caption.trim() ? it.caption.trim() : null
          return base
        })
      }

      const body: Record<string, unknown> = {
        title: title.trim() || initialTitle,
        layout,
        _status: 'published',
      }

      // обложку (hero) отправляем целиком (depth=0 round-trip), только если меняли
      if (hero && raw.hero && hero.mediaId !== mediaIdOf(raw.hero.media)) {
        const h = JSON.parse(JSON.stringify(raw.hero)) as RawHero
        h.media = hero.mediaId
        body.hero = h
      }

      const res = await fetch(`/api/pages/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Не удалось сохранить (${res.status}): ${txt.slice(0, 200)}`)
      }
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) return null

  const nothingToEdit = !loading && fields.length === 0 && !hero && imageBlocks.length === 0

  return (
    <div className="container">
      <div className="mx-auto flex max-w-[48rem] items-center justify-end py-2">
        <button
          type="button"
          onClick={openEditor}
          className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Редактировать страницу
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактирование страницы</DialogTitle>
            <DialogDescription>Заголовок, текст и картинки. Сложные блоки — в админке.</DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Загружаем…</p>
          ) : (
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Заголовок</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {fields.length === 0 ? null : (
                fields.map((f, i) => (
                  <div key={`${f.blockIndex}-${f.colIndex}`} className="grid gap-1.5">
                    <label className="text-sm font-medium">Текстовый блок {i + 1}</label>
                    {f.unsupported ? (
                      <p className="rounded-md border border-amber-400/50 bg-amber-50 p-2 text-sm text-amber-800">
                        Этот блок содержит сложное форматирование — правьте в админке, чтобы не потерять.
                      </p>
                    ) : (
                      <LiteRichTextEditor
                        initialHtml={f.html}
                        onChange={(html) =>
                          setFields((prev) => prev.map((pf, idx) => (idx === i ? { ...pf, html } : pf)))
                        }
                      />
                    )}
                  </div>
                ))
              )}

              {hero ? (
                <div className="grid gap-1.5 border-t pt-4">
                  <p className="text-sm font-medium">Обложка страницы</p>
                  <InlineImage
                    previewUrl={hero.previewUrl}
                    alt={title}
                    allowRemove={false}
                    onChange={(mid, url) => setHero((h) => (h ? { ...h, mediaId: mid, previewUrl: url } : h))}
                    onError={setError}
                  />
                </div>
              ) : null}

              {imageBlocks.map((blk) => (
                <div key={blk.blockIndex} className="grid gap-3 border-t pt-4">
                  <p className="text-sm font-medium">{blk.label}</p>
                  {blk.items.map((it, idx) => (
                    <div key={it.uid} className="grid gap-1.5 rounded-md border border-border/60 p-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">Изображение {idx + 1}</label>
                        {blk.items.length > blk.minRows ? (
                          <button
                            type="button"
                            onClick={() => removeItem(blk.blockIndex, it.uid)}
                            className="text-xs text-destructive underline-offset-2 hover:underline"
                          >
                            удалить
                          </button>
                        ) : null}
                      </div>
                      <InlineImage
                        previewUrl={it.previewUrl}
                        alt={it.caption || title}
                        allowRemove={false}
                        onChange={(mid, url) => updateItem(blk.blockIndex, it.uid, { mediaId: mid, previewUrl: url })}
                        onError={setError}
                      />
                      <input
                        type="text"
                        value={it.caption}
                        placeholder="Подпись (необязательно)"
                        onChange={(e) => updateItem(blk.blockIndex, it.uid, { caption: e.target.value })}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem(blk.blockIndex)}
                    className="inline-flex h-9 items-center justify-center gap-1 self-start rounded-md border border-dashed border-input bg-background px-3 text-sm font-medium text-muted-foreground shadow-sm hover:bg-accent"
                  >
                    + Добавить изображение
                  </button>
                </div>
              ))}

              {nothingToEdit ? (
                <p className="text-sm text-muted-foreground">
                  На этой странице нет простых блоков для правки здесь. Сложные блоки правьте в админке.
                </p>
              ) : null}

              {error ? (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
