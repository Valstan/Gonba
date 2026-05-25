import Link from 'next/link'
import React from 'react'

import type { ProjectRecord } from '@/app/(frontend)/projects/shared'

type GroupKey = 'stay' | 'do' | 'see' | 'shop'

interface GroupSpec {
  key: GroupKey
  title: string
  modifier: string
}

const GROUPS: GroupSpec[] = [
  { key: 'stay', title: 'Пожить', modifier: 'ethno-group-card--stay' },
  { key: 'do', title: 'Делать', modifier: 'ethno-group-card--do' },
  { key: 'see', title: 'Смотреть', modifier: 'ethno-group-card--see' },
  { key: 'shop', title: 'Купить', modifier: 'ethno-group-card--shop' },
]

interface EthnoGroupCardsProps {
  projects: ProjectRecord[]
}

/**
 * 4 этно-карточки на главной (Пожить · Делать · Смотреть · Купить).
 * Подпись каждой — короткий summary по проектам этой группы (либо хардкод-fallback).
 *
 * Источник: docs/design/handoff-2026-05-23/gonba-home.html строки 354-392 + 842-867.
 */
export const EthnoGroupCards: React.FC<EthnoGroupCardsProps> = ({ projects }) => {
  const projectsByGroup = new Map<GroupKey, ProjectRecord[]>()
  for (const p of projects) {
    const g = p.homepageGroup
    if (g === 'stay' || g === 'do' || g === 'see' || g === 'shop') {
      const arr = projectsByGroup.get(g) ?? []
      arr.push(p)
      projectsByGroup.set(g, arr)
    }
  }

  const groupSubtitle = (key: GroupKey): string => {
    const list = projectsByGroup.get(key) ?? []
    if (list.length === 0) {
      // Fallback'и из handoff'а — если данных нет, показываем дефолтные подписи.
      return {
        stay: '6 номеров над Вяткой',
        do: '4 мастерские, экскурсии, кони',
        see: 'село, храм, люди, события',
        shop: 'травы, иван-чай, мёд',
      }[key]
    }
    const DEFAULT_SHORT_LABEL = 'Проект'
    const projectLabel = (p: ProjectRecord): string =>
      p.shortLabel && p.shortLabel !== DEFAULT_SHORT_LABEL ? p.shortLabel : p.title
    const titles = list
      .map(projectLabel)
      .filter((t): t is string => Boolean(t))
      .slice(0, 3)
    return titles.join(' · ')
  }

  return (
    <section className="ethno-groups">
      <div className="container">
        <div className="ethno-groups__divider">
          <span className="ethno-rhomb" style={{ color: 'var(--ochre)' }} aria-hidden="true" />
        </div>
        <div className="ethno-groups__grid">
          {GROUPS.map((g) => (
            <Link
              key={g.key}
              href={`/projects?group=${g.key}`}
              className={`ethno-group-card ${g.modifier}`}
            >
              <span className="ethno-rhomb" aria-hidden="true" />
              <h3>{g.title}</h3>
              <p>{groupSubtitle(g.key)}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
