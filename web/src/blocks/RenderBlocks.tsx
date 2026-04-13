import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'
import { AdminOverlay } from '@/components/AdminOverlay'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { BookingCTABlock } from '@/blocks/BookingCTA/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FAQBlock } from '@/blocks/FAQ/Component'
import { FormBlock } from '@/blocks/Form/Component'
import { GalleryBlock } from '@/blocks/Gallery/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { PricingBlock } from '@/blocks/Pricing/Component'
import { ScheduleBlock } from '@/blocks/Schedule/Component'
import { TestimonialsBlock } from '@/blocks/Testimonials/Component'

const blockComponents = {
  archive: ArchiveBlock,
  bookingCta: BookingCTABlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  faq: FAQBlock,
  formBlock: FormBlock,
  gallery: GalleryBlock,
  mediaBlock: MediaBlock,
  pricing: PricingBlock,
  schedule: ScheduleBlock,
  testimonials: TestimonialsBlock,
}

const blockLabels: Partial<Record<keyof typeof blockComponents, string>> = {
  archive: 'архивный блок',
  bookingCta: 'блок бронирования',
  content: 'контентный блок',
  cta: 'CTA-блок',
  faq: 'FAQ-блок',
  formBlock: 'блок формы',
  gallery: 'галерею',
  mediaBlock: 'медиа-блок',
  pricing: 'блок цен',
  schedule: 'блок расписания',
  testimonials: 'блок отзывов',
}

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
  pageId?: string | number
  collectionSlug?: 'pages' | 'posts' | 'projects' | 'events' | 'services' | 'products'
}> = (props) => {
  const { blocks, collectionSlug, pageId } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0
  const hasDocumentIdentity = pageId !== undefined && pageId !== null && collectionSlug
  const documentEditUrl = hasDocumentIdentity
    ? `/admin/collections/${collectionSlug}/${pageId}`
    : undefined

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block
          const key = `${blockType || 'block'}-${index}`

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            if (Block) {
              return (
                <AdminOverlay
                  key={key}
                  addLabel="Добавить блок"
                  addUrl={documentEditUrl}
                  editLabel="Редактировать"
                  editUrl={documentEditUrl}
                  label={blockLabels[blockType] || 'блок'}
                >
                  <div className="my-16">
                    {/* @ts-expect-error there may be some mismatch between the expected types here */}
                    <Block {...block} disableInnerContainer />
                  </div>
                </AdminOverlay>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
