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

export type FooterLink = { label: string; href: string }
export type FooterColumn = { heading: string; items: FooterLink[] }

type Props = {
  description: string
  columns: FooterColumn[]
  legalAddress: string
}

/**
 * Inline-редактор подвала (виден редактору при логине). Правит описание под
 * логотипом, колонки ссылок (заголовок + пункты) и адрес в копирайте. Сохраняет
 * в глобал `footer` через POST /api/globals/footer; кэш сбрасывает хук
 * revalidateFooter (afterChange глобала). Паттерн — как у NavEditor (#75).
 */
export const FooterEditor: React.FC<Props> = ({ description, columns, legalAddress }) => {
  const { isAdmin } = useAdminMode()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState(description)
  const [legal, setLegal] = useState(legalAddress)
  const [cols, setCols] = useState<FooterColumn[]>(columns)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openEditor = () => {
    setDesc(description)
    setLegal(legalAddress)
    setCols(columns.length ? columns : [{ heading: '', items: [{ label: '', href: '' }] }])
    setError(null)
    setOpen(true)
  }

  // --- column ops ---
  const setColHeading = (ci: number, heading: string) =>
    setCols((c) => c.map((col, i) => (i === ci ? { ...col, heading } : col)))
  const addColumn = () => setCols((c) => [...c, { heading: '', items: [{ label: '', href: '' }] }])
  const removeColumn = (ci: number) => setCols((c) => c.filter((_, i) => i !== ci))

  // --- item ops within a column ---
  const setItem = (ci: number, ii: number, patch: Partial<FooterLink>) =>
    setCols((c) =>
      c.map((col, i) =>
        i === ci ? { ...col, items: col.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : col,
      ),
    )
  const addItem = (ci: number) =>
    setCols((c) => c.map((col, i) => (i === ci ? { ...col, items: [...col.items, { label: '', href: '' }] } : col)))
  const removeItem = (ci: number, ii: number) =>
    setCols((c) => c.map((col, i) => (i === ci ? { ...col, items: col.items.filter((_, j) => j !== ii) } : col)))
  const moveItem = (ci: number, ii: number, dir: -1 | 1) =>
    setCols((c) =>
      c.map((col, i) => {
        if (i !== ci) return col
        const j = ii + dir
        if (j < 0 || j >= col.items.length) return col
        const items = [...col.items]
        ;[items[ii], items[j]] = [items[j], items[ii]]
        return { ...col, items }
      }),
    )

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        description: desc.trim(),
        legalAddress: legal.trim(),
        columns: cols
          .map((col) => ({
            heading: col.heading.trim(),
            items: col.items
              .filter((it) => it.label.trim() && it.href.trim())
              .map((it) => ({ label: it.label.trim(), href: it.href.trim() })),
          }))
          .filter((col) => col.heading || col.items.length > 0),
      }
      const res = await fetch('/api/globals/footer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        onClick={openEditor}
        title="Редактировать подвал"
        className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Редактировать подвал
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактирование подвала</DialogTitle>
            <DialogDescription>Описание, колонки ссылок и адрес. Сохранится сразу.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Описание под логотипом</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {cols.map((col, ci) => (
              <div key={ci} className="grid gap-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={col.heading}
                    onChange={(e) => setColHeading(ci, e.target.value)}
                    placeholder="Заголовок колонки"
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm font-medium"
                  />
                  <button type="button" onClick={() => removeColumn(ci)} className="px-2 text-sm text-destructive" title="Удалить колонку">
                    Удалить колонку
                  </button>
                </div>
                {col.items.map((it, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={it.label}
                      onChange={(e) => setItem(ci, ii, { label: e.target.value })}
                      placeholder="Текст"
                      className="h-9 w-1/3 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <input
                      type="text"
                      value={it.href}
                      onChange={(e) => setItem(ci, ii, { href: e.target.value })}
                      placeholder="/ссылка, tel:…, mailto:…"
                      className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <button type="button" onClick={() => moveItem(ci, ii, -1)} className="px-1 text-muted-foreground hover:text-foreground" title="Вверх">↑</button>
                    <button type="button" onClick={() => moveItem(ci, ii, 1)} className="px-1 text-muted-foreground hover:text-foreground" title="Вниз">↓</button>
                    <button type="button" onClick={() => removeItem(ci, ii)} className="px-1 text-destructive" title="Удалить">✕</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addItem(ci)}
                  className="mt-1 inline-flex h-8 w-fit items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent"
                >
                  + Ссылка
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addColumn}
              className="inline-flex h-9 w-fit items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              + Колонка
            </button>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Адрес в строке копирайта</label>
              <input
                type="text"
                value={legal}
                onChange={(e) => setLegal(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {error ? (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
            ) : null}
          </div>

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
              disabled={saving}
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
