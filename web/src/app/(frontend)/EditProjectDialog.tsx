'use client'

import Image from 'next/image'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import type { ProjectRecord } from './projects/shared'
import { Plate } from './projects/PlateCard'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type EditableFields = {
  shortLabel: string
  summary: string
  accentColor: string
  homeLink: string
  logo: number | string | null // media id
  logoPreviewUrl: string | null
}

type Props = {
  open: boolean
  project: ProjectRecord | null
  onClose: () => void
  onSaved: (updates: Partial<ProjectRecord>) => void
}

function imageUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const doc = media as { url?: string | null }
  if (!doc.url) return null
  const url = doc.url
  if (url.startsWith('http') || url.startsWith('//') || url.startsWith('/')) return url
  return `/media/${url}`
}

function getMediaId(media: unknown): number | string | null {
  if (!media) return null
  if (typeof media === 'number' || typeof media === 'string') return media
  if (typeof media === 'object' && 'id' in (media as object)) {
    const id = (media as { id: number | string }).id
    return id ?? null
  }
  return null
}

export const EditProjectDialog: React.FC<Props> = ({ open, project, onClose, onSaved }) => {
  const [fields, setFields] = useState<EditableFields>({
    shortLabel: '',
    summary: '',
    accentColor: '',
    homeLink: '',
    logo: null,
    logoPreviewUrl: null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Сбрасываем форму при открытии диалога с новым проектом
  useEffect(() => {
    if (project) {
      setFields({
        shortLabel: project.shortLabel || '',
        summary: project.summary || '',
        accentColor: project.accentColor || '',
        homeLink: project.homeLink || '',
        logo: getMediaId(project.logo),
        logoPreviewUrl: imageUrl(project.logo) || imageUrl(project.heroImage),
      })
      setError(null)
    }
  }, [project])

  // Live preview: merge базового project с локально редактируемыми полями.
  // useMemo чтобы Plate не пересчитывался без необходимости.
  // Должен идти ДО early-return, чтобы порядок хуков был стабильным между рендерами.
  const previewProject = useMemo<ProjectRecord | null>(() => {
    if (!project) return null
    return {
      ...project,
      shortLabel: fields.shortLabel.trim() || project.shortLabel,
      summary: fields.summary,
      accentColor: fields.accentColor.trim() || project.accentColor,
      homeLink: fields.homeLink.trim() || project.homeLink,
      // подсовываем URL превью как доку медиа — Plate.pickImage достаёт .url
      logo: fields.logoPreviewUrl
        ? ({ url: fields.logoPreviewUrl } as unknown as ProjectRecord['logo'])
        : null,
    }
  }, [project, fields])

  if (!project || !previewProject) return null

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('_payload', JSON.stringify({ alt: project.title || file.name }))
      const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Не удалось загрузить картинку (${res.status}): ${txt.slice(0, 200)}`)
      }
      const data = await res.json()
      const doc = data?.doc || data
      const id = doc?.id ?? null
      const url = doc?.url ?? null
      if (!id) throw new Error('Не получен id загруженного файла')
      setFields((f) => ({ ...f, logo: id, logoPreviewUrl: url || f.logoPreviewUrl }))
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        shortLabel: fields.shortLabel.trim() || project.shortLabel,
        summary: fields.summary,
        accentColor: fields.accentColor.trim() || null,
        homeLink: fields.homeLink.trim() || null,
      }
      if (fields.logo !== getMediaId(project.logo)) {
        body.logo = fields.logo
      }
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
      onSaved({
        shortLabel: body.shortLabel as string,
        summary: body.summary as string,
        accentColor: (body.accentColor as string) || null,
        homeLink: (body.homeLink as string) || null,
        ...(body.logo !== undefined
          ? { logo: { id: fields.logo, url: fields.logoPreviewUrl } as unknown as ProjectRecord['logo'] }
          : {}),
      })
      onClose()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Редактирование плашки</DialogTitle>
          <DialogDescription>
            Эти данные показываются на странице «Проекты». Превью обновляется в реальном времени по мере правок.
          </DialogDescription>
        </DialogHeader>

        {/* Live preview — тот же компонент, что и на /projects */}
        <div className="my-1 overflow-hidden rounded-2xl shadow-md ring-1 ring-black/10">
          <div className="min-h-[160px]">
            <Plate project={previewProject} size="normal" />
          </div>
        </div>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Название</label>
            <input
              type="text"
              value={fields.shortLabel}
              onChange={(e) => setFields((f) => ({ ...f, shortLabel: e.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Короткое название плашки"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Описание</label>
            <textarea
              value={fields.summary}
              onChange={(e) => setFields((f) => ({ ...f, summary: e.target.value }))}
              className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Короткое описание (2–3 строки)"
              rows={3}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Картинка</label>
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 flex-none overflow-hidden rounded-md border bg-muted">
                {fields.logoPreviewUrl ? (
                  <Image
                    src={fields.logoPreviewUrl}
                    alt="Превью"
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    —
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUpload(f)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {uploading ? 'Загружаем…' : 'Загрузить картинку'}
              </button>
              {fields.logo ? (
                <button
                  type="button"
                  onClick={() => setFields((f) => ({ ...f, logo: null, logoPreviewUrl: null }))}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  убрать
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Цвет (HEX)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(fields.accentColor || '#2d7a4f').slice(0, 7)}
                  onChange={(e) => setFields((f) => ({ ...f, accentColor: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border bg-background"
                />
                <input
                  type="text"
                  value={fields.accentColor}
                  onChange={(e) => setFields((f) => ({ ...f, accentColor: e.target.value }))}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="#2d7a4f"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Ссылка</label>
              <input
                type="text"
                value={fields.homeLink}
                onChange={(e) => setFields((f) => ({ ...f, homeLink: e.target.value }))}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={`/projects/${project.slug}`}
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
