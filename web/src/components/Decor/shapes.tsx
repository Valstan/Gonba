import type { ReactElement } from 'react'

/**
 * Общий набор декоративных SVG-мотивов и подбор темы (цвет + пара мотивов).
 * Используется и страницами проектов (ProjectDecor), и общесайтовым слоем
 * (SiteDecor). Каждый мотив — чистый SVG в viewBox 0 0 100 100, использует
 * currentColor (цвет/прозрачность задаёт слой-родитель). Server-safe.
 */

export type DecorMotif =
  | 'auto'
  | 'none'
  | 'floral'
  | 'vines'
  | 'lines'
  | 'geometric'
  | 'waves'
  | 'leaves'
  | 'sun'
  | 'rhombs'
  | 'dots'
  | 'star'

export type RenderMotif = Exclude<DecorMotif, 'auto' | 'none'>

export const MOTIFS: RenderMotif[] = [
  'floral',
  'vines',
  'lines',
  'geometric',
  'waves',
  'leaves',
  'sun',
  'rhombs',
  'dots',
  'star',
]

/** Этно-палитра accent'ов, читаемых на «бумажном» фоне (--paper #ede3cf). */
export const ACCENT_PALETTE = [
  '#2d4029', // лесной
  '#a86a1d', // охра
  '#6e2018', // охра-кровь
  '#5a6b35', // олива
  '#2f6360', // речной тил
  '#6a3d5b', // сливовый
  '#34506e', // вятская синь
  '#7a5230', // тёплый орех
  '#445a2e', // мох
]

/** Детерминированный хэш строки → неотрицательное 32-бит число (FNV-1a). */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Подбор темы по seed: accent + основной/вторичный мотивы.
 * - accentColor: явный цвет или из палитры по seed.
 * - forced: явный мотив для основного (или 'auto'/'none').
 */
export function pickTheme(
  seed: number,
  accentColor?: string | null,
  forced?: DecorMotif | null,
): { accent: string; primary: RenderMotif; secondary: RenderMotif; none: boolean } {
  const accent =
    typeof accentColor === 'string' && accentColor.trim().length > 0
      ? accentColor.trim()
      : ACCENT_PALETTE[seed % ACCENT_PALETTE.length]

  if (forced === 'none') {
    return { accent, primary: 'floral', secondary: 'dots', none: true }
  }

  const primary: RenderMotif =
    forced && forced !== 'auto' && (MOTIFS as string[]).includes(forced)
      ? (forced as RenderMotif)
      : MOTIFS[(seed >>> 3) % MOTIFS.length]

  // вторичный — другой бит хэша, гарантированно отличается от основного
  let sIdx = (seed >>> 11) % MOTIFS.length
  if (MOTIFS[sIdx] === primary) sIdx = (sIdx + 1) % MOTIFS.length
  const secondary = MOTIFS[sIdx]

  return { accent, primary, secondary, none: false }
}

/* ───────────────────── SVG-мотивы (viewBox 0 0 100 100) ───────────────────── */

function flower(cx: number, cy: number, r: number, key: string): ReactElement {
  const petals = [0, 1, 2, 3, 4].map((i) => {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    return (
      <ellipse key={i} cx={px} cy={py} rx={r * 0.62} ry={r * 0.32} transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} />
    )
  })
  return (
    <g key={key}>
      {petals}
      <circle cx={cx} cy={cy} r={r * 0.38} />
    </g>
  )
}

