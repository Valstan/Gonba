'use client'

import React, { useState } from 'react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { YandexGalleryItem } from '@/server/integrations/yandex-disk-gallery'

type Props = {
  items: YandexGalleryItem[]
}

export const YandexGallerySection: React.FC<Props> = ({ items }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const open = openIndex !== null

  const handleKey = (e: React.KeyboardEvent) => {
    if (openIndex === null) return
    if (e.key === 'ArrowRight') setOpenIndex((i) => (i === null ? null : Math.min(items.length - 1, i + 1)))
    if (e.key === 'ArrowLeft') setOpenIndex((i) => (i === null ? null : Math.max(0, i - 1)))
  }

  if (items.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">Свежее с Яндекс.Диска</h2>
      <p className="mt-1 text-sm text-muted-foreground">Папка с фотографиями подгружается напрямую — новые снимки появятся сразу.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <button
            key={item.resourceId || item.path || index}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group block aspect-square overflow-hidden rounded-xl border border-border bg-card"
          >
            {item.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.preview}
                alt={item.name}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {item.name}
              </div>
            )}
          </button>
        ))}
      </div>
      <Dialog open={open} onOpenChange={(v) => setOpenIndex(v ? openIndex : null)}>
        <DialogContent
          className="max-w-3xl border-none bg-transparent p-0 shadow-none"
          onKeyDown={handleKey}
        >
          <DialogTitle className="sr-only">Просмотр фото</DialogTitle>
          {openIndex !== null && items[openIndex]?.preview ? (
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={items[openIndex].preview}
                alt={items[openIndex].name}
                className="max-h-[80vh] max-w-full rounded-2xl object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}
