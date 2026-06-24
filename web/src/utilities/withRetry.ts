/**
 * Тонкая обёртка для повтора транзиентно-сбойных асинхронных операций (обычно —
 * запрос к БД через Payload/Drizzle). Нужна против cross-project pool #040:
 * под ISR ревалидация может совпасть с моментальным сбоем (пул коннектов моргнул /
 * БД на миг занята), и тогда сбойный рендер кэшируется на всё окно revalidate.
 *
 * Семантика:
 * - успех с первой попытки → задержек нет, мгновенный возврат;
 * - на ошибке — пауза с нарастающим бэк-оффом (`baseMs * номер_попытки`) и повтор;
 * - после `tries` неудач — **пробрасывает** последнюю ошибку (НЕ глушит).
 *
 * Применять по типу рендера:
 * - **detail-хелперы** (по slug, ведут к `notFound()`): обернуть `find` → пусть бросает.
 *   Тогда Next под ISR не заменяет удачный кэш сбоем (отдаёт прошлую хорошую версию),
 *   а `null` (0 docs) = страницы реально нет → штатный 404 как и был.
 * - **агрегатные/списочные секции**: ретрай ВНУТРИ прежнего `try/catch` →
 *   graceful-деградация к `[]`/`null` сохранена, но окно пустого кэша становится редким.
 *
 * Отличать «сбой запроса» (→ throw) от «документа нет» (→ `null`/`[]`) — ключ к фиксу.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { tries?: number; baseMs?: number } = {},
): Promise<T> {
  const tries = Math.max(1, opts.tries ?? 3)
  const baseMs = opts.baseMs ?? 150

  let lastError: unknown
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      // После последней попытки не спим — сразу пробрасываем ниже.
      if (attempt < tries && baseMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, baseMs * attempt))
      }
    }
  }
  throw lastError
}
