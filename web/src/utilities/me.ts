/**
 * Клиентские помощники аутентификации для публичного фронтенда.
 *
 * Используются как существующим inline-редактором плашек (EditableProjectsGrid),
 * так и новой кнопкой входа в шапке (components/Auth). Раньше fetchMe/isAdminUser
 * дублировались в EditableProjectsGrid — вынесено сюда как единый источник.
 *
 * Все запросы идут на встроенные Payload REST-эндпоинты того же origin с
 * `credentials: 'include'`, чтобы автоматически слать/получать httpOnly-cookie
 * `payload-token`.
 */

export type MeUser = {
  id: number | string
  email?: string | null
  roles?: string[] | null
} | null

type MeResponse = { user: MeUser }

/** Роли, которым доступно редактирование на сайте. */
const EDITOR_ROLES = ['admin', 'manager', 'editor'] as const

/** Текущий пользователь (или null, если гость / запрос не удался). */
export async function fetchMe(): Promise<MeUser> {
  try {
    const res = await fetch('/api/users/me', { credentials: 'include' })
    if (!res.ok) return null
    const data = (await res.json()) as MeResponse
    return data?.user ?? null
  } catch {
    return null
  }
}

/** true, если у пользователя есть роль admin/manager/editor. */
export function isAdminUser(user: MeUser): boolean {
  if (!user) return false
  const roles = Array.isArray(user.roles) ? user.roles : []
  return roles.some((r) => (EDITOR_ROLES as readonly string[]).includes(r))
}

export type LoginResult = { ok: true; user: MeUser } | { ok: false; error: string }

/** Логин по email+паролю. На успехе Payload ставит cookie payload-token. */
export async function loginUser(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      // Payload возвращает { errors: [{ message }] } при неверных данных
      let message = `Ошибка входа (${res.status})`
      try {
        const body = (await res.json()) as { errors?: Array<{ message?: string }> }
        if (body?.errors?.[0]?.message) message = body.errors[0].message
      } catch {
        // ignore — оставим дефолтное сообщение
      }
      return { ok: false, error: message }
    }
    const data = (await res.json()) as { user?: MeUser }
    return { ok: true, user: data?.user ?? null }
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e) }
  }
}

/** Логаут — Payload чистит cookie payload-token. */
export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // ignore — даже при сетевой ошибке UI сбросит локальное состояние
  }
}
