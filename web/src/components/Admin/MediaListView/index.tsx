'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DefaultListView,
  DocumentIcon,
  Thumbnail,
  useListDrawerContext,
  useListQuery,
} from '@payloadcms/ui'
import type { ListViewClientProps } from 'payload'
import type { CollectionSlug } from 'payload'

import './index.scss'

type DisplayMode = 'table' | 'gallery'
type GallerySize = 'small' | 'medium' | 'large'

type MediaDoc = {
  id?: number | string
  alt?: string
  filesize?: number | null
  filename?: string | null
  mimeType?: string | null
  thumbnailURL?: string | null
  url?: string | null
}

const STORAGE_KEYS = {
  displayMode: 'payload-media-list-view-mode',
  gallerySize: 'payload-media-list-view-size',
} as const

const MODE_OPTIONS: Array<{ value: DisplayMode; label: string }> = [
  { value: 'table', label: 'Список' },
  { value: 'gallery', label: 'Мозаика' },
]

const SIZE_OPTIONS: Array<{ value: GallerySize; label: string }> = [
  { value: 'small', label: '3' },
  { value: 'medium', label: '4' },
  { value: 'large', label: '6' },
]

const clampGallerySize = (value: string | null): GallerySize => {
  if (value === 'small' || value === 'large' || value === 'medium') {
    return value
  }

  return 'medium'
}

const clampDisplayMode = (value: string | null): DisplayMode => {
  if (value === 'gallery' || value === 'table') {
    return value
  }

  return 'table'
}

const formatFilesize = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  const fractionDigits = unitIndex === 0 || size >= 10 ? 0 : 1
  return `${size.toFixed(fractionDigits)} ${units[unitIndex]}`
}

const formatSizeLabel = (size?: number | null) => {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return null
  }

  return formatFilesize(size)
}

const useOptionalListDrawerContext = () => {
  try {
    return useListDrawerContext()
  } catch {
    return null
  }
}

const MediaGalleryTable: React.FC<{
  collectionSlug: CollectionSlug
  gallerySize: GallerySize
}> = ({ collectionSlug, gallerySize }) => {
  const { data } = useListQuery()
  const docs = useMemo(() => (Array.isArray(data?.docs) ? data.docs : []), [data?.docs])
  const listDrawerContext = useOptionalListDrawerContext()
  const canSelect = Boolean(listDrawerContext?.isInDrawer && listDrawerContext?.onSelect)
  const onSelect = listDrawerContext?.onSelect

  const selectDoc = useCallback(
    (doc: MediaDoc) => {
      if (!canSelect || !onSelect || !doc.id) {
        return
      }

      onSelect({
        collectionSlug,
        doc,
        docID: `${doc.id}`,
      })
    },
    [canSelect, collectionSlug, onSelect],
  )

  return (
    <div className={`media-list-view__gallery media-list-view__gallery--${gallerySize}`}>
      {docs.map((docData, index) => {
        const doc = docData as MediaDoc
        const title =
          (typeof doc.filename === 'string' && doc.filename.trim()) || `Файл #${doc.id ?? index + 1}`
        const preview = doc.thumbnailURL || doc.url

        return (
          <button
            className="media-list-view__gallery-item"
            disabled={!canSelect}
            key={`${collectionSlug}-${doc.id ?? index}`}
            onClick={() => {
              selectDoc(doc)
            }}
            type="button"
          >
            <div className="media-list-view__gallery-preview">
              {typeof preview === 'string' && preview.length > 0 ? (
                <Thumbnail fileSrc={preview} className="media-list-view__thumbnail" size="medium" />
              ) : (
                <div className="media-list-view__thumbnail media-list-view__thumbnail--placeholder">
                  <DocumentIcon />
                </div>
              )}
            </div>
            <div className="media-list-view__gallery-content">
              <p className="media-list-view__gallery-title" title={title}>
                {title}
              </p>
              <p className="media-list-view__gallery-meta">
                {typeof doc.mimeType === 'string' ? doc.mimeType : 'Файл'}{' '}
                {formatSizeLabel(doc.filesize) ? `· ${formatSizeLabel(doc.filesize)}` : null}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

const modeButtonClassName = (active: boolean) =>
  `media-list-view__button ${active ? 'media-list-view__button--active' : ''}`

export const MediaListView: React.FC<ListViewClientProps> = (props) => {
  const { collectionSlug, Table } = props
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table')
  const [gallerySize, setGallerySize] = useState<GallerySize>('medium')
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsHydrated(true)
      return
    }

    setDisplayMode(clampDisplayMode(window.localStorage.getItem(STORAGE_KEYS.displayMode)))
    setGallerySize(clampGallerySize(window.localStorage.getItem(STORAGE_KEYS.gallerySize)))
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS.displayMode, displayMode)
    window.localStorage.setItem(STORAGE_KEYS.gallerySize, gallerySize)
  }, [displayMode, gallerySize, isHydrated])

  const TableComponent = useMemo(() => {
    if (displayMode === 'gallery') {
      return <MediaGalleryTable collectionSlug="media" gallerySize={gallerySize} />
    }

    return Table
  }, [Table, collectionSlug, gallerySize, displayMode])

  return (
    <DefaultListView
      {...props}
      Table={TableComponent}
      BeforeListTable={
        <div className="media-list-view__controls">
          <div className="media-list-view__group" aria-label="Выбор режима отображения">
            <span className="media-list-view__group-label">Вид:</span>
            <div className="media-list-view__buttons">
              {MODE_OPTIONS.map((option) => (
                <button
                  className={modeButtonClassName(displayMode === option.value)}
                  key={option.value}
                  onClick={() => {
                    setDisplayMode(option.value)
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {displayMode === 'gallery' ? (
            <div className="media-list-view__group" aria-label="Размер превью в мозаике">
              <span className="media-list-view__group-label">Размер:</span>
              <div className="media-list-view__buttons">
                {SIZE_OPTIONS.map((option) => (
                  <button
                    className={modeButtonClassName(gallerySize === option.value)}
                    key={option.value}
                    onClick={() => {
                      setGallerySize(option.value)
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  )
}

export default MediaListView

