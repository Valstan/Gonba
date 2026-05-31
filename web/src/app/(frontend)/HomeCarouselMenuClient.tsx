'use client'

import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useRef } from 'react'

type OrbitImage = {
  id: string
  url: string
  alt?: string
}

type OrbitItem = {
  id?: string
  title: string
  link: string
  image: OrbitImage | null
}

type OrbitCenterItem = {
  title: string
  link: string
  image: OrbitImage | null
}

type Props = {
  centerItem: OrbitCenterItem
  items: OrbitItem[]
}

const normalizeImageSrc = (src: string) => {
  const normalized = src.trim()
  if (!normalized) return null
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized
  if (normalized.startsWith('//')) return normalized
  if (normalized.startsWith('/')) return normalized
  return `/media/${normalized}`
}

// Полный оборот за SPIN_MS. Линейно — субъективно ровно и плавно.
const SPIN_MS = 90000

// Дуга-подпись под кружком (SVG textPath). Одна общая геометрия для всех кружков:
// viewBox 150×150, центр (75,75), фото-радиус 50, текст по нижней дуге радиуса 58
// (на ~8 ед. ниже края фото), разворот ±60° от низа. sweep=0 → дуга снизу, текст «улыбкой».
const ARC_PATH_ID = 'homeOrbitArcPath'
const ARC_PATH_D = 'M 24.8 104 A 58 58 0 0 0 125.2 104'

// Разноцветные подписи (req: разный цвет, без фона, с тенью/обводкой для контраста).
// Насыщённые, читаемые на песочном фоне; белая обводка + тень добавляются в CSS.
const LABEL_COLORS = [
  '#2f4a2a', // лес
  '#a86a1d', // янтарь
  '#8a2f1c', // глина
  '#3a5236', // олива
  '#1f5673', // вода
  '#7a3b69', // слива
  '#b5530f', // охра-жжёная
  '#46478f', // индиго
]
const CENTER_LABEL_COLOR = '#23351f'

type ArcLabelProps = { title: string; center?: boolean }

// Подпись дугой под кружком. textLength + lengthAdjust гарантируют, что любой
// заголовок впишется в дугу (короткие — мягко растягиваются, длинные — слегка сжимаются).
const ArcLabel: React.FC<ArcLabelProps> = ({ title, center }) => (
  <svg
    className={`homeOrbit__arc${center ? ' homeOrbit__arc--center' : ''}`}
    viewBox="0 0 150 150"
    aria-hidden="true"
    focusable="false"
  >
    <text className="homeOrbit__arcText">
      <textPath
        href={`#${ARC_PATH_ID}`}
        startOffset="50%"
        textAnchor="middle"
        textLength={center ? 104 : 108}
        lengthAdjust="spacingAndGlyphs"
      >
        {title}
      </textPath>
    </text>
  </svg>
)

export const HomeCarouselMenuClient: React.FC<Props> = ({ centerItem, items }) => {
  const ringRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  // Единый источник вращения: rAF пишет ОДНУ переменную --orbit-rot на кольце.
  // Кольцо крутится на +rot (CSS: transform: rotate(var(--orbit-rot))), а
  // .homeOrbit__itemInner контр-вращается на -rot, читая ТУ ЖЕ inherited-переменную.
  // → фото и подписи всегда горизонтальны (подпись остаётся снизу кружка), без дрожания.
  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      ring.style.setProperty('--orbit-rot', '0deg')
      return
    }

    let raf = 0
    let angle = 0
    let last = performance.now()
    const speed = 360 / SPIN_MS // градусов в мс

    const tick = (now: number) => {
      const dt = now - last
      last = now
      if (!pausedRef.current) {
        angle = (angle + dt * speed) % 360
        ring.style.setProperty('--orbit-rot', `${angle}deg`)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const pause = () => {
    pausedRef.current = true
  }
  const resume = () => {
    pausedRef.current = false
  }

  const count = items.length || 1

  return (
    <div className="homeOrbit">
      {/* Общая дуга-путь для всех подписей — один def, переиспользуется через href. */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
        <defs>
          <path id={ARC_PATH_ID} d={ARC_PATH_D} />
        </defs>
      </svg>

      <div
        className="homeOrbit__stage"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocusCapture={pause}
        onBlurCapture={resume}
        onTouchStart={pause}
        onTouchEnd={resume}
      >
        {/* Центр — не вращается. */}
        <div className="homeOrbit__centerWrap" style={{ '--orbit-label-color': CENTER_LABEL_COLOR } as React.CSSProperties}>
          <Link
            className="homeOrbit__center"
            href={centerItem.link}
            prefetch={false}
            aria-label={`Открыть раздел ${centerItem.title}`}
          >
            <div className="homeOrbit__media homeOrbit__media--center">
              {centerItem.image && normalizeImageSrc(centerItem.image.url) ? (
                <Image
                  src={normalizeImageSrc(centerItem.image.url) || ''}
                  alt={centerItem.image.alt || centerItem.title}
                  fill
                  sizes="(max-width: 980px) 50vw, 280px"
                  className="homeOrbit__image"
                  unoptimized
                />
              ) : (
                <div className="homeOrbit__fallback" />
              )}
            </div>
            <ArcLabel title={centerItem.title} center />
          </Link>
        </div>

        {/* Кольцо — вращается через --orbit-rot (rAF). */}
        <div className="homeOrbit__ring" ref={ringRef}>
          {items.map((item, index) => {
            const orbitStyle = {
              '--orbit-angle': `${index * (360 / count)}deg`,
              '--orbit-label-color': LABEL_COLORS[index % LABEL_COLORS.length],
            } as React.CSSProperties

            return (
              <div
                className="homeOrbit__itemWrap"
                key={item.id || `${item.title}-${index}`}
                style={orbitStyle}
              >
                <Link
                  href={item.link}
                  prefetch={false}
                  className="homeOrbit__item"
                  aria-label={`Открыть раздел: ${item.title}`}
                >
                  {/* Контр-вращается: фото и подпись остаются горизонтальными при вращении кольца. */}
                  <div className="homeOrbit__itemInner">
                    <div className="homeOrbit__media">
                      {item.image && normalizeImageSrc(item.image.url) ? (
                        <Image
                          src={normalizeImageSrc(item.image.url) || ''}
                          alt={item.image.alt || item.title}
                          fill
                          sizes="(max-width: 980px) 22vw, 220px"
                          className="homeOrbit__image"
                          unoptimized
                        />
                      ) : (
                        <div className="homeOrbit__fallback" />
                      )}
                    </div>
                    <ArcLabel title={item.title} />
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
