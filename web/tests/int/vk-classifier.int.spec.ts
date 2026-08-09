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

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.OPENAI_API_KEY
  delete process.env.VK_CLASSIFIER_MODEL
})

describe('classifyVkPost', () => {
  it('filters the provider result to the active allowlist and keeps multiple projects', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          projectSlugs: ['rural-tourism', 'vyatskiy-sbor', 'gonba', 'unknown'],
          categorySlugs: ['district-excursions', 'unknown'],
          rationale: 'Темы новости пересекаются.',
        }),
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await classifyVkPost(args)

    expect(result).toMatchObject({
      provider: 'openai',
      usedFallback: false,
      projectSlugs: ['rural-tourism', 'vyatskiy-sbor', 'gonba'],
      categorySlugs: ['district-excursions'],
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer test-key')
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
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back on provider HTTP errors and malformed output', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(classifyVkPost(args)).resolves.toMatchObject({ projectSlugs: ['gonba'], usedFallback: true })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ output_text: '{not-json' }),
      }),
    )
    await expect(classifyVkPost(args)).resolves.toMatchObject({ projectSlugs: ['gonba'], usedFallback: true })
  })
})

