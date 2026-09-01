import { describe, expect, it } from 'vitest'

import {
  VK_MAX_IMPORT_ATTEMPTS,
  hasUsableVkText,
  normalizeVkEditorial,
  poisonedVkPostIds,
  selectNextVkPost,
  vkPostRejectionReason,
} from '@/server/integrations/vk-auto-sync'

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

/**
 * Мина, ради которой писались эти тесты.
 *
 * `lastSyncedPostId` двигается ТОЛЬКО на путях «пост создан» и «пост уже был».
 * Любой бросок между выбором поста и созданием записи (ValidationError на
 * `payload.create`, отсутствующий проект источника, сбой БД) уходит в catch,
 * который пишет `lastError` — и НЕ трогает курсор. А `selectNextVkPost` берёт
 * самый старый неимпортированный пост, то есть на следующем прогоне выберет
 * ТОТ ЖЕ пост, снова платно сходит в классификатор и снова упадёт.
 *
 * Заперт при этом не один пост, а весь источник: всё, что новее, стоит за ним
 * в очереди навсегда. Лечение — не «двигать курсор на любой ошибке» (так
 * разовый сетевой сбой молча съел бы годный пост), а ограниченное число
 * попыток: после исчерпания пост перешагивается, и это видно в журнале.
 */
describe('ядовитый пост не запирает источник', () => {
  const errEntry = (postId: number | null) => ({ status: 'error' as const, postId, message: 'сбой' })

  it('пост, упавший меньше лимита раз, ещё не ядовит — разовый сбой не теряет пост', () => {
    const log = [errEntry(14), errEntry(14)]
    expect(poisonedVkPostIds(log, 3).has(14)).toBe(false)
  })

  it('пост, исчерпавший лимит попыток, признаётся ядовитым', () => {
    const log = [errEntry(14), errEntry(14), errEntry(14)]
    expect(poisonedVkPostIds(log, 3).has(14)).toBe(true)
  })

  it('падения РАЗНЫХ постов не складываются в общий счёт', () => {
    // Иначе три несвязанных сбоя подряд объявили бы ядовитым непричастный пост.
    const log = [errEntry(14), errEntry(15), errEntry(16)]
    expect(poisonedVkPostIds(log, 3).size).toBe(0)
  })

  it('записи журнала без postId и не-ошибки в счёт не идут', () => {
    const log = [
      errEntry(null),
      errEntry(null),
      errEntry(null),
      { status: 'no-new-posts' as const, postId: 14, message: '' },
      { status: 'success' as const, postId: 14, message: '' },
    ]
    expect(poisonedVkPostIds(log, 3).size).toBe(0)
  })

  it('ГЛАВНОЕ: исчерпавший попытки пост перешагивается, и берётся следующий', () => {
    // До фикса selectNextVkPost вернул бы 14 — и так на каждом прогоне вечно.
    const posts = [post(14, 'Ядовитый'), post(15, 'Годный')]
    const result = selectNextVkPost(posts, 13, new Set([14]))

    expect(result.post?.id).toBe(15)
  })

  it('пропуск ядовитого поста назван причиной, а не проглочен молча', () => {
    const posts = [post(14, 'Ядовитый'), post(15, 'Годный')]
    const result = selectNextVkPost(posts, 13, new Set([14]))

    expect(result.rejected).toEqual([{ id: 14, reason: 'исчерпан лимит попыток импорта' }])
  })

  it('без списка ядовитых поведение прежнее — контроль, что фикс ничего не сузил', () => {
    const posts = [post(14, 'Обычный'), post(15, 'Тоже обычный')]
    expect(selectNextVkPost(posts, 13).post?.id).toBe(14)
  })
})

/**
 * Тест на СЦЕПКУ двух функций, а не на каждую по отдельности.
 *
 * Фикс живёт не в `poisonedVkPostIds` и не в `selectNextVkPost`, а в контракте
 * между ними: журнал ошибок обязан нести `postId`, иначе счётчик не растёт и
 * лимит не срабатывает НИКОГДА — при формально правильных обеих функциях и
 * зелёных тестах на каждую. Здесь прогоняется полный цикл «упал → записал →
 * посчитал → перешагнул».
 */
