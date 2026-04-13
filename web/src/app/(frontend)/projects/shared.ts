import type { Project } from '@/payload-types'

export type ProjectSectionKey = 'posts' | 'events' | 'services' | 'shop' | 'gallery' | 'contacts'

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
>

export const DEFAULT_PROJECT_SECTIONS: ProjectSectionKey[] = ['posts', 'events', 'services', 'shop', 'gallery', 'contacts']
