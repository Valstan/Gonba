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
const SPIN_MS = 96000

export const HomeCarouselMenuClient: React.FC<Props> = ({ centerItem, items }) => {
  const ringRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  // Единый источник вращения: rAF пишет ОДНУ переменную --orbit-rot на кольце.
  // Кольцо крутится на +rot (CSS: transform: rotate(var(--orbit-rot))), а
  // .homeOrbit__itemInner контр-вращается на -rot, читая ТУ ЖЕ inherited-переменную.
  // → подписи всегда горизонтальны, без дрожания (раньше дрейфовали две разные анимации).
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
        <div className="homeOrbit__centerWrap">
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
            <span className="homeOrbit__centerTitle">{centerItem.title}</span>
          </Link>
        </div>

        {/* Кольцо — вращается через --orbit-rot (rAF). */}
        <div className="homeOrbit__ring" ref={ringRef}>
          {items.map((item, index) => {
            const orbitStyle = {
              '--orbit-angle': `${index * (360 / count)}deg`,
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
                  {/* Контр-вращается: остаётся горизонтальным при вращении кольца. */}
                  <div className="homeOrbit__itemInner">
                    <div className="homeOrbit__media">
                      {item.image && normalizeImageSrc(item.image.url) ? (
                        <Image
                          src={normalizeImageSrc(item.image.url) || ''}
                          alt={item.image.alt || item.title}
                          fill
                          sizes="(max-width: 980px) 22vw, 150px"
                          className="homeOrbit__image"
                          unoptimized
                        />
                      ) : (
                        <div className="homeOrbit__fallback" />
                      )}
                    </div>
                    <span className="homeOrbit__itemTitle">{item.title}</span>
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
