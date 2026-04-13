import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import { Breadcrumbs } from '@/components/Breadcrumbs'

type Args = {
  params: Promise<{ slug: string }>
}

const labelBySlug: Record<string, string> = {
  'village-and-temple': 'О селе и храме',
  'sadovaya-feya-gulfiya-kharisovna': 'Садовая фея Гульфия Харисовна',
  'ponyclub-pegashka': 'Пониклуб «Пегашка»',
  'konnyy-klub-gmalyzh': 'Конный клуб г.Малмыж',
  'deer-feeding': 'Покормить оленя',
  'deer-live-stream': 'Видеотрансляция',
}

const getReadableTitle = (slug: string) =>
  labelBySlug[slug] || slug.replaceAll('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const title = getReadableTitle(slug)
  return {
    title: `${title} — скоро`,
    description: 'Раздел находится в разработке.',
  }
}

export default async function ComingSoonPage({ params }: Args) {
  const { slug } = await params
  const title = getReadableTitle(slug)

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { href: '/sections', label: 'Разделы' }, { label: title }]} />
        <div className="rounded-3xl border border-border/80 bg-card/80 p-8 md:p-12">
          <p className="text-sm uppercase tracking-[0.12em] text-muted-foreground">Скоро</p>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Этот раздел уже запланирован. Сейчас идет подготовка материалов и наполнения.
          </p>
          <div className="mt-8">
            <Link
              href="/"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/20"
            >
              Вернуться на главную
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
