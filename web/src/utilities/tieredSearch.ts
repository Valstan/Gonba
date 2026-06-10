/**
 * Универсальный многоуровневый поиск для admin/операторских полей (pool #035).
 *
 * Уровни (каждый следующий пробуется только если предыдущий не дал совпадений):
 *   1 — substring: каждый токен запроса встречается подряд в любом месте строки;
 *   2 — subsequence: буквы токена встречаются в строке в нужном порядке (с разрывами);
 *   3 — fuzzy: токен совпадает с каким-нибудь словом строки с 1–2 опечатками
 *       (ограниченный Левенштейн).
 *
 * Плюс: многотокенный AND, нормализация (lowercase, ё→е), «номерная» нормализация
 * (токен из цифр с разделителями ищется по цифрам строки), RU↔EN раскладка
 * (запрос «ujym» найдёт «гонь»), диапазоны для подсветки совпадений уровня 1.
 *
 * НЕ для публичного /search — там Postgres FTS (стемминг, ранжирование), это
 * другой класс задач и он не регрессируется (см. директиву brain 2026-06-09).
 */

export type TieredTier = 1 | 2 | 3

export type TieredResult<T> = {
  item: T
  tier: TieredTier
  /** Меньше = лучше (внутри одного tier). */
  score: number
  /** Диапазоны [start, end) в исходном тексте для подсветки. Только tier 1. */
  ranges: Array<[number, number]>
}

/** Пары клавиш QWERTY ↔ ЙЦУКЕН (нижний регистр, позиции 1:1). */
const EN_KEYS = `qwertyuiop[]asdfghjkl;'zxcvbnm,.`
const RU_KEYS = `йцукенгшщзхъфывапролджэячсмитьбю`

const EN_TO_RU = new Map<string, string>()
const RU_TO_EN = new Map<string, string>()
for (let i = 0; i < EN_KEYS.length; i++) {
  EN_TO_RU.set(EN_KEYS[i], RU_KEYS[i])
  RU_TO_EN.set(RU_KEYS[i], EN_KEYS[i])
}

/** lowercase + ё→е. Длину строки не меняет — диапазоны остаются валидными. */
export const normalizeForSearch = (s: string): string => s.toLowerCase().replace(/ё/g, 'е')

/** Перебивка раскладки: каждый символ переводится EN→RU или RU→EN, остальные как есть. */
export const switchKeyboardLayout = (s: string): string => {
  let out = ''
  for (const ch of s) {
    out += EN_TO_RU.get(ch) ?? RU_TO_EN.get(ch) ?? ch
  }
  return out
}

const onlyDigits = (s: string): string => s.replace(/\D+/g, '')

/** Токен «номерного» вида: цифры с разделителями (-, _, пробел, точка, скобки). */
const isNumericLike = (token: string): boolean => /^[\d\s\-_.()+/]*\d[\d\s\-_.()+/]*$/.test(token)

/** Subsequence: буквы token встречаются в text в нужном порядке. Возвращает разброс или null. */
const subsequenceSpread = (text: string, token: string): number | null => {
  let ti = 0
  let first = -1
  let last = -1
  for (let i = 0; i < text.length && ti < token.length; i++) {
    if (text[i] === token[ti]) {
      if (first === -1) first = i
      last = i
      ti++
    }
  }
  if (ti < token.length) return null
  return last - first + 1 - token.length // 0 = подряд (это и есть substring)
}

/** Ограниченный Левенштейн: точная дистанция, либо maxDist+1 если порог превышен. */
export const boundedLevenshtein = (a: string, b: string, maxDist: number): number => {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (cur[j] < rowMin) rowMin = cur[j]
    }
    if (rowMin > maxDist) return maxDist + 1
    prev = cur
  }
  return prev[b.length]
}

const fuzzyThreshold = (token: string): number => (token.length <= 4 ? 1 : 2)

type TokenMatch = { tier: TieredTier; score: number; range?: [number, number] }

