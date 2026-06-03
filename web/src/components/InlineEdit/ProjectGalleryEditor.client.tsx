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

type RawMedia = number | string | { id?: number | string } | null | undefined
type RawGalleryItem = { id?: number | string; image?: RawMedia; caption?: unknown; [k: string]: unknown }

// Строка галереи в state: image (required) + caption. rawIndex — индекс в
// исходном массиве (чтобы сохранить id строки и прочие поля); null — добавлена.
type GalleryRow = {
  uid: string
  rawIndex: number | null
  mediaId: number | string | null
  previewUrl: string | null
  caption: string
}

let uidCounter = 0
const nextUid = () => `pgp-${(uidCounter += 1)}`

function mediaIdOf(v: RawMedia): number | string | null {
  if (v == null) return null
  if (typeof v === 'object') return v.id ?? null
  return v
}
// Канонический путь раздачи media (Media.afterRead: doc.url = /api/media/file/{id}).
function previewFor(id: number | string | null): string | null {
  return id == null ? null : `/api/media/file/${id}`
}
function captionOf(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/**
 * Кнопка «Редактировать фотографии» (видна редактору при логине) + модалка
 * управления курируемой галереей проекта (`projects.gallery`) прямо со страницы
 * /projects/[slug]/gallery: замена файла, подпись, добавление/удаление.
 *
 * Страница галереи — force-static (revalidate=600), поэтому проп с галереей был
 * бы устаревшим: грузим актуальный массив через GET /api/projects/{id}?depth=0
 * на открытии (связи как id — round-trip без потерь), а после сохранения
 * afterChange-хук Projects (revalidateProject) обновляет статический путь.
 *
 * Image в элементе обязателен (required) — перед сохранением проверяем, что у
 * каждого элемента выбран файл. Массив шлём целиком; id существующих строк
 * сохраняем (спред исходного объекта), новым не передаём — Payload создаст.
 * Фото из постов/событий на странице добавляются автоматически и здесь не
 * правятся.
 */
export const ProjectGalleryEditor: React.FC<{ id: number | string }> = ({ id }) => {
  const { isAdmin } = useAdminMode()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rawItems, setRawItems] = useState<RawGalleryItem[]>([])
  const [items, setItems] = useState<GalleryRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openEditor = async () => {
    setOpen(true)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${id}?depth=0`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Не удалось загрузить проект (${res.status})`)
      const project = (await res.json()) as { gallery?: RawGalleryItem[] }
      const gallery = Array.isArray(project.gallery) ? project.gallery : []
      setRawItems(gallery)
      setItems(
        gallery.map((it, ii) => {
          const mid = mediaIdOf(it?.image)
          return { uid: nextUid(), rawIndex: ii, mediaId: mid, previewUrl: previewFor(mid), caption: captionOf(it?.caption) }
        }),
      )
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setLoading(false)
    }
  }

  const updateItem = (uid: string, patch: Partial<GalleryRow>) => {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)))
  }
  const addItem = () => {
    setItems((prev) => [...prev, { uid: nextUid(), rawIndex: null, mediaId: null, previewUrl: null, caption: '' }])
  }
  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((it) => it.uid !== uid))
  }

  const save = async () => {
    const emptyIdx = items.findIndex((it) => it.mediaId == null)
    if (emptyIdx !== -1) {
      setError(`У изображения ${emptyIdx + 1} не выбран файл — выберите файл или удалите элемент.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const gallery = items.map((it) => {
        // Сохраняем исходный объект строки (включая её id), переопределяя только
        // upload-поле и подпись.
        const base: RawGalleryItem = it.rawIndex != null && rawItems[it.rawIndex] ? { ...rawItems[it.rawIndex] } : {}
        base.image = it.mediaId
        base.caption = it.caption.trim() ? it.caption.trim() : null
        return base
      })

      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery, _status: 'published' }),
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

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Редактировать фотографии
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Фотографии проекта</DialogTitle>
            <DialogDescription>
              Курируемые фотографии проекта: замена файла, подпись, добавление и удаление. Фото из постов и событий
              появляются на странице автоматически и здесь не правятся.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Загружаем…</p>
          ) : (
            <div className="grid gap-3 py-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока пусто — добавьте фотографии.</p>
              ) : (
                items.map((it, idx) => (
                  <div key={it.uid} className="grid gap-1.5 rounded-md border border-border/60 p-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Изображение {idx + 1}</label>
                      <button
                        type="button"
                        onClick={() => removeItem(it.uid)}
                        className="text-xs text-destructive underline-offset-2 hover:underline"
                      >
                        удалить
                      </button>
                    </div>
                    <InlineImage
                      previewUrl={it.previewUrl}
                      alt={it.caption || 'Фото проекта'}
                      allowRemove={false}
                      onChange={(mid, url) => updateItem(it.uid, { mediaId: mid, previewUrl: url })}
                      onError={setError}
                    />
                    <input
                      type="text"
                      value={it.caption}
                      placeholder="Подпись (необязательно)"
                      onChange={(e) => updateItem(it.uid, { caption: e.target.value })}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={addItem}
                className="inline-flex h-9 items-center justify-center gap-1 self-start rounded-md border border-dashed border-input bg-background px-3 text-sm font-medium text-muted-foreground shadow-sm hover:bg-accent"
              >
                + Добавить фотографию
              </button>

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
    </>
  )
}
