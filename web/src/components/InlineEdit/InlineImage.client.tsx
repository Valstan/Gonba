'use client'

import Image from 'next/image'
import React, { useRef, useState } from 'react'

import { MediaPicker } from './MediaPicker.client'

type Props = {
  previewUrl: string | null
  alt?: string
  /** Сообщает родителю новый media id и url превью (или null при удалении). */
  onChange: (mediaId: number | string | null, previewUrl: string | null) => void
  onError?: (message: string) => void
}

/**
 * Картинка с управлением в режиме правки: загрузить/заменить/убрать.
 * Загрузка — POST /api/media (как в EditProjectDialog). Файл уходит на Я.Диск
 * через afterChange-хук Media; превью показываем сразу по возвращённому url.
 */
export const InlineImage: React.FC<Props> = ({ previewUrl, alt, onChange, onError }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('_payload', JSON.stringify({ alt: alt || file.name }))
      const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Не удалось загрузить картинку (${res.status}): ${txt.slice(0, 160)}`)
      }
      const data = await res.json()
      const doc = data?.doc || data
      const id = doc?.id ?? null
      const url = doc?.url ?? null
      if (!id) throw new Error('Не получен id загруженного файла')
      onChange(id, url || previewUrl)
    } catch (e) {
      onError?.(String((e as Error).message || e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-20 w-28 flex-none overflow-hidden rounded-md border bg-muted">
        {previewUrl ? (
          <Image src={previewUrl} alt="Превью" fill sizes="112px" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">нет</div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent disabled:opacity-50"
      >
        {uploading ? 'Загружаем…' : previewUrl ? 'Заменить' : 'Загрузить'}
      </button>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={uploading}
        className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent disabled:opacity-50"
      >
        Из загруженных
      </button>
      {previewUrl ? (
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          убрать
        </button>
      ) : null}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(id, url) => onChange(id, url)}
      />
    </div>
  )
}
