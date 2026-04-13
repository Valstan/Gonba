import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { Media } from '@/components/Media'
import { getDeerGalleryVisuals } from '../sections/visuals'
import { Breadcrumbs } from '@/components/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Олени — Жемчужина Вятки',
  description: 'Фотогалерея оленей, а также переход к кормлению и видеотрансляции.',
}

export default async function DeerPage() {
  const gallery = await getDeerGalleryVisuals()

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Олени' }]} />
        <div className="rounded-3xl border border-border/80 bg-card/80 p-6 md:p-10">
          <h1 className="text-3xl font-semibold md:text-4xl">Олени</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Раздел посвящен оленьей ферме. Здесь собраны фото оленей и основные действия для посетителей.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/coming-soon/deer-feeding"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/20"
            >
              Покормить оленя
            </Link>
            <Link
              href="/coming-soon/deer-live-stream"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/20"
            >
              Видеотрансляция
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gallery.map((image) => (
            <article key={image.id} className="overflow-hidden rounded-2xl border border-border bg-card/80">
              <div className="aspect-[4/3]">
                <Media resource={image} imgClassName="h-full w-full object-cover" />
              </div>
              <div className="p-3 text-sm text-muted-foreground">{image.alt || 'Олени Жемчужины Вятки'}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
