export type VkClassifierProject = {
  slug: string
  title: string
  summary?: string | null
}

export type VkClassification = {
  projectSlugs: string[]
  categorySlugs: string[]
  rationale: string
  provider: 'openai' | 'fallback'
  model: string | null
  usedFallback: boolean
}

type ClassifyArgs = {
  title: string
  text: string
  sourceProjectSlug: string
  projects: VkClassifierProject[]
  categories: string[]
}

const DEFAULT_MODEL = 'gpt-5-mini'
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_PROJECTS = 3

function fallback(args: ClassifyArgs, rationale: string): VkClassification {
  return {
    projectSlugs: [args.sourceProjectSlug],
    categorySlugs: [],
    rationale,
    provider: 'fallback',
    model: null,
    usedFallback: true,
  }
}

function extractOutputText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as { output_text?: unknown; output?: unknown }
  if (typeof record.output_text === 'string') return record.output_text
  if (!Array.isArray(record.output)) return null

  for (const item of record.output) {
    if (!item || typeof item !== 'object') continue
    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const text = (part as { text?: unknown }).text
      if (typeof text === 'string') return text
    }
  }
  return null
}

function uniqueAllowed(values: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && allowed.has(value)))]
}

/**
 * Best-effort VK post routing. A missing key, provider error, malformed JSON,
 * or an out-of-allowlist answer never blocks the source synchronisation.
 */
export async function classifyVkPost(args: ClassifyArgs): Promise<VkClassification> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return fallback(args, 'OPENAI_API_KEY не настроен; оставлена привязка источника.')

  const model = process.env.VK_CLASSIFIER_MODEL?.trim() || DEFAULT_MODEL
  const timeoutMs = Number(process.env.VK_CLASSIFIER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  const projectSlugs = args.projects.map((project) => project.slug).filter(Boolean)
  const projectSet = new Set(projectSlugs)
  const categorySet = new Set(args.categories.filter(Boolean))
  if (!projectSet.has(args.sourceProjectSlug)) {
    projectSet.add(args.sourceProjectSlug)
    projectSlugs.push(args.sourceProjectSlug)
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      projectSlugs: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_PROJECTS,
        items: { type: 'string', enum: [...projectSet] },
      },
      categorySlugs: {
        type: 'array',
        maxItems: 4,
        items: { type: 'string', enum: [...categorySet] },
      },
      rationale: { type: 'string', maxLength: 300 },
    },
    required: ['projectSlugs', 'categorySlugs', 'rationale'],
  }

  const systemPrompt = [
    'Ты редактор сайта ГОНЬБА. Классифицируй свежую публикацию VK по проектам сайта.',
    'Выбирай только действительно относящиеся проекты; один пост может относиться к нескольким.',
    'Не придумывай новые slug. Сельское хозяйство, туризм и ремесла — приоритетные темы.',
    'Верни только JSON по предоставленной схеме, без markdown.',
  ].join(' ')
  const userPayload = {
    sourceProjectSlug: args.sourceProjectSlug,
    projects: args.projects,
    allowedCategorySlugs: [...categorySet],
    title: args.title,
    text: args.text.slice(0, 12_000),
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(userPayload) }] },
        ],
        text: { format: { type: 'json_schema', name: 'vk_post_classification', strict: true, schema } },
        max_output_tokens: 400,
      }),
      signal: controller.signal,
    })
    if (!response.ok) return fallback(args, `OpenAI ответил HTTP ${response.status}; оставлена привязка источника.`)

    const body = (await response.json()) as unknown
    const outputText = extractOutputText(body)
    if (!outputText) return fallback(args, 'OpenAI вернул пустой результат; оставлена привязка источника.')

    const parsed = JSON.parse(outputText) as { projectSlugs?: unknown; categorySlugs?: unknown; rationale?: unknown }
    const selectedProjects = uniqueAllowed(parsed.projectSlugs, projectSet).slice(0, MAX_PROJECTS)
    if (selectedProjects.length === 0) return fallback(args, 'OpenAI не выбрал допустимый проект; оставлена привязка источника.')

    return {
      projectSlugs: selectedProjects,
      categorySlugs: uniqueAllowed(parsed.categorySlugs, categorySet),
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 300) : 'Классификация выполнена.',
      provider: 'openai',
      model,
      usedFallback: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fallback(args, `Ошибка классификатора (${message.slice(0, 120)}); оставлена привязка источника.`)
  } finally {
    clearTimeout(timeout)
  }
}

