import type { CSSProperties, ReactElement } from 'react'

/**
 * ProjectDecor — ненавязчивый фоновый арт-декор страницы проекта.
 *
 * Рендерит фиксированный слой-«обои» (z-index:-1, pointer-events:none) поверх
 * общего фона сайта, но под контентом: лёгкая accent-смывка + декоративные
 * SVG-мотивы по углам. Цель — «красивый минимализм»: каждый проект узнаваемо
 * свой по цвету и мотиву, но декор не перетягивает внимание с контента
 * (низкая прозрачность, мягкие формы, без анимации).
 *
 * Server component — чистый SVG, без клиентского JS.
 */

export type DecorMotif = 'auto' | 'floral' | 'vines' | 'lines' | 'geometric' | 'waves' | 'none'

const RENDERABLE: Exclude<DecorMotif, 'auto' | 'none'>[] = [
  'floral',
  'vines',
  'lines',
  'geometric',
  'waves',
]

/** Этно-палитра accent'ов, читаемых на «бумажном» фоне (--paper #ede3cf). */
const ACCENT_PALETTE = [
  '#2d4029', // лесной
  '#a86a1d', // охра
  '#6e2018', // охра-кровь (oxblood)
  '#5a6b35', // олива
  '#2f6360', // речной тил
  '#6a3d5b', // сливовый
  '#34506e', // вятская синь
]

/** Детерминированный хэш строки → неотрицательное число (FNV-1a-ish). */
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Разрешить тему проекта: accent (HEX) + мотив.
 * - accent: явный `accentColor` или подбор из палитры по slug.
 * - motif: явный `decorMotif`; 'auto' → детерминированно по slug; 'none' → null.
 */
export function resolveProjectTheme(
  slug: string,
  accentColor?: string | null,
  decorMotif?: DecorMotif | null,
): { accent: string; motif: Exclude<DecorMotif, 'auto'> } {
  const seed = hashString(slug || 'gonba')

  const accent =
    typeof accentColor === 'string' && accentColor.trim().length > 0
      ? accentColor.trim()
      : ACCENT_PALETTE[seed % ACCENT_PALETTE.length]

  let motif: Exclude<DecorMotif, 'auto'>
  if (decorMotif === 'none') {
    motif = 'none'
  } else if (decorMotif && decorMotif !== 'auto' && RENDERABLE.includes(decorMotif)) {
    motif = decorMotif
  } else {
    // 'auto' / пусто → выбор мотива по другому биту хэша (чтобы не коррелировал с цветом).
    // ВАЖНО: беззнаковый сдвиг >>> — знаковый >> при seed > 2^31 даёт отрицательный индекс.
    motif = RENDERABLE[(seed >>> 3) % RENDERABLE.length]
  }

  return { accent, motif }
}

/* ── SVG-мотивы (каждый использует currentColor; цвет/прозрачность задаёт слой) ── */

function Flower({ x, y, r }: { x: number; y: number; r: number }) {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2
    return <ellipse key={i} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r} rx={r * 0.62} ry={r * 0.32} transform={`rotate(${(a * 180) / Math.PI + 90} ${x + Math.cos(a) * r} ${y + Math.sin(a) * r})`} />
  })
  return (
    <g fill="currentColor">
      {petals}
      <circle cx={x} cy={y} r={r * 0.4} />
    </g>
  )
}

function FloralMotif() {
  return (
    <>
      <svg className="project-decor__corner project-decor__tr" viewBox="0 0 200 200" aria-hidden>
        <Flower x={150} y={48} r={26} />
        <Flower x={92} y={96} r={16} />
        <Flower x={168} y={120} r={12} />
      </svg>
      <svg className="project-decor__corner project-decor__bl" viewBox="0 0 200 200" aria-hidden>
        <Flower x={52} y={150} r={24} />
        <Flower x={108} y={108} r={14} />
        <Flower x={30} y={86} r={11} />
      </svg>
    </>
  )
}

function VinesMotif() {
  const scroll = 'M10 190 C 10 120, 70 120, 70 70 S 130 30, 150 70 C 165 100, 120 120, 110 95 C 104 80, 124 72, 130 86'
  return (
    <>
      <svg className="project-decor__corner project-decor__tr project-decor__flip" viewBox="0 0 200 200" aria-hidden>
        <path d={scroll} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        <circle cx={130} cy={86} r={4} fill="currentColor" />
      </svg>
      <svg className="project-decor__corner project-decor__bl" viewBox="0 0 200 200" aria-hidden>
        <path d={scroll} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
        <circle cx={130} cy={86} r={4} fill="currentColor" />
      </svg>
    </>
  )
}

function LinesMotif() {
  const rays = (cx: number, cy: number) =>
    Array.from({ length: 7 }, (_, i) => {
      const a = (i / 6) * (Math.PI / 2)
      return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * 175} y2={cy + Math.sin(a) * 175} stroke="currentColor" strokeWidth={1.4} />
    })
  return (
    <>
      <svg className="project-decor__corner project-decor__tr project-decor__flip" viewBox="0 0 200 200" aria-hidden>
        <g>{rays(0, 0)}</g>
      </svg>
      <svg className="project-decor__corner project-decor__bl" viewBox="0 0 200 200" aria-hidden>
        <g>{rays(0, 0)}</g>
      </svg>
    </>
  )
}

function GeometricMotif() {
  const diamonds = Array.from({ length: 6 }, (_, i) => {
    const s = 18 + i * 14
    return <rect key={i} x={100 - s / 2} y={100 - s / 2} width={s} height={s} transform={`rotate(45 100 100)`} fill="none" stroke="currentColor" strokeWidth={1.6} />
  })
  const chevrons = Array.from({ length: 8 }, (_, i) => (
    <path key={i} d={`M${i * 26} 14 l13 -12 l13 12`} fill="none" stroke="currentColor" strokeWidth={1.6} />
  ))
  return (
    <>
      <svg className="project-decor__corner project-decor__tr" viewBox="0 0 200 200" aria-hidden>
        <g>{diamonds}</g>
      </svg>
      <svg className="project-decor__band project-decor__bottom" viewBox="0 0 220 18" preserveAspectRatio="none" aria-hidden>
        <g>{chevrons}</g>
      </svg>
    </>
  )
}

function WavesMotif() {
  const wave = (yOff: number) => {
    let d = `M0 ${40 + yOff}`
    for (let x = 0; x <= 200; x += 50) {
      d += ` q 25 -16 50 0`
    }
    return d
  }
  return (
    <svg className="project-decor__band project-decor__bottom project-decor__waves" viewBox="0 0 200 90" preserveAspectRatio="none" aria-hidden>
      {[0, 16, 32].map((y) => (
        <path key={y} d={wave(y)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      ))}
    </svg>
  )
}

const MOTIF_RENDERERS: Record<Exclude<DecorMotif, 'auto' | 'none'>, () => ReactElement> = {
  floral: FloralMotif,
  vines: VinesMotif,
  lines: LinesMotif,
  geometric: GeometricMotif,
  waves: WavesMotif,
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
  const { accent, motif } = resolveProjectTheme(slug, accentColor, decorMotif)
  if (motif === 'none') {
    // Только мягкая accent-смывка, без рисунков.
    return <div className="project-decor" style={{ '--project-accent': accent } as CSSProperties} aria-hidden />
  }
  const Motif = MOTIF_RENDERERS[motif]
  return (
    <div className="project-decor" data-motif={motif} style={{ '--project-accent': accent } as CSSProperties} aria-hidden>
      <Motif />
    </div>
  )
}
