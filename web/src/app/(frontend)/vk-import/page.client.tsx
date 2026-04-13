'use client'

import React, { useCallback, useState } from 'react'

import { Media } from '@/components/Media'

type QueueHeroImage = {
  id?: number
}

type QueueSectionChoice = {
  slug: string
  title: string
}

type QueueEntry = {
  id: string | number
  title: string
  text?: string
  previewText?: string
  sourceUrl?: string
  sourcePostId?: number
  sourceGroupId?: number
  heroImage?: QueueHeroImage | number | string | null
  queuedAt?: string
  suggestedSections?: Array<string | { slug: string }>
}

type Props = {
  initialItems: QueueEntry[]
  sectionChoices: QueueSectionChoice[]
}

const normalizeHeroImage = (heroImage: QueueEntry['heroImage']): string | number | null => {
  if (!heroImage) return null
  if (typeof heroImage === 'number' || typeof heroImage === 'string') {
    return heroImage
  }
  if (typeof heroImage === 'object' && !Array.isArray(heroImage)) {
    return heroImage.id ? heroImage.id : null
  }
  return null
}

const normalizeSections = (sections?: Array<string | { slug: string }>) =>
  (sections || [])
    .map((section) => (typeof section === 'string' ? section : section?.slug))
    .filter((section): section is string => Boolean(section))

export const VkImportQueueClient: React.FC<Props> = (props) => {
  const { initialItems, sectionChoices } = props
  const [items, setItems] = useState<QueueEntry[]>(initialItems)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const doRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
      ...options,
    })
    const payload = (await response.json().catch(() => ({}))) as { error?: string }

    if (!response.ok) {
      throw new Error(payload.error || 'Ошибка выполнения запроса')
    }
    return payload
  }, [])

  const removeFromList = useCallback((id: string | number) => {
    setItems((prev) => prev.filter((item) => String(item.id) !== String(id)))
  }, [])

  const handlePublish = useCallback(
    async (id: string | number, sectionSlug: string) => {
      setError('')
      setPendingId(String(id))
      try {
        await doRequest(`/api/vk-import/queue/${id}/publish`, {
          method: 'POST',
          body: JSON.stringify({ targetSectionSlug: sectionSlug }),
        })
        removeFromList(id)
      } catch (error_) {
        setError((error_ as Error).message || 'Ошибка публикации')
      } finally {
        setPendingId(null)
      }
    },
    [doRequest, removeFromList],
  )

  const handleDiscard = useCallback(
    async (id: string | number) => {
      setError('')
      setPendingId(String(id))
      try {
        await doRequest(`/api/vk-import/queue/${id}/discard`, { method: 'POST' })
        removeFromList(id)
      } catch (error_) {
        setError((error_ as Error).message || 'Ошибка удаления')
      } finally {
        setPendingId(null)
      }
    },
    [doRequest, removeFromList],
  )

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-700">{error}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">В очереди пока нет новых постов из VK.</p>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <article key={item.id} className="rounded-lg border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold">Публикуемый пост: {item.title}</h2>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {item.queuedAt ? new Date(item.queuedAt).toLocaleString('ru-RU') : 'Без даты'}
                </span>
              </div>

              {item.sourceUrl ? (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-primary underline">
                  Открыть в VK
                </a>
              ) : null}

              <p className="mt-2 text-sm text-muted-foreground">{item.previewText || item.text || 'Без текста'}</p>

              {normalizeHeroImage(item.heroImage) ? (
                <Media
                  resource={normalizeHeroImage(item.heroImage)!}
                  alt={item.title}
                  className="mt-3 h-48 max-w-3xl overflow-hidden rounded-md border border-border"
                  imgClassName="h-full w-full object-cover"
                />
              ) : null}

              {normalizeSections(item.suggestedSections).length ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium">Возможные разделы:</p>
                  <ul className="mb-3 flex flex-wrap gap-1.5 text-xs">
                    {normalizeSections(item.suggestedSections).map((section) => (
                      <li key={section} className="rounded-full bg-muted px-2 py-1">
                        {section}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {sectionChoices.map((section) => (
                  <button
                    key={section.slug}
                    className="rounded-full border border-primary px-3 py-1.5 text-sm transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => handlePublish(item.id, section.slug)}
                    type="button"
                    disabled={pendingId === String(item.id)}
                  >
                    В {section.title}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <button
                  className="rounded-full border border-red-400 px-3 py-1.5 text-sm text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleDiscard(item.id)}
                  type="button"
                  disabled={pendingId === String(item.id)}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
