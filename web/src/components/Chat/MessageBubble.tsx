import React from 'react'

import { cn } from '@/utilities/ui'

type Props = {
  authorName: string
  body: string
  createdAt: string | Date
  isNew?: boolean
  isOwn?: boolean
}

const formatTime = (value: string | Date) => {
  try {
    const d = new Date(value)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export const MessageBubble: React.FC<Props> = ({ authorName, body, createdAt, isNew, isOwn }) => {
  return (
    <div
      data-new={isNew ? 'true' : undefined}
      className={cn(
        'flex flex-col gap-1 rounded-2xl border border-border bg-card/85 px-3 py-2 shadow-sm',
        isOwn ? 'ml-8 border-[var(--project-accent)]' : 'mr-8',
        isNew ? 'animate-fade-in' : '',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--project-accent)]">{authorName}</span>
        <time className="text-[10px] tabular-nums text-muted-foreground">{formatTime(createdAt)}</time>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{body}</p>
    </div>
  )
}
