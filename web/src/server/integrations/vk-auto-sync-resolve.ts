/**
 * Хелперы для коллекции `vk-auto-sync`:
 * - извлечение groupId из любой формы URL VK-сообщества
 * - запрос метаданных группы через VK API (поле `groups.getById`)
 *
 * Цель — дать пользователю ввести только URL и получить остальное автоматически.
 */

const VK_API_VERSION = '5.199'

/**
 * Принимает URL VK-сообщества в любой обычной форме:
 *   - https://vk.com/club229392127
 *   - https://vk.com/public229392127
 *   - https://vk.com/club_229392127  (с подчёркиванием — редко, но бывает)
 *   - https://vk.com/screen_name      (короткое имя)
 *   - club229392127                   (без хоста)
 *   - 229392127                       (просто число)
 *
 * Возвращает либо `{ groupId: number }`, либо `{ screenName: string }` —
 * VK API принимает оба варианта.
 *
 * Если URL невалидный — возвращает null.
 */
export function parseVkCommunityIdentifier(input: string | null | undefined): {
  groupId?: number
  screenName?: string
} | null {
  if (!input || typeof input !== 'string') return null
  let raw = input.trim()
  if (!raw) return null

  // отсекаем протокол/домен, оставляем последний "сегмент" пути
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw)
      raw = u.pathname.replace(/^\/+/, '').split('/')[0] || raw
    }
  } catch {
    // оставляем как есть
  }
  raw = raw.replace(/[?#].*$/, '').replace(/^@/, '').trim()
  if (!raw) return null

  // club12345 / public12345 / group12345
  const num = raw.match(/^(?:club|public|group)_?(\d+)$/i)
  if (num) {
    return { groupId: Number(num[1]) }
  }

  // просто число
  if (/^\d+$/.test(raw)) {
    return { groupId: Number(raw) }
  }

  // short name (latin/cyrillic + digits + дефис/подчёркивание)
  if (/^[a-z0-9_\-.]{2,64}$/i.test(raw)) {
    return { screenName: raw }
  }

  return null
}

export type VkGroupMeta = {
  groupId: number
  screenName: string | null
  name: string | null
  description: string | null
  avatarUrl: string | null
}

/**
 * Подтянуть метаданные группы через VK API.
 * Используется при создании источника, если пользователь не заполнил поля вручную.
 *
 * @param identifier результат parseVkCommunityIdentifier (groupId/screenName)
 * @param token VK access token (сервисный или пользовательский). Если null/пусто — функция вернёт null.
 */
export async function fetchVkGroupMeta(
  identifier: { groupId?: number; screenName?: string },
  token: string | null | undefined,
): Promise<VkGroupMeta | null> {
  if (!token) return null
  const groupKey = identifier.screenName || (identifier.groupId != null ? String(identifier.groupId) : null)
  if (!groupKey) return null

  const params = new URLSearchParams({
    group_ids: groupKey,
    fields: 'description,members_count,photo_200,photo_100,photo_50,activity,screen_name',
    access_token: token,
    v: VK_API_VERSION,
  })

  let res: Response
  try {
    res = await fetch(`https://api.vk.com/method/groups.getById?${params.toString()}`, {
      // VK иногда отвечает медленно; чтобы хук Payload не висел вечно — таймаут.
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return null
  }
  if (!res.ok) return null

  let data: unknown
  try {
    data = await res.json()
  } catch {
    return null
  }
  const root = data as { response?: { groups?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>; error?: unknown }
  if (root?.error) return null

  // VK API 5.199 returns { response: { groups: [...] } }; старые версии — просто [...].
  const list = Array.isArray(root.response)
    ? root.response
    : Array.isArray((root.response as { groups?: unknown[] } | undefined)?.groups)
      ? (root.response as { groups: Array<Record<string, unknown>> }).groups
      : []
  const first = list?.[0]
  if (!first) return null

  return {
    groupId: Number(first.id) || identifier.groupId || 0,
    screenName: typeof first.screen_name === 'string' ? first.screen_name : identifier.screenName || null,
    name: typeof first.name === 'string' ? first.name : null,
    description: typeof first.description === 'string' ? first.description : null,
    avatarUrl:
      (typeof first.photo_200 === 'string' && first.photo_200) ||
      (typeof first.photo_100 === 'string' && first.photo_100) ||
      (typeof first.photo_50 === 'string' && first.photo_50) ||
      null,
  }
}

/**
 * Получить fallback-токен из env, если у источника свой токен не задан.
 * Берём первый непустой из общих токенов.
 */
export function getEnvFallbackVkToken(): string | null {
  const candidates = [
    process.env.VK_TOKEN_VALSTAN,
    process.env.VK_TOKEN_VITA,
    process.env.VK_SERVICE_TOKEN,
    process.env.VK_TOKEN,
  ]
  for (const t of candidates) {
    if (t && typeof t === 'string' && t.trim()) return t.trim()
  }
  return null
}
