import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'

import type { Media as MediaType, MediaBlock as MediaBlockProps } from '@/payload-types'

import { Media } from '../../components/Media'

type Props = MediaBlockProps & {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  staticImage?: StaticImageData
  disableInnerContainer?: boolean
}

export const MediaBlock: React.FC<Props> = (props) => {
  const getCaption = (item: { caption?: string | null }) => item.caption?.trim() || ''

  const {
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    items,
    staticImage,
    disableInnerContainer,
  } = props

  const normalizedItems = Array.isArray(items) ? items.filter((item) => item?.media) : []
  const legacyMedia = (props as { media?: number | MediaType | null }).media
  const legacyRichCaption =
    legacyMedia && typeof legacyMedia === 'object' ? legacyMedia.caption : null
  const hasGallery = normalizedItems.length > 0

  return (
    <div
      className={cn(
        '',
        {
          container: enableGutter,
        },
        className,
      )}
    >
      {hasGallery ? (
        <div className={cn('grid gap-6', normalizedItems.length > 1 && 'sm:grid-cols-2')}>
          {normalizedItems.map((item, index) => {
            const caption = getCaption(item)

            return (
              <figure key={item.id || index} className="space-y-3">
                <Media
                  imgClassName={cn('border border-border rounded-[0.8rem]', imgClassName)}
                  resource={item.media}
                />
                {caption ? (
                  <figcaption className={cn('text-sm text-muted-foreground', captionClassName)}>
                    {caption}
                  </figcaption>
                ) : null}
              </figure>
            )
          })}
        </div>
      ) : null}

      {!hasGallery && (legacyMedia || staticImage) ? (
        <Media
          imgClassName={cn('border border-border rounded-[0.8rem]', imgClassName)}
          resource={legacyMedia}
          src={staticImage}
        />
      ) : null}
      {!hasGallery && legacyRichCaption ? (
        <div
          className={cn(
            'mt-6',
            {
              container: !disableInnerContainer,
            },
            captionClassName,
          )}
        >
          <RichText data={legacyRichCaption} enableGutter={false} />
        </div>
      ) : null}
    </div>
  )
}
