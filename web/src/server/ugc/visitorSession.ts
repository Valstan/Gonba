// Заглушка сессии посетителя (VK ID вход) — этап 5 плана sabantuy-borrowings.md.
// Хуки/эндпоинты UGC уже зовут visitorFromHeaders, чтобы при внедрении VK-входа
// (коллекция visitors + HMAC-cookie) владение контентом «с любого устройства»
// включилось без правки контура ленты. До этапа 5 — всегда null (аноним-владение
// по браузерному токену X-UGC-Owner работает полноценно).

export type VisitorSession = { visitorId: number }

export function visitorFromHeaders(_headers: Headers): VisitorSession | null {
  return null
}
