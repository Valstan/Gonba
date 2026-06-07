'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useDocumentInfo, useListDrawer } from '@payloadcms/ui'

import './index.scss'

/**
 * Sidebar widget on the Media edit view (Phase C.2 UI).
 *
 * Shows where the current file is used (via `GET /api/media/usage`) and, when it
 * IS used (so the normal Delete button is blocked by the safe-delete hook),
 * offers two escape hatches:
 *   - «Заменить на другую» → pick a target via the media list drawer →
 *     `POST /api/media/replace` re-points every reference and deletes this file.
 *   - «Всё равно удалить»  → `POST /api/media/force-delete` deletes anyway,
 *     leaving references broken (explicit, behind a confirm).
 *
 * Both endpoints are admin/editor-gated. When the file is unused, we just say so.
 */

type Usage = {
  total: number
  usages: Array<{
    collection: string
    label: string
    title: string | null
    isGlobal: boolean
    docId: number | null
    fields: string[]
    adminUrl: string | null
  }>
}

const describe = (u: Usage['usages'][number]) =>
  u.isGlobal ? u.label : `${u.label} «${u.title ?? `#${u.docId}`}»`

export const MediaActions: React.FC = () => {
  const { id } = useDocumentInfo()
  const mediaId = typeof id === 'number' ? id : typeof id === 'string' ? Number(id) : NaN
  const hasId = Number.isInteger(mediaId) && mediaId > 0

  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ListDrawer, , { openDrawer, closeDrawer }] = useListDrawer({
    collectionSlugs: ['media'],
    uploads: true,
  })

  const loadUsage = useCallback(async () => {
    if (!hasId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/media/usage?id=${mediaId}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Не удалось получить список использования (${res.status})`)
      setUsage((await res.json()) as Usage)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setLoading(false)
    }
  }, [hasId, mediaId])

  useEffect(() => {
    void loadUsage()
  }, [loadUsage])

  const forceDelete = useCallback(async () => {
    if (!hasId) return
    if (
      !window.confirm(
        'Удалить файл, оставив ссылки на него битыми? Картинки в перечисленных местах пропадут. Действие необратимо.',
      )
    )
      return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/media/force-delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mediaId }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data?.error || `Ошибка (${res.status})`)
      window.location.href = '/admin/collections/media'
    } catch (e) {
      setError(String((e as Error).message || e))
      setBusy(false)
    }
  }, [hasId, mediaId])

  const replaceWith = useCallback(
    async (targetId: number) => {
      if (!hasId) return
      if (targetId === mediaId) {
        setError('Нельзя заменить файл на самого себя')
        return
      }
      if (
        !window.confirm(
          `Заменить этот файл на #${targetId} во всех местах и удалить текущий? Все ссылки перепривяжутся, текущий файл будет удалён.`,
        )
      )
        return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch('/api/media/replace', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: mediaId, to: targetId }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (!res.ok) throw new Error(data?.error || `Ошибка (${res.status})`)
        window.location.href = '/admin/collections/media'
      } catch (e) {
        setError(String((e as Error).message || e))
        setBusy(false)
      }
    },
    [hasId, mediaId],
  )

  if (!hasId) return null // unsaved/new doc — nothing to manage yet

  return (
    <div className="media-actions">
      <h4 className="media-actions__title">Связи и удаление</h4>

      {loading ? (
        <p className="media-actions__muted">Проверяем использование…</p>
      ) : !usage || usage.total === 0 ? (
        <p className="media-actions__muted">
          Файл нигде не используется — его можно удалить обычной кнопкой «Удалить».
        </p>
      ) : (
        <>
          <p className="media-actions__muted">
            Используется ({usage.total}). Обычное удаление заблокировано, чтобы не сломать контент:
          </p>
          <ul className="media-actions__list">
            {usage.usages.map((u, i) => (
              <li key={`${u.collection ?? ''}-${u.docId ?? i}`}>
                {u.adminUrl ? (
                  <a href={u.adminUrl} target="_blank" rel="noreferrer">
                    {describe(u)}
                  </a>
                ) : (
                  describe(u)
                )}
                {u.fields.length ? <span className="media-actions__where"> — {u.fields.join(', ')}</span> : null}
              </li>
            ))}
          </ul>

          <div className="media-actions__buttons">
            <button
              type="button"
              className="media-actions__btn media-actions__btn--replace"
              disabled={busy}
              onClick={openDrawer}
            >
              Заменить на другую
            </button>
            <button
              type="button"
              className="media-actions__btn media-actions__btn--danger"
              disabled={busy}
              onClick={forceDelete}
            >
              Всё равно удалить
            </button>
          </div>
          <p className="media-actions__hint">
            «Заменить» перепривяжет ссылки на выбранный файл и удалит текущий (безопасно, контент остаётся
            с картинкой). «Всё равно удалить» оставит ссылки битыми.
          </p>
        </>
      )}

      {busy ? <p className="media-actions__muted">Выполняем…</p> : null}
      {error ? <p className="media-actions__error">{error}</p> : null}

      <ListDrawer
        onSelect={({ doc }) => {
          closeDrawer()
          const targetId = Number((doc as { id?: unknown })?.id)
          if (Number.isInteger(targetId) && targetId > 0) void replaceWith(targetId)
        }}
      />
    </div>
  )
}

export default MediaActions
