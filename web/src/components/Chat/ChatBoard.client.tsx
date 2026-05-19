'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { MessageBubble } from './MessageBubble'

export type ChatMessage = {
  id: number
  authorName: string
  body: string
  createdAt: string
}

type Props = {
  projectSlug: string
  initialMessages: ChatMessage[]
  placeholder?: string
}

const POLL_INTERVAL_MS = 12_000
const STORAGE_NAME_KEY = 'gonba.chat.name'
const STORAGE_OWN_IDS_KEY_PREFIX = 'gonba.chat.own.'

export const ChatBoard: React.FC<Props> = ({ projectSlug, initialMessages, placeholder = 'Напишите сообщение...' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages)
  const [name, setName] = useState('')
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'error' | 'rateLimited'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState(0)
  const [ownIds, setOwnIds] = useState<Set<number>>(new Set())
  const [newIds, setNewIds] = useState<Set<number>>(new Set())
  const listRef = useRef<HTMLDivElement | null>(null)
  const stuckAtBottomRef = useRef(true)

  const lastTimestamp = useMemo(() => {
    return messages.length > 0 ? messages[messages.length - 1].createdAt : null
  }, [messages])

  // Восстановить имя и список «своих» id из localStorage.
  useEffect(() => {
    try {
      const storedName = window.localStorage.getItem(STORAGE_NAME_KEY)
      if (storedName) setName(storedName)
      const storedIds = window.localStorage.getItem(STORAGE_OWN_IDS_KEY_PREFIX + projectSlug)
      if (storedIds) {
        try {
          const parsed = JSON.parse(storedIds) as number[]
          if (Array.isArray(parsed)) setOwnIds(new Set(parsed))
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* localStorage may be blocked */
    }
  }, [projectSlug])

  // Запоминаем имя.
  useEffect(() => {
    if (!name) return
    try {
      window.localStorage.setItem(STORAGE_NAME_KEY, name)
    } catch {
      /* ignore */
    }
  }, [name])

  // Polling новых сообщений.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      if (cancelled) return
      if (document.visibilityState !== 'visible') {
        timer = setTimeout(tick, POLL_INTERVAL_MS)
        return
      }
      try {
        const url = new URL(`/api/projects/${encodeURIComponent(projectSlug)}/chat`, window.location.origin)
        if (lastTimestamp) url.searchParams.set('since', lastTimestamp)
        const res = await fetch(url.toString(), { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as { messages?: ChatMessage[] }
          if (data.messages && data.messages.length > 0 && !cancelled) {
            setMessages((prev) => {
              const seen = new Set(prev.map((m) => m.id))
              const merged = [...prev]
              const arrivedIds = new Set<number>()
              for (const msg of data.messages!) {
                if (!seen.has(msg.id)) {
                  merged.push(msg)
                  arrivedIds.add(msg.id)
                }
              }
              if (arrivedIds.size > 0) {
                setNewIds((curr) => {
                  const next = new Set(curr)
                  for (const id of arrivedIds) next.add(id)
                  return next
                })
                // Снимаем подсветку через 3 сек.
                setTimeout(() => {
                  setNewIds((curr) => {
                    const next = new Set(curr)
                    for (const id of arrivedIds) next.delete(id)
                    return next
                  })
                }, 3000)
              }
              return merged
            })
          }
        }
      } catch {
        /* network error — ignore, retry next tick */
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer)
        timer = setTimeout(tick, 500)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [projectSlug, lastTimestamp])

  // Auto-scroll вниз, если пользователь не прокручен вверх.
  useEffect(() => {
    if (!listRef.current) return
    if (stuckAtBottomRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  const onScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stuckAtBottomRef.current = distanceFromBottom < 80
  }, [])

  // Rate-limit countdown.
  useEffect(() => {
    if (status !== 'rateLimited' || retryAfter <= 0) return
    const timer = setTimeout(() => setRetryAfter((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [status, retryAfter])
  useEffect(() => {
    if (status === 'rateLimited' && retryAfter <= 0) {
      setStatus('idle')
      setError(null)
    }
  }, [status, retryAfter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !draft.trim()) return
    setStatus('sending')
    setError(null)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: name.trim(), body: draft.trim() }),
      })
      if (res.status === 429) {
        const retry = Number(res.headers.get('Retry-After') || '30')
        setStatus('rateLimited')
        setRetryAfter(Number.isFinite(retry) ? retry : 30)
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error || `Подождите ${retry} сек`)
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setStatus('error')
        setError(data.error || `HTTP ${res.status}`)
        return
      }
      const created = (await res.json()) as { id: number; createdAt: string }
      // Оптимистично добавляем сообщение в список.
      const optimistic: ChatMessage = {
        id: created.id,
        authorName: name.trim(),
        body: draft.trim(),
        createdAt: created.createdAt,
      }
      setMessages((prev) => (prev.some((m) => m.id === optimistic.id) ? prev : [...prev, optimistic]))
      setOwnIds((curr) => {
        const next = new Set(curr)
        next.add(created.id)
        try {
          window.localStorage.setItem(STORAGE_OWN_IDS_KEY_PREFIX + projectSlug, JSON.stringify([...next]))
        } catch {
          /* ignore */
        }
        return next
      })
      setDraft('')
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Не удалось отправить')
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const disabled = status === 'sending' || status === 'rateLimited'

  return (
    <div className="flex h-[70vh] max-h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-card/60 shadow-sm">
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 space-y-3 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Пока тихо. Будьте первым 👋</p>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              authorName={msg.authorName}
              body={msg.body}
              createdAt={msg.createdAt}
              isNew={newIds.has(msg.id)}
              isOwn={ownIds.has(msg.id)}
            />
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-border bg-background/60 p-3">
        <div className="mb-2">
          <Label htmlFor="chat-name" className="text-xs">Имя</Label>
          <Input
            id="chat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="Как вас называть?"
            className="h-10"
          />
        </div>
        <Label htmlFor="chat-body" className="sr-only">Сообщение</Label>
        <Textarea
          id="chat-body"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={2000}
          placeholder={placeholder}
          disabled={disabled}
        />
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {status === 'rateLimited' ? `Подождите ${retryAfter} сек` : 'Enter — отправить, Shift+Enter — перенос'}
          </p>
          <Button type="submit" disabled={disabled || !name.trim() || !draft.trim()} size="sm">
            {status === 'sending' ? 'Отправляю...' : 'Отправить'}
          </Button>
        </div>
      </form>
    </div>
  )
}
