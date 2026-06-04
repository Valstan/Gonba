'use client'
import { cn } from '@/utilities/ui'
import useClickableCard from '@/utilities/useClickableCard'
import Link from 'next/link'
import React, { Fragment } from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'

export type CardPostData = Pick<Post, 'slug' | 'categories' | 'meta' | 'title' | 'heroImage'>

export type CardRelationTo = 'posts' | 'pages' | 'projects'

// ts_headline возвращает подсветку с маркерами ⟦…⟧ (см. search/page.tsx).
// Рендерим как экранированный текст React + <mark> на совпадениях — без XSS.
const HighlightedSnippet: React.FC<{ value: string }> = ({ value }) => {
  const parts = value.split(/⟦(.*?)⟧/)
  return (
    <p>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>,
      )}
    </p>
  )
}

export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  doc?: CardPostData
  highlight?: string
  relationTo?: CardRelationTo
  showCategories?: boolean
  title?: string
}> = (props) => {
  const { card, link } = useClickableCard({})
  const { className, doc, highlight, relationTo, showCategories, title: titleFromProps } = props

  const { slug, categories, heroImage, meta, title } = doc || {}
  const { description, image: metaImage } = meta || {}
  const previewImage = metaImage || heroImage

  const hasCategories = categories && Array.isArray(categories) && categories.length > 0
  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, ' ') // replace non-breaking space with white space
  // Pages живут в корне (/slug); posts/projects — под своим префиксом.
  const href = relationTo === 'pages' ? `/${slug}` : `/${relationTo}/${slug}`

  return (
    <article
      className={cn(
        'border border-border rounded-lg overflow-hidden bg-card hover:cursor-pointer',
        className,
      )}
      ref={card.ref}
    >
      <div className="relative w-full ">
        {!previewImage && <div className="">No image</div>}
        {previewImage && typeof previewImage !== 'string' && <Media resource={previewImage} size="33vw" />}
      </div>
      <div className="p-4">
        {showCategories && hasCategories && (
          <div className="uppercase text-sm mb-4">
            {showCategories && hasCategories && (
              <div>
                {categories?.map((category, index) => {
                  if (typeof category === 'object') {
                    const { title: titleFromCategory } = category

                    const categoryTitle = titleFromCategory || 'Untitled category'

                    const isLast = index === categories.length - 1

                    return (
                      <Fragment key={index}>
                        {categoryTitle}
                        {!isLast && <Fragment>, &nbsp;</Fragment>}
                      </Fragment>
                    )
                  }

                  return null
                })}
              </div>
            )}
          </div>
        )}
        {titleToUse && (
          <div className="prose">
            <h3>
              <Link className="not-prose" href={href} prefetch={false} ref={link.ref}>
                {titleToUse}
              </Link>
            </h3>
          </div>
        )}
        {highlight ? (
          <div className="mt-2">
            <HighlightedSnippet value={highlight} />
          </div>
        ) : (
          description && <div className="mt-2">{description && <p>{sanitizedDescription}</p>}</div>
        )}
      </div>
    </article>
  )
}
