import type { Metadata } from 'next'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CloudGallery, type CloudImage } from '@/components/CloudGallery/CloudGallery.client'
import { withRetry } from '@/utilities/withRetry'

export const dynamic = 'force-static'
export const revalidate = 600

const PER_PAGE = 48

export const metadata: Metadata = {
  title: 'Облако — фотогалерея усадьбы',
  description:
    'Фотооблако усадьбы Гоньба: снимки проектов, событий, мастер-классов и поездок. Листайте и открывайте фото на весь экран.',
}

export default async function CloudPage() {
  const payload = await getPayload({ config: configPromise })

  // pool #040: ретрай транзиентного сбоя БД (бросает → ISR не кэширует пустым).
  const result = await withRetry(() =>
    payload.find({
      collection: 'media',
      depth: 0,
      limit: PER_PAGE,
      page: 1,
      sort: '-createdAt',
      overrideAccess: false,
      where: {
        mimeType: {
          like: 'image',
        },
      },
    }),
  )

  const initialItems: CloudImage[] = result.docs
    .map((doc) => ({
      id: String(doc.id),
      url: doc.url || `/api/media/file/${doc.id}`,
      alt: doc.alt || '',
      width: doc.width ?? null,
      height: doc.height ?? null,
    }))
    .filter((item) => Boolean(item.url))

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Главная' },
            { label: 'Облако' },
          ]}
        />

        <header className="mt-6">
          <h1 className="text-3xl font-semibold md:text-4xl">Облако</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Фотоальбом усадьбы — снимки проектов, событий, мастер-классов и поездок. Нажмите на
            фото, чтобы открыть его на весь экран.
          </p>
        </header>

        <div className="mt-8">
          {initialItems.length > 0 ? (
            <CloudGallery initialItems={initialItems} totalDocs={result.totalDocs} perPage={PER_PAGE} />
          ) : (
            <p className="text-sm text-muted-foreground">Фотографии пока не загружены.</p>
          )}
        </div>
      </section>
    </main>
  )
}
