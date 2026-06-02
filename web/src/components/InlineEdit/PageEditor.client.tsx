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
import { LiteRichTextEditor } from './LiteRichTextEditor.client'
import { hasUnsupportedNodes, htmlToLexical, lexicalToHtml } from './lexical-lite'

type RawColumn = { richText?: unknown; [k: string]: unknown }
type RawBlock = { blockType?: string; columns?: RawColumn[]; [k: string]: unknown }
type RawPage = { id: number | string; title?: string; layout?: RawBlock[] }

type EditField = { blockIndex: number; colIndex: number; html: string; unsupported: boolean }

/**
 * Кнопка «Редактировать страницу» (видна редактору при логине) + модалка правки
 * заголовка и текста Content-блоков прямо на странице.
 *
 * Безопасность round-trip: layout берём через GET /api/pages/{id}?depth=0
 * (связи/медиа как id — ничего не теряется при обратном PATCH). Меняем только
 * richText текстовых колонок. Картинки/сложные блоки — пока в админке.
 */
export const PageEditor: React.FC<{ id: number | string; title: string }> = ({ id, title: initialTitle }) => {
  const { isAdmin } = useAdminMode()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [raw, setRaw] = useState<RawPage | null>(null)
  const [fields, setFields] = useState<EditField[]>([])
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
      for (const f of fields) {
        if (f.unsupported) continue
        const col = layout[f.blockIndex]?.columns?.[f.colIndex]
        if (col) col.richText = htmlToLexical(f.html)
      }
      const res = await fetch(`/api/pages/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || initialTitle, layout, _status: 'published' }),
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
            <DialogDescription>Заголовок и текстовые блоки. Картинки и сложные блоки — в админке.</DialogDescription>
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

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  На этой странице нет простых текстовых блоков для правки здесь. Сложные блоки правьте в админке.
                </p>
              ) : (
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
