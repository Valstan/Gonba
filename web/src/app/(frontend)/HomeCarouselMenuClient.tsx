'use client'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

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

export const HomeCarouselMenuClient: React.FC<Props> = ({ centerItem, items }) => {
  return (
    <div className="homeOrbit">
      <div className="homeOrbit__stage">
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
                  sizes="(max-width: 980px) 60vw, 360px"
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

        <div className="homeOrbit__ring">
          {items.map((item, index) => {
            const orbitStyle = {
              '--orbit-angle': `${index * (360 / items.length)}deg`,
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
                  <div className="homeOrbit__itemInner">
                    <div className="homeOrbit__media">
                      {item.image && normalizeImageSrc(item.image.url) ? (
                        <Image
                          src={normalizeImageSrc(item.image.url) || ''}
                          alt={item.image.alt || item.title}
                          fill
                          sizes="(max-width: 620px) 30vw, 320px"
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
