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

export type ProjectDetailEditorData = {
  id: number | string
  title: string
  summary: string
  description: unknown
  heroImageId: number | string | null
  heroImageUrl: string | null
}

/**
 * Кнопка «Редактировать проект» (видна редактору при логине) + модалка правки
 * заголовка / краткого описания / обложки / текста «О проекте» прямо на странице
 * проекта. Сохранение — PATCH /api/projects/{id} c _status:'published' (drafts),
 * затем router.refresh(). Паттерн — как PostEditor (#71/#74).
 */
export const ProjectDetailEditor: React.FC<{ project: ProjectDetailEditorData }> = ({ project }) => {
  const { isAdmin } = useAdminMode()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(project.title)
  const [summary, setSummary] = useState(project.summary)
  const [heroId, setHeroId] = useState<number | string | null>(project.heroImageId)
  const [heroUrl, setHeroUrl] = useState<string | null>(project.heroImageUrl)
  const [bodyHtml, setBodyHtml] = useState('')
  const [bodyDirty, setBodyDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bodyUnsupported = hasUnsupportedNodes(project.description)

  const openEditor = () => {
    setTitle(project.title)
    setSummary(project.summary)
    setHeroId(project.heroImageId)
    setHeroUrl(project.heroImageUrl)
    setBodyHtml(lexicalToHtml(project.description))
    setBodyDirty(false)
    setError(null)
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        title: title.trim() || project.title,
        summary: summary.trim(),
        _status: 'published',
      }
      if (heroId !== project.heroImageId) body.heroImage = heroId
      if (bodyDirty && !bodyUnsupported) body.description = htmlToLexical(bodyHtml)

      const res = await fetch(`/api/projects/${project.id}`, {
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
        Редактировать проект
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактирование проекта</DialogTitle>
            <DialogDescription>Заголовок, краткое описание, обложка и текст «О проекте». Сохранится сразу.</DialogDescription>
          </DialogHeader>

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

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Краткое описание</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Обложка</label>
              <InlineImage
                previewUrl={heroUrl}
                alt={title}
                onChange={(id, url) => {
                  setHeroId(id)
                  setHeroUrl(url)
                }}
                onError={setError}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Текст «О проекте»</label>
              {bodyUnsupported ? (
                <p className="rounded-md border border-amber-400/50 bg-amber-50 p-2 text-sm text-amber-800">
                  Этот текст содержит сложные блоки — правьте в админке, чтобы не потерять. Заголовок,
                  описание и обложку можно менять здесь.
                </p>
              ) : (
                <LiteRichTextEditor
                  initialHtml={bodyHtml}
                  onChange={(html) => {
                    setBodyHtml(html)
                    setBodyDirty(true)
                  }}
                />
              )}
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
    </>
  )
}
