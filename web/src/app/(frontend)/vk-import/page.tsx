import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { getMeUser } from '@/utilities/getMeUser'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { VkImportQueueClient } from './page.client'
import { sections } from '../sections/data'

type QueueHeroImage = {
  id?: number
  url?: string
  alt?: string
}

type QueueEntryFromPayload = {
  id: string | number
  title?: string
  text?: string
  previewText?: string
  sourceUrl?: string
  sourcePostId?: number
  sourceGroupId?: number
  queuedAt?: string
  heroImage?: QueueHeroImage | number | null
  suggestedSections?: Array<{ slug: string }>
}

const fallbackSectionChoices = [
  { slug: 'posts', title: 'Посты' },
  { slug: 'projects', title: 'Проекты' },
  { slug: 'events', title: 'События' },
  { slug: 'shop', title: 'Магазин' },
]

const buildSectionChoices = () => {
  const map = new Map<string, { slug: string; title: string }>()

  sections.forEach((section) => {
    if (!section?.slug) return
    map.set(section.slug, {
      slug: section.slug,
      title: section.shortLabel || section.title,
    })
  })

  fallbackSectionChoices.forEach((section) => {
    map.set(section.slug, section)
  })

  return Array.from(map.values())
}

const adminOnlyRedirect = `/admin/login?redirect=${encodeURIComponent('/vk-import')}`

export default async function VkImportQueuePage() {
  const { user } = await getMeUser({ nullUserRedirect: adminOnlyRedirect })
  const isAdmin = Array.isArray(user?.roles) && user.roles.includes('admin')

  if (!isAdmin) {
    return (
      <div className="container py-24">
        <p className="text-sm text-red-600">Доступ к странице импорта VK доступен только администраторам.</p>
      </div>
    )
  }

  const payload = await getPayload({ config: configPromise })
  const queueResult = await payload.find({
    collection: 'vkImportQueue',
    overrideAccess: true,
    where: { status: { equals: 'queued' } },
    sort: '-queuedAt',
    limit: 200,
    depth: 2,
  })

  const items = (queueResult.docs as QueueEntryFromPayload[]).map((item) => ({
    id: item.id,
    title: item.title || 'Без заголовка',
    text: item.text,
    previewText: item.previewText,
    sourceUrl: item.sourceUrl,
    sourceGroupId: item.sourceGroupId,
    sourcePostId: item.sourcePostId,
    heroImage: item.heroImage,
    queuedAt: item.queuedAt,
    suggestedSections:
      (item.suggestedSections || [])
        .map((entry) => entry.slug)
        .filter((section): section is string => Boolean(section)) as string[],
  }))

  const sectionChoices = buildSectionChoices()

  return (
    <div className="pt-24 pb-24">
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Импорт VK' }]} />
      </div>
      <div className="container mt-4">
        <h1 className="text-3xl font-semibold">Модерация импорта VK</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Здесь отображаются последние посты из настроенных сообществ VK. Выберите раздел для публикации или удалите запись.
        </p>
      </div>
      <div className="container mt-8">
        <VkImportQueueClient initialItems={items} sectionChoices={sectionChoices} />
      </div>
    </div>
  )
}
