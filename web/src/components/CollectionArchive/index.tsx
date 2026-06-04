import { cn } from '@/utilities/ui'
import React from 'react'

import { Card, CardPostData, CardRelationTo } from '@/components/Card'

// Результаты поиска несут на себе целевую коллекцию и подсветку совпадений
// (см. search/page.tsx). Архивы постов их не передают → fallback на 'posts'.
export type ArchiveResult = CardPostData & {
  relationTo?: CardRelationTo
  highlight?: string
}

export type Props = {
  posts: ArchiveResult[]
}

export const CollectionArchive: React.FC<Props> = (props) => {
  const { posts } = props

  return (
    <div className={cn('container')}>
      <div>
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 gap-y-4 gap-x-4 lg:gap-y-8 lg:gap-x-8 xl:gap-x-8">
          {posts?.map((result, index) => {
            if (typeof result === 'object' && result !== null) {
              return (
                <div className="col-span-4" key={index}>
                  <Card
                    className="h-full"
                    doc={result}
                    highlight={result.highlight}
                    relationTo={result.relationTo ?? 'posts'}
                    showCategories
                  />
                </div>
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}
