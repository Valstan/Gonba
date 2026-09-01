export type VkClassifierProject = {
  slug: string
  title: string
  summary?: string | null
}

export type VkClassification = {
  projectSlugs: string[]
  categorySlugs: string[]
  rationale: string
  provider: 'deepseek' | 'fallback'
  model: string | null
  usedFallback: boolean
}

type ClassifyArgs = {
  title: string
  text: string
  sourceProjectSlug: string
  projects: VkClassifierProject[]
  categories: string[]
  /**
   * Правила редакции из глобала `vkEditorialRules`, дословно. Пустая строка =
   * правил нет, промпт остаётся ровно таким, каким был до их появления.
   */
  rules?: string
}

/**
 * DeepSeek, OpenAI-совместимый `/chat/completions` (D-024).
 *
 * Про «переезд в три строки» из письма brain 2026-08-15: предусловие там было
 * «если классификатор сидит на @anthropic-ai/sdk» — тогда достаточно сменить
 * baseURL/ключ/модель. У нас SDK нет вообще, был сырой `fetch` к **Responses
 * API** OpenAI (`/v1/responses`), которого у DeepSeek нет. Поэтому переписаны
 * формирование запроса, разбор ответа и способ задания схемы.
 *
 * Базовый адрес — публичный вендорский эндпойнт, а не наша инфраструктура,
 * поэтому recon-предохранитель (`AGENTS.md`) на него не распространяется.
 */
const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-v4-flash'
/**
 * 30 с, а не 10. Прежние 10 были придуманы «на глаз» под экономию, которой нет:
 * реальная нагрузка — около одного поста в сутки, а systemd даёт на весь прогон
 * 600 с, из которых классификатор берёт максимум 60. Шесть источников × 30 с =
 * 180 с, запас на VK API и заливку фото остаётся. Выше 60 с не поднимать.
 */
const DEFAULT_TIMEOUT_MS = 30_000
/**
 * JSON-режим DeepSeek документированно рвёт ответ на полуслове при тесном лимите,
 * а входят ли токены раздумий в этот же лимит — в документации не сказано.
 * Пока не измерено живым запросом, держим запас: обрыв замаскировался бы под
 * обычную «ошибку классификатора».
 */
const MAX_OUTPUT_TOKENS = 2000
const MAX_PROJECTS = 3

/** off = раздумья выключены; остальное — уровень усилия DeepSeek. */
type ThinkingMode = 'off' | 'low' | 'high' | 'max'
const THINKING_MODES: ThinkingMode[] = ['off', 'low', 'high', 'max']

/**
 * Режим раздумий. Умолчание — `low`, то есть ВКЛЮЧЕНО с самым лёгким усилием.
 *
 * Почему не `off`: задача «выбрать 1-3 проекта из 11» на очевидных постах
 * решается и без раздумий, но на спорных (пост про ярмарку ремёсел в усадьбе —
 * это один проект или три?) отключение даёт «уплощение»: модель возвращает один
 * самый лексически очевидный проект, чаще всего исходный. Экономить при этом
 * не на чем — см. DEFAULT_TIMEOUT_MS.
 *
 * Почему не `high`: вендорское умолчание при `type: 'enabled'` — самое тяжёлое
 * усилие, то есть «просто включить» = включить максимум. Уровень задаём явно.
 *
 * Почему через env, а не константой: классификатор ещё ни разу не отработал на
 * живых данных (ключа на проде нет), значит настройку мы выбираем вслепую.
 * Цена ошибки должна быть «правка env + рестарт», а не «PR + деплой».
 */
function resolveThinking(): ThinkingMode {
  const raw = process.env.VK_CLASSIFIER_THINKING?.trim().toLowerCase()
  return THINKING_MODES.includes(raw as ThinkingMode) ? (raw as ThinkingMode) : 'low'
}

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

/** Текст ответа OpenAI-совместимого `/chat/completions`. */
function extractMessageText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const choices = (body as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null

  const message = (choices[0] as { message?: unknown }).message
  if (!message || typeof message !== 'object') return null

  const content = (message as { content?: unknown }).content
  if (typeof content !== 'string') return null

  const trimmed = content.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Единственная гарантия допустимости slug'ов.
 *
 * Раньше её дублировал строгий `json_schema` OpenAI: enum проверялся на стороне
 * провайдера, и этот фильтр был подстраховкой. У DeepSeek `json_object`
 * гарантирует только **синтаксически валидный JSON** — ни схемы, ни enum'ов.
 * Значит теперь ровно эта функция стоит между ответом модели и записью в БД:
 * ослабишь её — и в `relatedProjects` поедет выдуманный slug.
 */
function uniqueAllowed(values: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && allowed.has(value)))]
}

/**
 * Best-effort VK post routing. A missing key, provider error, malformed JSON,
 * or an out-of-allowlist answer never blocks the source synchronisation.
 */
