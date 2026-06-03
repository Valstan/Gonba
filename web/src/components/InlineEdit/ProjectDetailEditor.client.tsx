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

export type ProjectGalleryItemData = {
  id: number | string | null
  imageId: number | string | null
  imageUrl: string | null
  caption: string
}

export type ProjectDetailEditorData = {
  id: number | string
  title: string
  summary: string
  description: unknown
  heroImageId: number | string | null
  heroImageUrl: string | null
  contacts: { phone: string; email: string; whatsApp: string }
  location: { address: string; mapUrl: string; coordinates: string }
  gallery: ProjectGalleryItemData[]
}

// Строка галереи в state редактора: image (required) + caption. rawId — id
// существующего элемента массива (для стабильности строки при PATCH); null —
// элемент добавлен в этой сессии.
type GalleryRow = {
  uid: string
  rawId: number | string | null
  mediaId: number | string | null
  previewUrl: string | null
  caption: string
}

// Стабильные React-ключи для добавляемых элементов (без зависимости от индекса).
let galleryUid = 0
const nextGalleryUid = () => `pg-${(galleryUid += 1)}`

/**
 * Кнопка «Редактировать проект» (видна редактору при логине) + модалка правки
 * заголовка / краткого описания / обложки / текста «О проекте» + контактов и
 * локации прямо на странице проекта. Сохранение — PATCH /api/projects/{id} c
 * _status:'published' (drafts), затем router.refresh(). Паттерн — как PostEditor
 * (#71/#74). Группы contacts/location отправляем целиком (все подполя), только
 * если что-то в группе менялось — Payload пишет группу как набор колонок, а
 * частичный объект группы перетёр бы непереданные подполя. Галерея (массив
 * image+caption) правится здесь же: замена файла, подпись, add/remove. Image
 * обязателен (required) — перед сохранением проверяем, что у каждого элемента
 * выбран файл. Массив шлём целиком, только если он менялся; id существующих
 * строк сохраняем для стабильности.
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
  const [phone, setPhone] = useState(project.contacts.phone)
  const [email, setEmail] = useState(project.contacts.email)
  const [whatsApp, setWhatsApp] = useState(project.contacts.whatsApp)
  const [address, setAddress] = useState(project.location.address)
  const [mapUrl, setMapUrl] = useState(project.location.mapUrl)
  const [coordinates, setCoordinates] = useState(project.location.coordinates)
  const [gallery, setGallery] = useState<GalleryRow[]>([])
  const [galleryDirty, setGalleryDirty] = useState(false)
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
    setPhone(project.contacts.phone)
    setEmail(project.contacts.email)
    setWhatsApp(project.contacts.whatsApp)
    setAddress(project.location.address)
    setMapUrl(project.location.mapUrl)
    setCoordinates(project.location.coordinates)
    setGallery(
      project.gallery.map((it) => ({
        uid: nextGalleryUid(),
        rawId: it.id,
        mediaId: it.imageId,
        previewUrl: it.imageUrl ?? (it.imageId != null ? `/api/media/file/${it.imageId}` : null),
        caption: it.caption || '',
      })),
    )
    setGalleryDirty(false)
    setError(null)
    setOpen(true)
  }

  const updateGalleryItem = (uid: string, patch: Partial<GalleryRow>) => {
    setGallery((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)))
    setGalleryDirty(true)
  }
  const addGalleryItem = () => {
    setGallery((prev) => [...prev, { uid: nextGalleryUid(), rawId: null, mediaId: null, previewUrl: null, caption: '' }])
    setGalleryDirty(true)
  }
  const removeGalleryItem = (uid: string) => {
    setGallery((prev) => prev.filter((it) => it.uid !== uid))
    setGalleryDirty(true)
  }

  const save = async () => {
    // Валидация required-upload галереи до начала сохранения.
    if (galleryDirty) {
      const emptyIdx = gallery.findIndex((it) => it.mediaId == null)
      if (emptyIdx !== -1) {
        setError(`Галерея: у изображения ${emptyIdx + 1} не выбран файл — выберите файл или удалите элемент.`)
        return
      }
    }
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

      // Контакты/локацию шлём целиком и только при изменении группы (см. docstring).
      const contactsChanged =
        phone.trim() !== project.contacts.phone ||
        email.trim() !== project.contacts.email ||
        whatsApp.trim() !== project.contacts.whatsApp
      if (contactsChanged) {
        body.contacts = {
          phone: phone.trim() || null,
          email: email.trim() || null,
          whatsApp: whatsApp.trim() || null,
        }
      }
      const locationChanged =
        address.trim() !== project.location.address ||
        mapUrl.trim() !== project.location.mapUrl ||
        coordinates.trim() !== project.location.coordinates
      if (locationChanged) {
        body.location = {
          address: address.trim() || null,
          mapUrl: mapUrl.trim() || null,
          coordinates: coordinates.trim() || null,
        }
      }

      // Галерея — массив целиком (Payload заменяет весь массив), только если менялась.
      // id существующих строк сохраняем, новым не передаём — Payload создаст их.
      if (galleryDirty) {
        body.gallery = gallery.map((it) => ({
          ...(it.rawId != null ? { id: it.rawId } : {}),
          image: it.mediaId,
          caption: it.caption.trim() ? it.caption.trim() : null,
        }))
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
            <DialogDescription>Заголовок, описание, обложка, текст «О проекте», контакты, адрес и мини-галерея. Сохранится сразу.</DialogDescription>
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

            <div className="grid gap-3 border-t pt-4">
              <p className="text-sm font-medium">Контакты</p>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Телефон</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">WhatsApp</label>
                <input
                  type="text"
                  value={whatsApp}
                  onChange={(e) => setWhatsApp(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="grid gap-3 border-t pt-4">
              <p className="text-sm font-medium">Адрес и карта</p>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Адрес</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Ссылка на карту</label>
                <input
                  type="text"
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs text-muted-foreground">Координаты (широта,долгота)</label>
                <input
                  type="text"
                  value={coordinates}
                  placeholder="56.5240, 50.6830"
                  onChange={(e) => setCoordinates(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="grid gap-3 border-t pt-4">
              <p className="text-sm font-medium">Мини-галерея</p>
              {gallery.length === 0 ? (
                <p className="text-xs text-muted-foreground">Пока пусто — добавьте изображения.</p>
              ) : (
                gallery.map((it, idx) => (
                  <div key={it.uid} className="grid gap-1.5 rounded-md border border-border/60 p-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Изображение {idx + 1}</label>
                      <button
                        type="button"
                        onClick={() => removeGalleryItem(it.uid)}
                        className="text-xs text-destructive underline-offset-2 hover:underline"
                      >
                        удалить
                      </button>
                    </div>
                    <InlineImage
                      previewUrl={it.previewUrl}
                      alt={it.caption || title}
                      allowRemove={false}
                      onChange={(mid, url) => updateGalleryItem(it.uid, { mediaId: mid, previewUrl: url })}
                      onError={setError}
                    />
                    <input
                      type="text"
                      value={it.caption}
                      placeholder="Подпись (необязательно)"
                      onChange={(e) => updateGalleryItem(it.uid, { caption: e.target.value })}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={addGalleryItem}
                className="inline-flex h-9 items-center justify-center gap-1 self-start rounded-md border border-dashed border-input bg-background px-3 text-sm font-medium text-muted-foreground shadow-sm hover:bg-accent"
              >
                + Добавить изображение
              </button>
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
