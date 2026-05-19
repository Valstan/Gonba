/**
 * Скрипт миграции: переводит enabledSections проектов с легаси-ключей (posts/events/services/shop)
 * на новые (feed/lavka). Идемпотентный — можно гонять повторно.
 *
 * Запуск:
 *   cd web && tsx scripts/migrate-enabled-sections.ts
 *
 * После прогонки локально/на проде legacy-значения уходят из БД, и фронт работает без runtime-маппинга.
 */
import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

const LEGACY_TO_NEW: Record<string, string> = {
  posts: 'feed',
  events: 'feed',
  services: 'lavka',
  shop: 'lavka',
}

function normalize(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const key = LEGACY_TO_NEW[item] || item
    if (!seen.has(key)) {
      seen.add(key)
      result.push(key)
    }
  }
  return result
}

async function main() {
  const payload = await getPayload({ config: configPromise })
  console.log('🔄 Миграция enabledSections в коллекции projects...')

  const result = await payload.find({
    collection: 'projects',
    limit: 1000,
    overrideAccess: true,
    depth: 0,
  })

  let changed = 0
  let untouched = 0
  for (const project of result.docs) {
    const before = Array.isArray(project.enabledSections) ? [...project.enabledSections] : []
    const after = normalize(before)
    const same = before.length === after.length && before.every((v, i) => v === after[i])
    if (same) {
      untouched++
      continue
    }
    await payload.update({
      collection: 'projects',
      id: project.id,
      data: { enabledSections: after as never },
      overrideAccess: true,
    })
    changed++
    console.log(`  ✓ ${project.slug ?? project.id}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`)
  }

  console.log(`✅ Готово. Изменено: ${changed}, без изменений: ${untouched}.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
