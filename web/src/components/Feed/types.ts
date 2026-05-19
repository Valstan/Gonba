import type { Event, Post } from '@/payload-types'

export type FeedKind = 'post' | 'event'

export type FeedTypeFilter = 'all' | 'news' | 'blog' | 'announcement' | 'story' | 'event'

export type FeedEntry =
  | { kind: 'post'; sortKey: number; isUpcoming: false; item: Post }
  | { kind: 'event'; sortKey: number; isUpcoming: boolean; item: Event }

export const FEED_FILTERS: { value: FeedTypeFilter; label: string }[] = [
  { value: 'all', label: 'Всё' },
  { value: 'event', label: 'События' },
  { value: 'news', label: 'Новости' },
  { value: 'blog', label: 'Истории' },
  { value: 'announcement', label: 'Анонсы' },
]
