import { describe, expect, it } from 'vitest'

import { selectDeletableKeys } from '@/server/ugc/referencedKeys'

/**
 * Удалять из бакета можно только те ключи, на которые не ссылается **никто, кроме**
 * удаляемой записи.
 *
 * Иначе достаточно сослаться в своей публикации на чужой ключ (ключи приходят от клиента,
 * уникальность верхнего `objectKey` обходится через `media[]`) и удалить публикацию —
 * физически исчезал файл чужой записи. Аудит 2026-10-18: проверка владения отвечала
 * «твоя ли запись», но не «твой ли файл».
 */

describe('selectDeletableKeys', () => {
  it('ключ, на который ссылается другая запись, не удаляется', async () => {
    const { deletable, kept } = await selectDeletableKeys(
      ['media/lenta/1/a.jpg', 'media/lenta/2/b.jpg'],
      async (key) => key === 'media/lenta/2/b.jpg',
    )
    expect(deletable).toEqual(['media/lenta/1/a.jpg'])
    expect(kept).toEqual(['media/lenta/2/b.jpg'])
  })

  it('чужие ключи, взятые из своей записи, — не удаляются (сценарий атаки)', async () => {
    // Публикация атакующего ссылается на обложку и файл жертвы.
    const stolen = 'media/lenta/9999/victim.jpg'
    const { deletable } = await selectDeletableKeys(
      ['media/lenta/1111/own.jpg', stolen, stolen],
      async (key) => key === stolen,
    )
    expect(deletable).toEqual(['media/lenta/1111/own.jpg'])
  })

  it('пустые значения и дубли отбрасываются, порядок детерминированный', async () => {
    const { deletable, kept } = await selectDeletableKeys(
      [null, undefined, 'a', 'b', 'a', ''],
      async () => false,
    )
    expect(deletable).toEqual(['a', 'b'])
    expect(kept).toEqual([])
  })

  it('ошибка поиска трактуется как «ссылка есть» — отказ безопаснее удаления чужого', async () => {
    const { deletable, kept } = await selectDeletableKeys(['x'], async () => {
      throw new Error('БД недоступна')
    })
    expect(deletable).toEqual([])
    expect(kept).toEqual(['x'])
  })

  it('пустой список ключей не требует ни одного поиска', async () => {
    let calls = 0
    const { deletable } = await selectDeletableKeys([null, undefined], async () => {
      calls += 1
      return false
    })
    expect(deletable).toEqual([])
    expect(calls).toBe(0)
  })
})
