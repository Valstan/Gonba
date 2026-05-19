import Link from 'next/link'
import React from 'react'

import { Media } from '@/components/Media'
import type { FeedEntry } from './types'

const POST_TYPE_LABEL: Record<string, string> = {
  news: 'Новость',
  blog: 'История',
  announcement: 'Анонс',
  story: 'Рассказ',
}

const formatDate = (value: string | Date | null | undefined, withTime = false) => {
  if (!value) return null
  try {
    const d = new Date(value)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    })
  } catch {
    return null
  }
}

type Props = {
  entry: FeedEntry
  projectSlug: string
}

export const FeedItem: React.FC<Props> = ({ entry, projectSlug }) => {
  if (entry.kind === 'event') {
    const ev = entry.item
    const date = ev.startDate ? new Date(ev.startDate) : null
    const dd = date ? String(date.getDate()).padStart(2, '0') : null
    const mm = date ? date.toLocaleString('ru-RU', { month: 'short' }).replace('.', '') : null
    const time = date ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null
    return (
      <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm transition-shadow hover:shadow-md">
        {ev.heroImage ? (
          <div className="aspect-[16/9] overflow-hidden">
            <Media
              resource={ev.heroImage}
              className="h-full w-full"
              imgClassName="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
          </div>
        ) : null}
        <div className="relative flex flex-1 flex-col gap-3 p-4">
          {dd && mm ? (
            <div
              className="absolute left-4 top-0 -translate-y-1/2 rounded-xl border bg-card px-3 py-1.5 text-center shadow-sm"
              style={{ borderColor: 'var(--project-accent)' }}
            >
              <div className="text-base font-bold leading-none text-[var(--project-accent)]">{dd}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{mm}</div>
            </div>
          ) : null}
          <div className={`flex items-center gap-2 text-xs ${dd ? 'pl-16' : ''}`}>
            <span className="rounded-full bg-[color:var(--project-accent-soft,transparent)] px-2 py-0.5 font-medium text-[var(--project-accent)]">
              Событие
            </span>
            {entry.isUpcoming ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">скоро</span>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">прошло</span>
            )}
            {time ? <span className="text-muted-foreground">в {time}</span> : null}
          </div>
          <h3 className="text-lg font-semibold leading-tight">
            <Link href={ev.slug ? `/events/${ev.slug}` : `/projects/${projectSlug}/feed`} className="hover:text-[var(--project-accent)]">
              {ev.title}
            </Link>
          </h3>
          {ev.summary ? <p className="line-clamp-3 text-sm text-muted-foreground">{ev.summary}</p> : null}
          {ev.location ? <p className="text-xs text-muted-foreground">📍 {ev.location}</p> : null}
        </div>
      </article>
    )
  }

  const post = entry.item
  const dateLabel = formatDate(post.publishedAt)
  const typeLabel = post.postType ? POST_TYPE_LABEL[post.postType] || 'Запись' : 'Запись'
  const excerpt = post.meta?.description || null

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm transition-shadow hover:shadow-md">
      {post.heroImage ? (
        <div className="aspect-[16/9] overflow-hidden">
          <Media
            resource={post.heroImage}
            className="h-full w-full"
            imgClassName="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-[color:var(--project-accent-soft,transparent)] px-2 py-0.5 font-medium text-[var(--project-accent)]">
            {typeLabel}
          </span>
          {dateLabel ? <span className="text-muted-foreground">{dateLabel}</span> : null}
        </div>
        <h3 className="text-lg font-semibold leading-tight">
          <Link href={post.slug ? `/posts/${post.slug}` : `/projects/${projectSlug}/feed`} className="hover:text-[var(--project-accent)]">
            {post.title}
          </Link>
        </h3>
        {excerpt ? <p className="line-clamp-3 text-sm text-muted-foreground">{excerpt}</p> : null}
      </div>
    </article>
  )
}
