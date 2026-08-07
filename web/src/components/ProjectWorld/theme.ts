import type { CSSProperties } from 'react'

import type { ProjectRecord } from '@/app/(frontend)/projects/shared'
import { hashString } from '@/components/Decor/shapes'

export type ProjectWorldKey = 'hospitality' | 'craft' | 'nature' | 'market'
export type ProjectSignature = 'round' | 'cut' | 'woven' | 'folio'

export type ProjectWorldTheme = {
  key: ProjectWorldKey
  eyebrow: string
  invitation: string
  art: string
  ink: string
  surface: string
  glow: string
  signature: ProjectSignature
}

const WORLDS: Record<ProjectWorldKey, Omit<ProjectWorldTheme, 'key' | 'signature'>> = {
  hospitality: {
    eyebrow: 'Остановиться · выдохнуть · погостить',
    invitation: 'Место, в которое входят сразу — без лишних дверей.',
    art: '/art/project-worlds/hospitality.webp',
    ink: '#183527',
    surface: '#efe2c6',
    glow: '#d39435',
  },
  craft: {
    eyebrow: 'Ремесло · мастерство · живой огонь',
    invitation: 'Загляните в мастерскую и посмотрите, чем она живёт сегодня.',
    art: '/art/project-worlds/craft.webp',
    ink: '#3d1d18',
    surface: '#ead0ad',
    glow: '#b84f28',
  },
  nature: {
    eyebrow: 'Маршрут · природа · открытие',
    invitation: 'Выберите направление — дальше путь раскрывается сам.',
    art: '/art/project-worlds/nature.webp',
    ink: '#163e3d',
    surface: '#dbe5df',
    glow: '#4d8881',
  },
  market: {
    eyebrow: 'Сделано здесь · выбрано с любовью',
    invitation: 'Люди, вещи и вкусы Малмыжской земли — в одном месте.',
    art: '/art/project-worlds/market.webp',
    ink: '#4c263d',
    surface: '#eee0c8',
    glow: '#8f496b',
  },
}

const PROJECT_ART: Record<string, string> = {
  'konnyy-klub-gmalyzh': '/art/editorial/horse-club-hero.webp',
  'sadovaya-feya-gulfiya-kharisovna': '/api/media/file/363',
}

export function resolveProjectWorld(project: ProjectRecord): ProjectWorldTheme {
  let key: ProjectWorldKey

  if (project.homepageGroup === 'stay') key = 'hospitality'
  else if (project.homepageGroup === 'shop' || project.kind === 'shop') key = 'market'
  else if (project.homepageGroup === 'do' || project.kind === 'studio' || project.kind === 'workshop') key = 'craft'
  else if (project.homepageGroup === 'see') key = 'nature'
  else {
    const fallback: ProjectWorldKey[] = ['nature', 'craft', 'hospitality', 'market']
    key = fallback[hashString(project.slug || String(project.id)) % fallback.length]
  }

  const signatures: ProjectSignature[] = ['round', 'cut', 'woven', 'folio']
  const signatureSeed = hashString(`${project.slug || project.id}-signature`)

  return {
    key,
    ...WORLDS[key],
    art: PROJECT_ART[project.slug || ''] || WORLDS[key].art,
    signature: signatures[signatureSeed % signatures.length],
  }
}

export function projectCoverArt(project: ProjectRecord): string | null {
  return PROJECT_ART[project.slug || ''] || null
}

export function projectWorldStyle(project: ProjectRecord, accent: string): CSSProperties {
  const world = resolveProjectWorld(project)
  return {
    '--project-world-art': `url("${world.art}")`,
    '--project-world-ink': world.ink,
    '--project-world-surface': world.surface,
    '--project-world-glow': accent || world.glow,
    '--project-card-radius': world.signature === 'round' ? '1.75rem' : world.signature === 'folio' ? '0.65rem' : '1.15rem',
  } as CSSProperties
}
