import type { Project } from '@/payload-types'

export type ProjectSectionKey = 'feed' | 'lavka' | 'gallery' | 'contacts' | 'chat'
export type LegacyProjectSectionKey = 'posts' | 'events' | 'services' | 'shop'
export type AnyProjectSectionKey = ProjectSectionKey | LegacyProjectSectionKey

export type ProjectRecord = Pick<
  Project,
  | 'id'
  | 'title'
  | 'slug'
  | 'shortLabel'
  | 'summary'
  | 'description'
  | 'heroImage'
  | 'gallery'
  | 'location'
  | 'contacts'
  | 'accentColor'
  | 'logo'
  | 'enabledSections'
  | 'sortOrder'
  | 'galleryYandexFolder'
  | 'chat'
>

export const DEFAULT_PROJECT_SECTIONS: ProjectSectionKey[] = ['feed', 'lavka', 'gallery', 'contacts', 'chat']

const LEGACY_TO_NEW: Record<LegacyProjectSectionKey, ProjectSectionKey> = {
  posts: 'feed',
  events: 'feed',
  services: 'lavka',
  shop: 'lavka',
}

const VALID_NEW_KEYS = new Set<ProjectSectionKey>(['feed', 'lavka', 'gallery', 'contacts', 'chat'])

/**
 * Преобразует enabledSections из БД в современный формат:
 * - legacy ключи (posts/events/services/shop) → feed/lavka
 * - дедуплицирует и сохраняет порядок
 * - фильтрует мусорные значения
 *
 * Если входной массив пуст или невалиден — возвращает DEFAULT_PROJECT_SECTIONS.
 */
export function normalizeSections(raw: Array<string | null> | null | undefined): ProjectSectionKey[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PROJECT_SECTIONS
  }

  const seen = new Set<ProjectSectionKey>()
  const result: ProjectSectionKey[] = []

  for (const item of raw) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (!trimmed) continue

    let key: ProjectSectionKey | null = null
    if (VALID_NEW_KEYS.has(trimmed as ProjectSectionKey)) {
      key = trimmed as ProjectSectionKey
    } else if (trimmed in LEGACY_TO_NEW) {
      key = LEGACY_TO_NEW[trimmed as LegacyProjectSectionKey]
    }
    if (key && !seen.has(key)) {
      seen.add(key)
      result.push(key)
    }
  }

  return result.length > 0 ? result : DEFAULT_PROJECT_SECTIONS
}
