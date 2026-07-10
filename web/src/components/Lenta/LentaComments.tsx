'use client'

import { useEffect, useState } from 'react'

import { deleteComment, editComment, isMine, markMine, ugcHeaders } from './ugcClient'

type Comment = { id: number; authorName: string | null; body: string; createdAt: string }
type Status = 'idle' | 'sending'

// Тред комментариев карточки ленты. Монтируется по раскрытию → лениво тянет видимые
// комментарии и форму добавления (постмодерация: виден сразу). Свой комментарий (по
// токену) можно править/удалить. onAdded/onRemoved — двигать счётчик на карточке.
export function LentaComments({
  submissionId,
  onAdded,
  onRemoved,
}: {
  submissionId: number
  onAdded: () => void
  onRemoved: () => void
}) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [body, setBody] = useState('')
  const [author, setAuthor] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    let alive = true
    const qs = `where[submission][equals]=${submissionId}&where[status][equals]=visible&sort=createdAt&limit=100&depth=0`
    fetch(`/api/submission-comments?${qs}`)
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((j) => {
        if (alive) setComments(Array.isArray(j.docs) ? j.docs : [])
      })
      .catch(() => {
        if (alive) setComments([])
      })
    return () => {
      alive = false
    }
  }, [submissionId])

  const canManage = (c: Comment) => isMine('comment', c.id)

  async function submit() {
    const text = body.trim()
    if (!text) return
    setStatus('sending')
    setErr(null)
    try {
      const res = await fetch('/api/submission-comments', {
        method: 'POST',
        headers: ugcHeaders(), // + X-UGC-Owner → сервер стампит ownerHash (владение)
        body: JSON.stringify({ submission: submissionId, authorName: author.trim() || undefined, body: text }),
      })
      if (!res.ok) {
        setStatus('idle')
        setErr('Не получилось отправить. Попробуйте ещё раз.')
        return
      }
      const j = (await res.json()) as { doc?: Comment }
      if (j.doc) {
        markMine('comment', j.doc.id) // помним «моё» → покажем кнопки править/удалить
        setComments((prev) => [...(prev ?? []), j.doc as Comment])
      }
      onAdded()
      setBody('')
      setStatus('idle')
    } catch {
      setStatus('idle')
      setErr('Не получилось отправить. Попробуйте ещё раз.')
    }
  }

  function startEdit(c: Comment) {
    setEditingId(c.id)
    setEditText(c.body)
    setErr(null)
  }

  async function saveEdit(id: number) {
    const text = editText.trim()
    if (!text) return
    const newBody = await editComment(id, text)
    if (newBody === null) {
      setErr('Не получилось сохранить.')
      return
    }
    setComments((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, body: newBody } : c)))
    setEditingId(null)
    setEditText('')
  }

  async function removeComment(id: number) {
    if (typeof window !== 'undefined' && !window.confirm('Удалить комментарий?')) return
    const ok = await deleteComment(id)
    if (!ok) {
      setErr('Не получилось удалить.')
      return
    }
    setComments((prev) => (prev ?? []).filter((c) => c.id !== id))
    onRemoved()
  }

  return (
    <div className="lenta-comments">
      {comments === null ? (
        <p className="lenta-comments-loading">…</p>
      ) : comments.length === 0 ? (
        <p className="lenta-comments-empty">Пока нет комментариев — будьте первым!</p>
      ) : (
        <ul className="lenta-comments-list">
          {comments.map((c) => (
            <li key={c.id}>
              {editingId === c.id ? (
                <div className="lenta-comment-edit">
                  <textarea
                    value={editText}
                    maxLength={1000}
                    rows={2}
                    onChange={(e) => setEditText(e.target.value)}
                    aria-label="Изменить комментарий"
                  />
                  <div className="lenta-comment-edit-actions">
                    <button
                      type="button"
                      className="lenta-link-btn"
                      onClick={() => saveEdit(c.id)}
                      disabled={!editText.trim()}
                    >
                      Сохранить
                    </button>
                    <button type="button" className="lenta-link-btn" onClick={() => setEditingId(null)}>
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {c.authorName && <span className="lenta-comment-author">{c.authorName}: </span>}
                  <span className="lenta-comment-body">{c.body}</span>
                  {canManage(c) && (
                    <span className="lenta-comment-actions">
                      <button type="button" className="lenta-link-btn" onClick={() => startEdit(c)}>
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="lenta-link-btn lenta-link-btn--danger"
                        onClick={() => removeComment(c.id)}
                      >
                        Удалить
                      </button>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="lenta-comments-form">
        <input
          type="text"
          className="lenta-comments-name"
          placeholder="Ваше имя (необязательно)"
          value={author}
          maxLength={64}
          onChange={(e) => setAuthor(e.target.value)}
          disabled={status === 'sending'}
        />
        <textarea
          className="lenta-comments-input"
          placeholder="Написать комментарий…"
          value={body}
          maxLength={1000}
          rows={2}
          onChange={(e) => setBody(e.target.value)}
          disabled={status === 'sending'}
        />
        {err && (
          <p className="lenta-upload-error" role="alert">
            {err}
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={submit}
          disabled={!body.trim() || status === 'sending'}
        >
          {status === 'sending' ? 'Отправка…' : 'Отправить'}
        </button>
      </div>
    </div>
  )
}
