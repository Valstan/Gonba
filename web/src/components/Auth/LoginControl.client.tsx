'use client'

import React, { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAdminMode } from '@/providers/AdminMode'
import { fetchMe, isAdminUser, loginUser, logoutUser } from '@/utilities/me'

/**
 * Постоянная кнопка входа в шапке сайта.
 *
 * - Гость → кнопка «Войти» открывает модалку email+пароль (POST /api/users/login),
 *   остаёмся на странице; на успехе включается режим «Управление» (AdminMode),
 *   и на страницах появляются элементы inline-редактирования.
 * - Залогиненный админ/редактор → кнопка «Выйти».
 *
 * Состояние логина живёт в общем контексте AdminMode (тот же, что использует
 * AdminBar). Переключатель Просмотр/Управление и прочие админ-действия — в AdminBar.
 */
export const LoginControl: React.FC = () => {
  const { isAdmin, setIsAdmin, setMode } = useAdminMode()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Отразить уже залогиненного пользователя при загрузке страницы.
  useEffect(() => {
    let cancelled = false
    fetchMe().then((u) => {
      if (!cancelled && isAdminUser(u)) setIsAdmin(true)
    })
    return () => {
      cancelled = true
    }
  }, [setIsAdmin])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const result = await loginUser(email.trim(), password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (!isAdminUser(result.user)) {
      setError('У этого аккаунта нет прав на редактирование сайта.')
      return
    }
    setIsAdmin(true)
    setMode('manage')
    setOpen(false)
    setEmail('')
    setPassword('')
  }

  const handleLogout = async () => {
    await logoutUser()
    setIsAdmin(false)
  }

  if (isAdmin) {
    return (
      <button type="button" onClick={handleLogout} className="ethno-auth-btn" title="Выйти из режима редактирования">
        Выйти
      </button>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="ethno-auth-btn" title="Вход для редактора">
        Войти
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Вход для редактора</DialogTitle>
            <DialogDescription>
              Войдите, чтобы редактировать содержимое прямо на сайте.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label htmlFor="login-email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="you@example.com"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium">
                Пароль
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? 'Входим…' : 'Войти'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