export async function classifyVkPost(args: ClassifyArgs): Promise<VkClassification> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) return fallback(args, 'DEEPSEEK_API_KEY не настроен; оставлена привязка источника.')

  const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = process.env.VK_CLASSIFIER_MODEL?.trim() || DEFAULT_MODEL
  const timeoutMs = Number(process.env.VK_CLASSIFIER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  const thinking = resolveThinking()
  const projectSlugs = args.projects.map((project) => project.slug).filter(Boolean)
  const projectSet = new Set(projectSlugs)
  const categorySet = new Set(args.categories.filter(Boolean))
  if (!projectSet.has(args.sourceProjectSlug)) {
    projectSet.add(args.sourceProjectSlug)
    projectSlugs.push(args.sourceProjectSlug)
  }

  // Схема уезжает в промпт текстом: `json_object` её не принимает параметром.
  // Документация DeepSeek требует, чтобы слово «json» И пример формата были в
  // системном или пользовательском сообщении — без этого режим не включится.
  // Правила владельца идут ПОСЛЕ общей инструкции и ПЕРЕД форматом ответа:
  // они уточняют выбор проекта, но не должны спорить с требованием вернуть
  // json — иначе правка правил могла бы сломать разбор ответа целиком.
  //
  // Порядок частей стабилен и правила стоят ближе к концу не случайно: DeepSeek
  // кэширует совпадающий ПРЕФИКС запроса (письмо brain 2026-08-30), поэтому
  // неизменная шапка остаётся общей для всех прогонов, а меняется хвост.
  const editorialRules = (args.rules || '').trim()
  const systemPrompt = [
    'Ты редактор сайта ГОНЬБА. Классифицируй свежую публикацию VK по проектам сайта.',
    'Выбирай только действительно относящиеся проекты; один пост может относиться к нескольким.',
    'Не придумывай новые slug — бери значения только из allowedProjectSlugs и allowedCategorySlugs.',
    'Сельское хозяйство, туризм и ремёсла — приоритетные темы.',
    `Верни ровно один json-объект без markdown и пояснений, максимум ${MAX_PROJECTS} проекта.`,
    'Сначала одним предложением объясни выбор в поле rationale, и только потом перечисли slug.',
    ...(editorialRules
      ? ['Правила редакции сайта — они важнее общих соображений выше и имеют приоритет:', editorialRules]
      : []),
    'Формат ответа (пример), порядок ключей соблюдай:',
    JSON.stringify({
      rationale: 'Одно предложение о том, почему выбраны эти проекты.',
      projectSlugs: ['project-slug-1', 'project-slug-2'],
      categorySlugs: ['category-slug-1'],
    }),
  ].join(' ')

  const userPayload = {
    sourceProjectSlug: args.sourceProjectSlug,
    projects: args.projects,
    allowedProjectSlugs: [...projectSet],
    allowedCategorySlugs: [...categorySet],
    title: args.title,
    text: args.text.slice(0, 12_000),
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        response_format: { type: 'json_object' },
        ...(thinking === 'off'
          ? // Без раздумий ответ детерминирован — просим нулевую температуру.
            { thinking: { type: 'disabled' }, temperature: 0 }
          : // В режиме раздумий temperature документированно ИГНОРИРУЕТСЯ.
            // Не шлём его вовсе: мёртвый параметр в теле запроса врёт читателю
            // кода, будто прогоны воспроизводимы. Они не воспроизводимы.
            { thinking: { type: 'enabled', reasoning_effort: thinking } }),
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: controller.signal,
    })
    if (!response.ok) return fallback(args, `DeepSeek ответил HTTP ${response.status}; оставлена привязка источника.`)

    const body = (await response.json()) as unknown
    const outputText = extractMessageText(body)
    // Пустой content в JSON-режиме — известное поведение DeepSeek, не наша
    // ошибка разбора. Отдельная причина в rationale, чтобы это было видно
    // в админке и отличалось от «модель не выбрала проект».
    if (!outputText) return fallback(args, 'DeepSeek вернул пустой результат; оставлена привязка источника.')

    const parsed = JSON.parse(outputText) as { projectSlugs?: unknown; categorySlugs?: unknown; rationale?: unknown }
    const selectedProjects = uniqueAllowed(parsed.projectSlugs, projectSet).slice(0, MAX_PROJECTS)
    if (selectedProjects.length === 0) return fallback(args, 'DeepSeek не выбрал допустимый проект; оставлена привязка источника.')

    return {
      projectSlugs: selectedProjects,
      categorySlugs: uniqueAllowed(parsed.categorySlugs, categorySet),
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 300) : 'Классификация выполнена.',
      provider: 'deepseek',
      model,
      usedFallback: false,
    }
  } catch (error) {
    // Таймаут отделяем от прочих сбоев намеренно: на живых данных именно это
    // различие решает, что чинить — поднимать лимит времени или разбираться с
    // провайдером. В общем catch они выглядели одинаково.
    if (error instanceof Error && error.name === 'AbortError') {
      return fallback(args, `Классификатор не уложился в ${timeoutMs} мс (режим раздумий: ${thinking}); оставлена привязка источника.`)
    }
    const message = error instanceof Error ? error.message : String(error)
    return fallback(args, `Ошибка классификатора (${message.slice(0, 120)}); оставлена привязка источника.`)
  } finally {
    clearTimeout(timeout)
  }
}
