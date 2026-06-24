import { describe, it, expect, vi } from 'vitest'

import { withRetry } from '@/utilities/withRetry'

// Чистая обёртка повтора (pool #040). Без БД/Payload — гоняется как unit:
//   corepack pnpm exec vitest run tests/int/with-retry.int.spec.ts
// baseMs: 0 во всех кейсах → без реальных таймеров, тест мгновенный.
describe('withRetry', () => {
  it('успех с первой попытки → вызывает fn один раз, возвращает значение', async () => {
    const fn = vi.fn(async () => 'ok')
    const result = await withRetry(fn, { baseMs: 0 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('сбой, затем успех → повторяет и возвращает значение', async () => {
    let calls = 0
    const fn = vi.fn(async () => {
      calls += 1
      if (calls < 2) throw new Error('transient')
      return 42
    })
    const result = await withRetry(fn, { tries: 3, baseMs: 0 })
    expect(result).toBe(42)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('все попытки провалились → пробрасывает ПОСЛЕДНЮЮ ошибку после tries вызовов', async () => {
    const errors = [new Error('e1'), new Error('e2'), new Error('e3')]
    let i = 0
    const fn = vi.fn(async () => {
      throw errors[i++]
    })
    await expect(withRetry(fn, { tries: 3, baseMs: 0 })).rejects.toThrow('e3')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('по умолчанию tries=3', async () => {
    const fn = vi.fn(async () => {
      throw new Error('boom')
    })
    await expect(withRetry(fn, { baseMs: 0 })).rejects.toThrow('boom')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('tries=1 → одна попытка, без повторов', async () => {
    const fn = vi.fn(async () => {
      throw new Error('once')
    })
    await expect(withRetry(fn, { tries: 1, baseMs: 0 })).rejects.toThrow('once')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('tries < 1 нормализуется до 1 попытки', async () => {
    const fn = vi.fn(async () => 'x')
    const result = await withRetry(fn, { tries: 0, baseMs: 0 })
    expect(result).toBe('x')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('нарастающий бэк-офф: спит между попытками baseMs * номер_попытки, после последней не спит', async () => {
    const delays: number[] = []
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: () => void, ms?: number) => {
      delays.push(ms ?? 0)
      cb() // выполняем колбэк синхронно — без реального ожидания
      return 0 as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout)
    try {
      const fn = vi.fn(async () => {
        throw new Error('always')
      })
      await expect(withRetry(fn, { tries: 3, baseMs: 150 })).rejects.toThrow('always')
      // 3 попытки → 2 паузы (между 1→2 и 2→3), после 3-й не спим.
      expect(delays).toEqual([150, 300])
    } finally {
      spy.mockRestore()
    }
  })
})
