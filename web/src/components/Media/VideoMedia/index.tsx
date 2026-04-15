'use client'

import { cn } from '@/utilities/ui'
import React from 'react'

import type { Props as MediaProps } from '../types'

import { getMediaUrl } from '@/utilities/getMediaUrl'

export const VideoMedia: React.FC<MediaProps> = (props) => {
  const { onClick, resource, videoClassName } = props

  if (resource && typeof resource === 'object') {
    const { url, filename } = resource
    const sourceUrl = url || (filename ? `/media/${filename}` : '')
    if (!sourceUrl) return null

    return (
      <video
        autoPlay
        className={cn(videoClassName)}
        controls={false}
        loop
        muted
        onClick={onClick}
        playsInline
      >
        <source src={getMediaUrl(sourceUrl)} />
      </video>
    )
  }

  return null
}
