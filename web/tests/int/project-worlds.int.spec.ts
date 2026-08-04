import { describe, expect, it } from 'vitest'

import type { ProjectRecord } from '@/app/(frontend)/projects/shared'
import { resolveProjectWorld } from '@/components/ProjectWorld/theme'

const project = (fields: Partial<ProjectRecord>): ProjectRecord =>
  ({ id: 1, title: 'Проект', slug: 'project', ...fields }) as ProjectRecord

describe('project worlds', () => {
  it('maps homepage groups to semantic art profiles', () => {
    expect(resolveProjectWorld(project({ homepageGroup: 'stay' })).key).toBe('hospitality')
    expect(resolveProjectWorld(project({ homepageGroup: 'do' })).key).toBe('craft')
    expect(resolveProjectWorld(project({ homepageGroup: 'see' })).key).toBe('nature')
    expect(resolveProjectWorld(project({ homepageGroup: 'shop' })).key).toBe('market')
  })

  it('uses project kind when a group is absent', () => {
    expect(resolveProjectWorld(project({ kind: 'workshop' })).key).toBe('craft')
    expect(resolveProjectWorld(project({ kind: 'shop' })).key).toBe('market')
  })

  it('keeps fallback deterministic for the same slug', () => {
    const first = resolveProjectWorld(project({ slug: 'unknown-project' }))
    const second = resolveProjectWorld(project({ slug: 'unknown-project' }))
    expect(second).toEqual(first)
    expect(first.art).toMatch(/^\/art\/project-worlds\/.+\.webp$/)
  })
})
