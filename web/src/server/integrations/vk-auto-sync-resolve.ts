/**
 * Хелперы для коллекции `vk-auto-sync`:
 * - извлечение числового id источника из любой формы URL VK
 * - определение типа источника: сообщество (group) или личная страница (user)
 * - запрос метаданных через VK API (`groups.getById` для групп, `users.get` для
 *   личных страниц)
 *
 * Цель — дать пользователю ввести только URL и получить остальное автоматически.
 * Тип источника важен для `wall.get`: у сообщества `owner_id` отрицательный
 * (`-groupId`), у личной страницы — положительный (`+userId`).
 */

import { gatewayCall, isGatewayConfigured } from './vk-gateway'

const VK_API_VERSION = '5.199'

export type VkIdentifier = {
  /**
   * 'group' — сообщество (club/public/group/просто число),
   * 'user' — личная страница (vk.com/idN),
   * undefined — короткое имя: тип нельзя определить из URL без запроса к API.
   */
  kind?: 'user' | 'group'
  groupId?: number
  userId?: number
  screenName?: string
}

/**
 * Принимает URL VK-источника в любой обычной форме:
 *   - https://vk.com/club229392127    → { kind:'group', groupId }
 *   - https://vk.com/public229392127  → group
 *   - https://vk.com/group_229392127  → group (подчёркивание — редко, но бывает)
 *   - https://vk.com/id86086407       → { kind:'user', userId } (личная страница)
 *   - https://vk.com/screen_name      → { screenName } (тип неизвестен)
 *   - club229392127                   → group (без хоста)
 *   - 229392127                       → group (просто число — исторически сообщество)
 *
 * Если URL невалидный — возвращает null.
 */
export function parseVkCommunityIdentifier(input: string | null | undefined): VkIdentifier | null {
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

  // club12345 / public12345 / group12345 → сообщество
  const grp = raw.match(/^(?:club|public|group)_?(\d+)$/i)
  if (grp) {
    return { kind: 'group', groupId: Number(grp[1]) }
  }

  // idXXXX → личная страница (VK резервирует idN только под user-страницы;
  // кастомное короткое имя вида id<цифры> создать нельзя)
  const usr = raw.match(/^id(\d+)$/i)
  if (usr) {
    return { kind: 'user', userId: Number(usr[1]) }
  }

  // просто число → исторически сообщество
  if (/^\d+$/.test(raw)) {
    return { kind: 'group', groupId: Number(raw) }
  }

  // short name (latin/cyrillic + digits + дефис/подчёркивание) — тип неизвестен:
  // короткое имя может принадлежать и сообществу, и личной странице
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
  const groupKey = identifier.screenName || (identifier.groupId != null ? String(identifier.groupId) : null)
  if (!groupKey) return null

  // Метаданные тоже через шлюз SARAFAN (если задан ключ) — как и wall.get. Без ключа
  // (или при сбое шлюза) откатываемся на локальный токен, если он передан.
  const fields = 'description,members_count,photo_200,photo_100,photo_50,activity,screen_name'
  let data: unknown = null
  if (isGatewayConfigured()) {
    try {
      const response = await gatewayCall('groups.getById', { group_ids: groupKey, fields })
      data = { response }
    } catch {
      data = null
    }
  }
  if (data == null) {
    if (!token) return null
    const params = new URLSearchParams({
      group_ids: groupKey,
      fields,
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
    try {
      data = await res.json()
    } catch {
      return null
    }
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
 * Подтянуть метаданные личной страницы (vk.com/idN) через VK API `users.get`.
 * Возвращает ту же форму `VkGroupMeta`, что и `fetchVkGroupMeta` (поле `groupId`
 * = userId), чтобы вызывающий код был единообразным.
 *
 * @param userId числовой id пользователя VK
 * @param token VK access token. Если null/пусто — функция вернёт null.
 */
export async function fetchVkUserMeta(
  userId: number | null | undefined,
  token: string | null | undefined,
): Promise<VkGroupMeta | null> {
  if (!userId) return null

  const fields = 'photo_200,photo_100,photo_50,screen_name,status'
  let data: unknown = null
  if (isGatewayConfigured()) {
    try {
      const response = await gatewayCall('users.get', { user_ids: String(userId), fields })
      data = { response }
    } catch {
      data = null
    }
  }
  if (data == null) {
    if (!token) return null
    const params = new URLSearchParams({
      user_ids: String(userId),
      fields,
      access_token: token,
      v: VK_API_VERSION,
    })
    let res: Response
    try {
      res = await fetch(`https://api.vk.com/method/users.get?${params.toString()}`, {
        signal: AbortSignal.timeout(8000),
      })
    } catch {
      return null
    }
    if (!res.ok) return null
    try {
      data = await res.json()
    } catch {
      return null
    }
  }
  const root = data as { response?: Array<Record<string, unknown>>; error?: unknown }
  if (root?.error) return null

  const first = Array.isArray(root.response) ? root.response[0] : undefined
  if (!first) return null

  const firstName = typeof first.first_name === 'string' ? first.first_name : ''
  const lastName = typeof first.last_name === 'string' ? first.last_name : ''
  const fullName = `${firstName} ${lastName}`.trim()

  return {
    groupId: Number(first.id) || userId,
    screenName: typeof first.screen_name === 'string' ? first.screen_name : null,
    name: fullName || null,
    description: typeof first.status === 'string' && first.status.trim() ? first.status : null,
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