describe('цикл прогонов: источник разблокируется сам', () => {
  const runOnce = (log: Array<{ status: string; postId: number | null }>, lastSyncedPostId: number) => {
    const posts = [post(14, 'Ядовитый'), post(15, 'Годный')]
    const selected = selectNextVkPost(posts, lastSyncedPostId, poisonedVkPostIds(log))
    // Имитируем прогон, который всегда падает на создании записи: курсор не
    // двигается, в журнал уходит запись об ошибке с id разобранного поста.
    if (selected.post?.id === 14) log.unshift({ status: 'error', postId: 14 })
    return selected.post?.id
  }

  it('после VK_MAX_IMPORT_ATTEMPTS падений очередь идёт дальше, а не стоит вечно', () => {
    const log: Array<{ status: string; postId: number | null }> = []

    const picks = [1, 2, 3, 4].map(() => runOnce(log, 13))

    // Первые VK_MAX_IMPORT_ATTEMPTS прогонов честно пробуют один и тот же пост…
    expect(picks.slice(0, VK_MAX_IMPORT_ATTEMPTS)).toEqual(Array(VK_MAX_IMPORT_ATTEMPTS).fill(14))
    // …а следующий уже перешагивает его и берёт то, что стояло за ним в очереди.
    expect(picks[VK_MAX_IMPORT_ATTEMPTS]).toBe(15)
  })

  it('если запись об ошибке потеряет postId — источник заперт навсегда', () => {
    // Контроль-негатив: он и объясняет, зачем `postId` в catch-ветке. Убери
    // его — и этот тест останется единственным, что заметит регрессию.
    const log: Array<{ status: string; postId: number | null }> = []
    const runWithoutPostId = () => {
      const posts = [post(14, 'Ядовитый'), post(15, 'Годный')]
      const selected = selectNextVkPost(posts, 13, poisonedVkPostIds(log))
      if (selected.post?.id === 14) log.unshift({ status: 'error', postId: null })
      return selected.post?.id
    }

    expect([1, 2, 3, 4, 5].map(runWithoutPostId)).toEqual([14, 14, 14, 14, 14])
  })
})

/**
 * Политика «нет пригодного текста».
 *
 * Решение владельца 2026-09-01 опирается на факт, а не на вкус: две записи
 * БЕЗ текста, пришедшие из ОДНОЙ группы, он отправил в разные проекты
 * («Похоже кончилось лето…» → Гоньба, «ОСТАЛОСЬ 3 МЕСТА» → Клуб). Значит такую
 * запись не разводит ни текст, ни источник, и правильный ответ машины —
 * «не знаю», а не догадка.
 */
describe('пригодность текста и нормализация правил', () => {
  it('длина считается по телу без пробелов', () => {
    expect(hasUsableVkText('ОСТАЛОСЬ 3 МЕСТА', 40)).toBe(false)
    expect(hasUsableVkText('   ', 1)).toBe(false)
    expect(hasUsableVkText('а'.repeat(40), 40)).toBe(true)
    expect(hasUsableVkText('а'.repeat(39), 40)).toBe(false)
  })

  it('пробелы не добирают длину', () => {
    // Иначе «а а а а а …» из десятка букв прошло бы как пригодный текст.
    expect(hasUsableVkText('а '.repeat(30), 40)).toBe(false)
  })

  it('порог 0 пропускает всё — выключаемая проверка, а не зашитая', () => {
    expect(hasUsableVkText('', 0)).toBe(true)
  })

  it('пустой и битый глобал выглядят как «правил нет», а не как ошибка', () => {
    for (const doc of [null, undefined, {}, { rules: 42, noTextPolicy: 'ерунда', minTextLength: 'много' }]) {
      const n = normalizeVkEditorial(doc)
      expect(n.rules).toBe('')
      expect(n.noTextPolicy).toBe('manual')
      expect(n.minTextLength).toBe(40)
      expect(n.enabled).toBe(true)
    }
  })

  it('правила читаются как есть, а пробельные — как пустые', () => {
    expect(normalizeVkEditorial({ rules: '  Пасека → Сельский туризм  ' }).rules).toBe('Пасека → Сельский туризм')
    expect(normalizeVkEditorial({ rules: '   ' }).rules).toBe('')
  })

  it('выключить правила можно только явным false', () => {
    expect(normalizeVkEditorial({ enabled: false }).enabled).toBe(false)
    expect(normalizeVkEditorial({ enabled: undefined }).enabled).toBe(true)
  })

  it('все три политики распознаются, посторонняя — нет', () => {
    expect(normalizeVkEditorial({ noTextPolicy: 'source' }).noTextPolicy).toBe('source')
    expect(normalizeVkEditorial({ noTextPolicy: 'skip' }).noTextPolicy).toBe('skip')
    expect(normalizeVkEditorial({ noTextPolicy: 'manual' }).noTextPolicy).toBe('manual')
    expect(normalizeVkEditorial({ noTextPolicy: 'publish-everything' }).noTextPolicy).toBe('manual')
  })
})