/** Лучшее совпадение одного токена в нормализованном тексте, или null. */
const matchToken = (normText: string, textWords: string[], token: string): TokenMatch | null => {
  // Уровень 1 — substring в любом месте
  const idx = normText.indexOf(token)
  if (idx !== -1) {
    return { tier: 1, score: idx, range: [idx, idx + token.length] }
  }
  // Уровень 1' — «номерная» нормализация: 229 392 → найдёт wall-229392127
  if (isNumericLike(token)) {
    const tokenDigits = onlyDigits(token)
    if (tokenDigits.length >= 2 && onlyDigits(normText).includes(tokenDigits)) {
      return { tier: 1, score: normText.length }
    }
  }
  if (token.length < 2) return null
  // Уровень 2 — subsequence
  const spread = subsequenceSpread(normText, token)
  if (spread !== null) {
    return { tier: 2, score: spread }
  }
  // Уровень 3 — fuzzy по словам
  const maxDist = fuzzyThreshold(token)
  let best = maxDist + 1
  for (const word of textWords) {
    const d = boundedLevenshtein(word, token, maxDist)
    if (d < best) best = d
    if (best === 0) break
  }
  if (best <= maxDist) {
    return { tier: 3, score: best * 100 }
  }
  return null
}

/** Совпадение всех токенов (AND) одного варианта запроса против текста. */
const matchTokens = (
  normText: string,
  textWords: string[],
  tokens: string[],
): { tier: TieredTier; score: number; ranges: Array<[number, number]> } | null => {
  let worstTier: TieredTier = 1
  let score = 0
  const ranges: Array<[number, number]> = []
  for (const token of tokens) {
    const m = matchToken(normText, textWords, token)
    if (!m) return null
    if (m.tier > worstTier) worstTier = m.tier
    score += m.score
    if (m.range) ranges.push(m.range)
  }
  // Подсветку показываем только когда ВСЁ совпало точно (tier 1) — иначе диапазоны вводят в заблуждение
  return { tier: worstTier, score, ranges: worstTier === 1 ? ranges : [] }
}

const splitWords = (normText: string): string[] => normText.split(/[^a-zа-я0-9]+/).filter(Boolean)

/**
 * Многоуровневый поиск по списку элементов.
 *
 * Запрос пробуется в двух вариантах — как введён и в перебитой раскладке — берётся
 * лучший. Результаты отсортированы: tier ↑, score ↑, исходный порядок (стабильно).
 * Пустой/короткий запрос — забота вызывающего (debounce + min-chars там же).
 */
export function tieredSearch<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
): Array<TieredResult<T>> {
  const normQuery = normalizeForSearch(query).trim()
  if (!normQuery) return []

  const variants: string[][] = [normQuery.split(/\s+/)]
  const switched = switchKeyboardLayout(normQuery)
  if (switched !== normQuery) variants.push(switched.split(/\s+/))

  const results: Array<TieredResult<T> & { index: number }> = []
  items.forEach((item, index) => {
    const normText = normalizeForSearch(getText(item))
    const textWords = splitWords(normText)
    let best: ReturnType<typeof matchTokens> = null
    for (const tokens of variants) {
      const m = matchTokens(normText, textWords, tokens)
      if (m && (!best || m.tier < best.tier || (m.tier === best.tier && m.score < best.score))) {
        best = m
      }
    }
    if (best) results.push({ item, index, ...best })
  })

  results.sort((a, b) => a.tier - b.tier || a.score - b.score || a.index - b.index)
  return results.map(({ index: _index, ...rest }) => rest)
}

/** Сегменты текста для подсветки: ranges → чередование обычных и `hit`-кусков. */
export function buildHighlightSegments(
  text: string,
  ranges: Array<[number, number]>,
): Array<{ text: string; hit: boolean }> {
  if (ranges.length === 0) return [{ text, hit: false }]
  // слить пересекающиеся диапазоны
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [start, end] of sorted) {
    const lastRange = merged[merged.length - 1]
    if (lastRange && start <= lastRange[1]) {
      lastRange[1] = Math.max(lastRange[1], end)
    } else {
      merged.push([start, end])
    }
  }
  const segments: Array<{ text: string; hit: boolean }> = []
  let pos = 0
  for (const [start, end] of merged) {
    if (start > pos) segments.push({ text: text.slice(pos, start), hit: false })
    segments.push({ text: text.slice(start, end), hit: true })
    pos = end
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), hit: false })
  return segments
}
