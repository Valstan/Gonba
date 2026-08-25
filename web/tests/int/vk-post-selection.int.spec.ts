import { describe, expect, it } from 'vitest'

import { selectNextVkPost, vkPostRejectionReason } from '@/server/integrations/vk-auto-sync'

const post = (id: number, text = `Пост ${id}`, extra: Record<string, unknown> = {}) => ({
  id,
  date: 0,
  text,
  owner_id: -1,
  from_id: -1,
  ...extra,
})

describe('selectNextVkPost', () => {
  it('разбирает накопившиеся посты от старого к новому', () => {
    expect(selectNextVkPost([post(15), post(14), post(13)], 12).post?.id).toBe(13)
  })

  it('пропускает пустые и уже импортированные записи', () => {
    expect(selectNextVkPost([post(15, '  '), post(14), post(13)], 13).post?.id).toBe(14)
  })

  it('возвращает undefined, когда новых текстовых постов нет', () => {
    expect(selectNextVkPost([post(12), post(11)], 12).post).toBeUndefined()
  })

  it('рутинные пропуски не попадают в отчёт об отсеве', () => {
    // «уже импортирован» и «пустой текст» — не новость. В rejected должно
    // попадать только то, о чём стоит сказать в журнале.
    expect(selectNextVkPost([post(12), post(13, '   ')], 12).rejected).toEqual([])
  })

  it('перешагивает отклонённый пост и берёт следующий годный', () => {
    const posts = [post(13, 'Реклама', { marked_as_ads: 1 }), post(14, 'Нормальный пост')]
    const result = selectNextVkPost(posts, 12)

    expect(result.post?.id).toBe(14)
    expect(result.rejected).toEqual([{ id: 13, reason: 'реклама, помеченная сообществом' }])
  })

  it('когда годных нет — отдаёт причины отказа, а не пустоту', () => {
    const posts = [
      post(13, 'Реклама', { marked_as_ads: 1 }),
      post(14, 'Смотрите что нашёл', { copy_history: [{ id: 999 }] }),
    ]
    const result = selectNextVkPost(posts, 12)

    expect(result.post).toBeUndefined()
    expect(result.rejected.map((r) => r.reason)).toEqual(['реклама, помеченная сообществом', 'репост чужой записи'])
  })
})

describe('vkPostRejectionReason', () => {
  it('обычный пост проходит', () => {
    // Контрольный кейс: без него любая ошибка в фильтре выглядела бы как
    // «фильтр работает» — он просто отбрасывал бы всё подряд.
    expect(vkPostRejectionReason(post(1))).toBeNull()
  })

  it('отсеивает рекламу, помеченную сообществом', () => {
    expect(vkPostRejectionReason(post(1, 'т', { marked_as_ads: 1 }))).toBe('реклама, помеченная сообществом')
  })

  it('marked_as_ads=0 не считается рекламой', () => {
    expect(vkPostRejectionReason(post(1, 'т', { marked_as_ads: 0 }))).toBeNull()
  })

  it('ловит рекламу и если поле придёт boolean, а не 0/1', () => {
    // Схема VK описывает поле как base_bool_int, но шлюз ходит на своей версии
    // API, и форму ответа мы не контролируем. Проверка на истинность обязана
    // пережить смену формы — иначе реклама молча просочится.
    expect(vkPostRejectionReason(post(1, 'т', { marked_as_ads: true }))).toBe('реклама, помеченная сообществом')
  })

  it('отсеивает репост чужой записи', () => {
    expect(vkPostRejectionReason(post(1, 'Смотрите', { copy_history: [{ id: 5 }] }))).toBe('репост чужой записи')
  })

  it('пустой copy_history репостом не считается', () => {
    expect(vkPostRejectionReason(post(1, 'т', { copy_history: [] }))).toBeNull()
  })

  it('отсеивает удалённую запись', () => {
    expect(vkPostRejectionReason(post(1, 'т', { is_deleted: true }))).toBe('запись удалена в VK')
  })

  it('отсеивает служебный тип записи', () => {
    expect(vkPostRejectionReason(post(1, 'т', { post_type: 'post_ads' }))).toBe('служебный тип записи (post_ads)')
    expect(vkPostRejectionReason(post(1, 'т', { post_type: 'suggest' }))).toBe('служебный тип записи (suggest)')
  })

  /**
   * Ключевой кейс. Шлюз SARAFAN ходит в VK на своей версии API, и придёт ли
   * post_type вообще — мы не проверяли живым ответом. Строгое
   * `post_type !== 'post'` при отсутствующем поле отбросило бы КАЖДЫЙ пост и
   * остановило импорт молча, под видом «в сообществе тишина».
   */
  it('отсутствие post_type не считается служебным типом', () => {
    expect(vkPostRejectionReason(post(1))).toBeNull()
    expect(vkPostRejectionReason(post(1, 'т', { post_type: undefined }))).toBeNull()
    expect(vkPostRejectionReason(post(1, 'т', { post_type: 'post' }))).toBeNull()
  })
})
