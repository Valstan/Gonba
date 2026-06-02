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
type RawArrayItem = { media?: RawMedia; image?: RawMedia; [k: string]: unknown }
type RawBlock = {
  blockType?: string
  columns?: RawColumn[]
  items?: RawArrayItem[]
  [k: string]: unknown
}
type RawHero = { type?: string; media?: RawMedia; [k: string]: unknown }
type RawPage = { id: number | string; title?: string; hero?: RawHero; layout?: RawBlock[] }

type EditField = { blockIndex: number; colIndex: number; html: string; unsupported: boolean }

// Где живёт картинка: обложка (hero) страницы или элемент массива блока.
type MediaTarget =
  | { kind: 'hero' }
  | { kind: 'item'; blockIndex: number; itemIndex: number; field: 'media' | 'image' }

type MediaSlot = {
  key: string
  label: string
  target: MediaTarget
  mediaId: number | string | null
  previewUrl: string | null
}

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

/**
 * Кнопка «Редактировать страницу» (видна редактору при логине) + модалка правки
 * заголовка, текста Content-блоков и картинок (обложка + mediaBlock/gallery)
 * прямо на странице.
 *
 * Безопасность round-trip: layout/hero берём через GET /api/pages/{id}?depth=0
 * (связи/медиа как id — ничего не теряется при обратном PATCH). Меняем только
 * richText текстовых колонок и id картинок. Сложные блоки — пока в админке.
 *
 * Картинки правим в режиме «заменить» (replace / выбрать из загруженных): поля
 * media обязательны, поэтому удаление/добавление элементов массива здесь не
 * делаем — это безопаснее для round-trip и required-валидации.
 */
export const PageEditor: React.FC<{ id: number | string; title: string }> = ({ id, title: initialTitle }) => {
  const { isAdmin } = useAdminMode()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [raw, setRaw] = useState<RawPage | null>(null)
  const [fields, setFields] = useState<EditField[]>([])
  const [mediaSlots, setMediaSlots] = useState<MediaSlot[]>([])
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

      // 2. Картинки: обложка (hero) + элементы mediaBlock/gallery
      const slots: MediaSlot[] = []
      const heroType = page.hero?.type
      // media у обложки показывается только для полноэкранной/средней
      if (page.hero && (heroType === 'highImpact' || heroType === 'mediumImpact')) {
        const heroId = mediaIdOf(page.hero.media)
        slots.push({
          key: 'hero',
          label: 'Обложка страницы',
          target: { kind: 'hero' },
          mediaId: heroId,
          previewUrl: previewFor(heroId),
        })
      }
      let mediaBlockNo = 0
      let galleryNo = 0
      layout.forEach((block, bi) => {
        if (block?.blockType === 'mediaBlock' && Array.isArray(block.items)) {
          mediaBlockNo += 1
          block.items.forEach((item, ii) => {
            const mid = mediaIdOf(item?.media)
            slots.push({
              key: `b${bi}-i${ii}-media`,
              label: `Медиаблок ${mediaBlockNo} — изображение ${ii + 1}`,
              target: { kind: 'item', blockIndex: bi, itemIndex: ii, field: 'media' },
              mediaId: mid,
              previewUrl: previewFor(mid),
            })
          })
        } else if (block?.blockType === 'gallery' && Array.isArray(block.items)) {
          galleryNo += 1
          const t = typeof block.title === 'string' && block.title.trim()
          const galleryLabel = t ? `«${(block.title as string).trim()}»` : `${galleryNo}`
          block.items.forEach((item, ii) => {
            const mid = mediaIdOf(item?.image)
            slots.push({
              key: `b${bi}-i${ii}-image`,
              label: `Галерея ${galleryLabel} — изображение ${ii + 1}`,
              target: { kind: 'item', blockIndex: bi, itemIndex: ii, field: 'image' },
              mediaId: mid,
              previewUrl: previewFor(mid),
            })
          })
        }
      })
      setMediaSlots(slots)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!raw) return
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
      // картинки блоков (mediaBlock/gallery)
      for (const m of mediaSlots) {
        if (m.target.kind !== 'item') continue
        const { blockIndex, itemIndex, field } = m.target
        const item = layout[blockIndex]?.items?.[itemIndex]
        if (item) item[field] = m.mediaId
      }

      const body: Record<string, unknown> = {
        title: title.trim() || initialTitle,
        layout,
        _status: 'published',
      }

      // обложку (hero) отправляем целиком (depth=0 round-trip), только если меняли
      const heroSlot = mediaSlots.find((m) => m.target.kind === 'hero')
      if (heroSlot && raw.hero && heroSlot.mediaId !== mediaIdOf(raw.hero.media)) {
        const hero = JSON.parse(JSON.stringify(raw.hero)) as RawHero
        hero.media = heroSlot.mediaId
        body.hero = hero
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

  const nothingToEdit = !loading && fields.length === 0 && mediaSlots.length === 0

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

              {mediaSlots.length > 0 ? (
                <div className="grid gap-3 border-t pt-4">
                  <p className="text-sm font-medium">Картинки</p>
                  {mediaSlots.map((slot) => (
                    <div key={slot.key} className="grid gap-1.5">
                      <label className="text-xs text-muted-foreground">{slot.label}</label>
                      <InlineImage
                        previewUrl={slot.previewUrl}
                        alt={title}
                        allowRemove={false}
                        onChange={(mid, url) =>
                          setMediaSlots((prev) =>
                            prev.map((s) => (s.key === slot.key ? { ...s, mediaId: mid, previewUrl: url } : s)),
                          )
                        }
                        onError={setError}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

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
