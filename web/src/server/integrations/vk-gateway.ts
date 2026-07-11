/**
 * VK Gateway (SARAFAN) — read-only доступ к VK через HTTP-шлюз соседнего проекта.
 *
 * Зачем: VK привязывает user-токен к IP его выпуска, поэтому наши собственные
 * `VK_TOKEN_*` на сервере Гоньбы дают `error 5 (given to another ip)` / банятся.
 * SARAFAN держит рабочие токены + smart-routing/cooldown и исполняет read-запрос
 * СВОИМ токеном со СВОЕГО IP, возвращая сырой VK-payload. Токен наружу не выдаётся.
 * Контракт: setka `docs/GATEWAY.md` (ADR-0007 — читаем sibling напрямую).
 *
 * Degraded-safe: без `SARAFAN_GATEWAY_KEY` — `isGatewayConfigured()` = false, и
 * vk-auto-sync идёт прежним путём (локальные токены). Ключ появился → чтение VK
 * автоматически переключается на шлюз. Ключ — секрет, только в env
 * (`/etc/gonba/gonba.env`), запрашивается у владельца SARAFAN.
 *
 * ⚠️ v1 шлюза — READ-ONLY. Запись (wall.post/likes.add/…) шлюз отклоняет (400).
 * Гоньбе запись не нужна — только чтение стен/метаданных.
 */

const GATEWAY_URL = (process.env.SARAFAN_GATEWAY_URL || 'https://3931b3fe50ab.vps.myjino.ru').replace(/\/+$/, '')
const GATEWAY_KEY = process.env.SARAFAN_GATEWAY_KEY || ''
const GATEWAY_TIMEOUT_MS = Number(process.env.SARAFAN_GATEWAY_TIMEOUT_MS) || 12000

/** Задан ли ключ шлюза. Без него VK-чтение идёт прежним путём (локальные токены). */
export function isGatewayConfigured(): boolean {
  return Boolean(GATEWAY_KEY)
}

/** Доменная VK-ошибка, вернувшаяся через шлюз (`{ ok:false, error }`) — это ДАННЫЕ,
 *  не сбой сети: закрытая стена, удалённый объект и т.п. Отличаем от сетевых сбоев. */
export class VkGatewayVkError extends Error {
  code: number
  constructor(code: number, msg: string) {
    super(`VK error ${code}: ${msg}`)
    this.code = code
  }
}

type GatewayResponse<T> = { ok: true; response: T } | { ok: false; error: { error_code: number; error_msg: string } }

/**
 * Исполнить read-метод VK через универсальную дверь шлюза `POST /api/gateway/call`.
 * Возвращает сырой VK-payload метода (`response`). Токен/версию API подставляет сам
 * шлюз — здесь только функциональные params (owner_id/group_ids/…), без access_token/v.
 *
 * Бросает:
 *  - `VkGatewayVkError` — VK вернул доменную ошибку (`{ok:false}`);
 *  - обычный `Error` — сеть/таймаут, 401 (неверный ключ), 429 (квота, с Retry-After
 *    в тексте), 503 (шлюз выключен / нет живого токена). Вызывающий сам решает,
 *    ретраить или пометить прогон ошибкой.
 */
export async function gatewayCall<T = unknown>(
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  if (!GATEWAY_KEY) throw new Error('SARAFAN_GATEWAY_KEY не задан')

  let res: Response
  try {
    res = await fetch(`${GATEWAY_URL}/api/gateway/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': GATEWAY_KEY },
      body: JSON.stringify({ method, params }),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    })
  } catch (err) {
    throw new Error(`VK Gateway недоступен (${method}): ${(err as Error)?.message || 'network'}`)
  }

  if (res.status === 429) {
    const retry = res.headers.get('retry-after') || '?'
    throw new Error(`VK Gateway: превышена квота (429), Retry-After=${retry}s`)
  }
  if (res.status === 401) throw new Error('VK Gateway: неверный ключ (401)')
  if (res.status === 503) throw new Error('VK Gateway: недоступен / нет живого токена (503)')
  if (!res.ok) throw new Error(`VK Gateway HTTP ${res.status} (${method})`)

  let data: GatewayResponse<T>
  try {
    data = (await res.json()) as GatewayResponse<T>
  } catch {
    throw new Error(`VK Gateway: некорректный JSON (${method})`)
  }

  if (data.ok === false) {
    throw new VkGatewayVkError(data.error?.error_code ?? 0, data.error?.error_msg ?? 'VK error')
  }
  return data.response
}
