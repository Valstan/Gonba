'use client'

import { type ReactNode, useEffect } from 'react'

// Простой модал для формы загрузки ленты: оверлей + Esc + блокировка прокрутки фона.
export function LentaModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="lenta-modal" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="lenta-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="lenta-modal-head">
          <h3>{title}</h3>
          <button type="button" className="lenta-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