const SHAPES: Record<RenderMotif, () => ReactElement> = {
  floral: () => (
    <g fill="currentColor">
      {flower(72, 26, 15, 'a')}
      {flower(44, 52, 10, 'b')}
      {flower(84, 60, 7, 'c')}
    </g>
  ),
  vines: () => (
    <g fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M6 96 C6 60 36 60 36 34 S70 14 76 36 C82 52 58 60 54 46 C51 38 62 35 66 43" />
      <circle cx={66} cy={43} r={2.6} fill="currentColor" />
    </g>
  ),
  lines: () => (
    <g stroke="currentColor" strokeWidth={1.5}>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 6) * (Math.PI / 2)
        return <line key={i} x1={0} y1={0} x2={Math.cos(a) * 94} y2={Math.sin(a) * 94} />
      })}
    </g>
  ),
  geometric: () => (
    <g fill="none" stroke="currentColor" strokeWidth={1.6}>
      {Array.from({ length: 5 }, (_, i) => {
        const s = 14 + i * 16
        return <rect key={i} x={50 - s / 2} y={50 - s / 2} width={s} height={s} transform="rotate(45 50 50)" />
      })}
    </g>
  ),
  waves: () => (
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      {[28, 50, 72].map((y) => (
        <path key={y} d={`M2 ${y} q 12 -10 24 0 t 24 0 t 24 0 t 24 0`} />
      ))}
    </g>
  ),
  leaves: () => (
    <g stroke="currentColor" strokeWidth={2} fill="currentColor">
      <path d="M22 94 C40 72 50 48 58 20" fill="none" />
      {[
        [30, 78, -35],
        [38, 62, -50],
        [46, 46, -60],
        [52, 32, -70],
      ].map(([x, y, rot], i) => (
        <ellipse key={i} cx={x} cy={y} rx={10} ry={4.2} transform={`rotate(${rot} ${x} ${y})`} fill="currentColor" stroke="none" />
      ))}
    </g>
  ),
  sun: () => (
    <g stroke="currentColor" strokeWidth={2} fill="none">
      <circle cx={50} cy={50} r={13} fill="currentColor" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI
        return (
          <line key={i} x1={50 + Math.cos(a) * 20} y1={50 + Math.sin(a) * 20} x2={50 + Math.cos(a) * 34} y2={50 + Math.sin(a) * 34} strokeLinecap="round" />
        )
      })}
    </g>
  ),
  rhombs: () => (
    <g fill="none" stroke="currentColor" strokeWidth={1.6}>
      {[
        [30, 30],
        [50, 30],
        [70, 30],
        [30, 50],
        [50, 50],
        [70, 50],
        [30, 70],
        [50, 70],
        [70, 70],
      ].map(([cx, cy], i) => (
        <rect
          key={i}
          x={cx - 7}
          y={cy - 7}
          width={14}
          height={14}
          transform={`rotate(45 ${cx} ${cy})`}
          fill={i % 2 === 0 ? 'currentColor' : 'none'}
          fillOpacity={i % 2 === 0 ? 0.5 : 0}
        />
      ))}
    </g>
  ),
  dots: () => (
    <g fill="currentColor">
      {[
        [30, 26, 6],
        [54, 38, 4],
        [40, 56, 5],
        [70, 52, 3.6],
        [60, 74, 4.6],
        [24, 52, 3],
        [80, 30, 3],
        [46, 80, 3.4],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  ),
  star: () => (
    <g fill="currentColor">
      <rect x={34} y={34} width={32} height={32} />
      <rect x={34} y={34} width={32} height={32} transform="rotate(45 50 50)" />
    </g>
  ),
}

/**
 * DecorSpots — расставляет узоры по углам слоя: основной мотив в tr+bl,
 * вторичный (мельче, бледнее) в tl+br. Больше количества и вариаций.
 */
export function DecorSpots({ primary, secondary }: { primary: RenderMotif; secondary: RenderMotif }) {
  const P = SHAPES[primary]
  const S = SHAPES[secondary]
  return (
    <>
      <svg className="decor-spot decor-tr decor-flip" viewBox="0 0 100 100" aria-hidden>
        <P />
      </svg>
      <svg className="decor-spot decor-bl" viewBox="0 0 100 100" aria-hidden>
        <P />
      </svg>
      <svg className="decor-spot decor-tl decor-sm" viewBox="0 0 100 100" aria-hidden>
        <S />
      </svg>
      <svg className="decor-spot decor-br decor-sm decor-flip" viewBox="0 0 100 100" aria-hidden>
        <S />
      </svg>
    </>
  )
}
