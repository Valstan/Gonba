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

export type NavItem = { label: string; href: string }

/**
 * Inline-редактор пунктов главного меню (видим редактору при логине).
 * Сохраняет в глобал `header` через POST /api/globals/header как массив custom-ссылок.
 * Кэш шапки сбрасывает хук revalidateHeader (afterChange глобала).
 */
export const NavEditor: React.FC<{ items: NavItem[] }> = ({ items }) => {
  const { isAdmin } = useAdminMode()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<NavItem[]>(items)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openEditor = () => {
    setRows(items.length ? items : [{ label: '', href: '' }])
    setError(null)
    setOpen(true)
  }

  const update = (i: number, patch: Partial<NavItem>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i))
  const add = () => setRows((r) => [...r, { label: '', href: '' }])
  const move = (i: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = i + dir
      if (j < 0 || j >= r.length) return r
      const copy = [...r]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const navItems = rows
        .filter((r) => r.label.trim() && r.href.trim())
        .map((r) => ({
          link: { type: 'custom', url: r.href.trim(), label: r.label.trim(), newTab: false },
        }))
      const res = await fetch('/api/globals/header', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navItems }),
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
      <button type="button" onClick={openEditor} className="ethno-auth-btn" title="Редактировать меню">
        ✎ Меню
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Пункты меню</DialogTitle>
            <DialogDescription>Название и ссылка каждого пункта шапки. Сохранится сразу.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Название"
                  className="h-9 w-1/3 rounded-md border border-input bg-background px-2 text-sm"
                />
                <input
                  type="text"
                  value={row.href}
                  onChange={(e) => update(i, { href: e.target.value })}
                  placeholder="/ссылка"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                />
                <button type="button" onClick={() => move(i, -1)} className="px-1 text-muted-foreground hover:text-foreground" title="Вверх">↑</button>
                <button type="button" onClick={() => move(i, 1)} className="px-1 text-muted-foreground hover:text-foreground" title="Вниз">↓</button>
                <button type="button" onClick={() => remove(i)} className="px-1 text-destructive" title="Удалить">✕</button>
              </div>
            ))}
            <button
              type="button"
              onClick={add}
              className="mt-1 inline-flex h-9 w-fit items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              + Пункт
            </button>

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
    </>
  )
}
