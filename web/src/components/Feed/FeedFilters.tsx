'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

import { cn } from '@/utilities/ui'
import { FEED_FILTERS, type FeedTypeFilter } from './types'

type Props = {
  current: FeedTypeFilter
}

export const FeedFilters: React.FC<Props> = ({ current }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onSelect = (value: FeedTypeFilter) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (value === 'all') {
      params.delete('type')
    } else {
      params.set('type', value)
    }
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
      <ul className="flex items-center gap-2 pb-1">
        {FEED_FILTERS.map((filter) => {
          const active = filter.value === current
          return (
            <li key={filter.value}>
              <button
                type="button"
                onClick={() => onSelect(filter.value)}
                className={cn(
                  'min-h-11 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--project-accent)] bg-[color:var(--project-accent-soft,transparent)] text-[var(--project-accent)]'
                    : 'border-border/90 hover:bg-accent/40',
                )}
                aria-pressed={active}
              >
                {filter.label}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
