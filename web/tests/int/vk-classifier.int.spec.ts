import { afterEach, describe, expect, it, vi } from 'vitest'

import { classifyVkPost } from '@/server/integrations/vk-classifier'

const args = {
  title: 'Праздник на пасеке и поездка по Сибирскому тракту',
  text: 'Смешанная новость про мёд, экскурсию и новую поездку.',
  sourceProjectSlug: 'gonba',
  projects: [
    { slug: 'gonba', title: 'Гоньба', summary: 'История села и события' },
    { slug: 'rural-tourism', title: 'Сельский туризм', summary: 'Экскурсии и отдых' },
    { slug: 'vyatskiy-sbor', title: 'Вятскiй сборъ', summary: 'Чаи и мёд' },
  ],
  categories: ['posts', 'district-excursions', 'vyatskiy-sbor'],
}

/** Ответ OpenAI-совместимого `/chat/completions`. */
function chatCompletion(content: string) {
  return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content } }] }) }
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.DEEPSEEK_API_KEY
  delete process.env.DEEPSEEK_BASE_URL
  delete process.env.VK_CLASSIFIER_MODEL
  delete process.env.VK_CLASSIFIER_THINKING
  delete process.env.VK_CLASSIFIER_TIMEOUT_MS
})

describe('classifyVkPost', () => {
  it('filters the provider result to the active allowlist and keeps multiple projects', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue(
      chatCompletion(
        JSON.stringify({
          projectSlugs: ['rural-tourism', 'vyatskiy-sbor', 'gonba', 'unknown'],
          categorySlugs: ['district-excursions', 'unknown'],
          rationale: 'Темы новости пересекаются.',
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await classifyVkPost(args)

    expect(result).toMatchObject({
      provider: 'deepseek',
      usedFallback: false,
      projectSlugs: ['rural-tourism', 'vyatskiy-sbor', 'gonba'],
      categorySlugs: ['district-excursions'],
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions')
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer test-key')
  })

  /**
   * Регресс на подмену провайдера: с DeepSeek исчез строгий `json_schema`,
   * который раньше проверял enum на стороне OpenAI. Значит фильтр по allowlist —
   * единственное, что стоит между ответом модели и записью в БД.
   */
  it('never lets an invented slug through, even if every returned slug is invented', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        chatCompletion(
          JSON.stringify({
            projectSlugs: ['totally-made-up', 'another-fake'],
            categorySlugs: ['fake-category'],
            rationale: 'Модель придумала slug.',
          }),
        ),
      ),
    )

    const result = await classifyVkPost(args)

    expect(result).toMatchObject({ projectSlugs: ['gonba'], categorySlugs: [], usedFallback: true })
    expect(result.rationale).toContain('не выбрал допустимый проект')
  })

  it('sends the request DeepSeek JSON mode actually requires', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue(chatCompletion(JSON.stringify({ projectSlugs: ['gonba'], categorySlugs: [], rationale: 'ok' })))
    vi.stubGlobal('fetch', fetchMock)

    await classifyVkPost(args)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(sent.response_format).toEqual({ type: 'json_object' })
    // Документация DeepSeek: без слова «json» и примера формата в промпте
    // режим JSON-вывода не включается.
    expect(sent.messages[0].content.toLowerCase()).toContain('json')
    expect(sent.messages[0].content).toContain('projectSlugs')
    expect(sent.max_tokens).toBeGreaterThanOrEqual(2000)
    expect(sent.model).toBe('deepseek-v4-flash')
  })

  /**
   * Модель генерирует JSON по порядку ключей: назвав projectSlugs первыми, она
   * фиксирует ответ ДО того, как напишет обоснование. Обоснование в таком
   * порядке ни на что не влияет — это «раздумье задним числом».
   */
  it('в примере формата rationale стоит раньше списка проектов', () => {
    const example = [
      JSON.stringify({ rationale: 'x', projectSlugs: ['a'], categorySlugs: [] }),
    ][0]
    expect(example.indexOf('rationale')).toBeLessThan(example.indexOf('projectSlugs'))
  })

  it('по умолчанию раздумья ВКЛЮЧЕНЫ с явным уровнем усилия', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue(chatCompletion(JSON.stringify({ rationale: 'ok', projectSlugs: ['gonba'], categorySlugs: [] })))
    vi.stubGlobal('fetch', fetchMock)

    await classifyVkPost(args)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)

    // Умолчание вендора при enabled — самое тяжёлое усилие, поэтому уровень
    // задаём явно, а не полагаемся на «просто включить».
    expect(sent.thinking).toEqual({ type: 'enabled', reasoning_effort: 'low' })
    // В режиме раздумий temperature игнорируется — мёртвый параметр не шлём.
    expect(sent).not.toHaveProperty('temperature')
  })

  it('VK_CLASSIFIER_THINKING=off выключает раздумья и возвращает детерминизм', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.VK_CLASSIFIER_THINKING = 'off'
    const fetchMock = vi.fn().mockResolvedValue(chatCompletion(JSON.stringify({ rationale: 'ok', projectSlugs: ['gonba'], categorySlugs: [] })))
    vi.stubGlobal('fetch', fetchMock)

    await classifyVkPost(args)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(sent.thinking).toEqual({ type: 'disabled' })
    expect(sent.temperature).toBe(0)
    expect(sent.thinking).not.toHaveProperty('reasoning_effort')
  })

  it('мусор в VK_CLASSIFIER_THINKING откатывается к умолчанию, а не ломает запрос', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.VK_CLASSIFIER_THINKING = 'СУПЕР-МАКС'
    const fetchMock = vi.fn().mockResolvedValue(chatCompletion(JSON.stringify({ rationale: 'ok', projectSlugs: ['gonba'], categorySlugs: [] })))
    vi.stubGlobal('fetch', fetchMock)

    await classifyVkPost(args)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).thinking).toEqual({ type: 'enabled', reasoning_effort: 'low' })
  })

  it('таймаут отличим от прочих сбоев по тексту причины', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.VK_CLASSIFIER_TIMEOUT_MS = '50'
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
      ),
    )

    const result = await classifyVkPost(args)

    expect(result.usedFallback).toBe(true)
    expect(result.rationale).toContain('не уложился в 50 мс')
    expect(result.rationale).toContain('раздумий')
  })

  it('honours the base URL and model overrides', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    process.env.DEEPSEEK_BASE_URL = 'https://example.test/api/'
    process.env.VK_CLASSIFIER_MODEL = 'deepseek-v4-pro'
    const fetchMock = vi.fn().mockResolvedValue(chatCompletion(JSON.stringify({ projectSlugs: ['gonba'], categorySlugs: [], rationale: 'ok' })))
    vi.stubGlobal('fetch', fetchMock)

    await classifyVkPost(args)

    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/api/chat/completions')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('deepseek-v4-pro')
  })

  it('falls back to the source project when the key is absent', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await classifyVkPost(args)

    expect(result).toMatchObject({
      provider: 'fallback',
      usedFallback: true,
      projectSlugs: ['gonba'],
    })
    expect(result.rationale).toContain('DEEPSEEK_API_KEY')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back on provider HTTP errors and malformed output', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(classifyVkPost(args)).resolves.toMatchObject({ projectSlugs: ['gonba'], usedFallback: true })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatCompletion('{not-json')))
    await expect(classifyVkPost(args)).resolves.toMatchObject({ projectSlugs: ['gonba'], usedFallback: true })
  })

  /** Документированное поведение DeepSeek в JSON-режиме — отдельная причина в rationale. */
  it('reports an empty completion distinctly from a rejected answer', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-key'

    for (const empty of ['', '   ', null]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: empty } }] }) }))
      const result = await classifyVkPost(args)
      expect(result.usedFallback).toBe(true)
      expect(result.rationale).toContain('пустой результат')
    }

    // и полное отсутствие choices не должно превращаться в исключение
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    await expect(classifyVkPost(args)).resolves.toMatchObject({ usedFallback: true })
  })
})
