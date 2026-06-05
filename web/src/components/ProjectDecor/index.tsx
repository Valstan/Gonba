import type { CSSProperties } from 'react'

import { DecorSpots, hashString, pickTheme, type DecorMotif } from '../Decor/shapes'

/**
 * ProjectDecor — арт-декор страницы проекта (accent-смывка + узоры по мотиву).
 * Цвет и мотивы — из данных проекта (accentColor/decorMotif) или детерминированно
 * по slug. Рендерится absolute внутри изолированного контекста layout проекта.
 */

export type { DecorMotif } from '../Decor/shapes'

/** Совместимость со старым API: accent для --project-accent в layout. */
export function resolveProjectTheme(
  slug: string,
  accentColor?: string | null,
  decorMotif?: DecorMotif | null,
): { accent: string } {
  const { accent } = pickTheme(hashString(slug || 'gonba'), accentColor, decorMotif)
  return { accent }
}

export function ProjectDecor({
  slug,
  accentColor,
  decorMotif,
}: {
  slug: string
  accentColor?: string | null
  decorMotif?: DecorMotif | null
}) {
  const { accent, primary, secondary, none } = pickTheme(hashString(slug || 'gonba'), accentColor, decorMotif)
  if (none) {
    return <div className="project-decor" style={{ '--project-accent': accent } as CSSProperties} aria-hidden />
  }
  return (
    <div className="project-decor" data-motif={primary} style={{ '--project-accent': accent } as CSSProperties} aria-hidden>
      <DecorSpots primary={primary} secondary={secondary} />
    </div>
  )
}
