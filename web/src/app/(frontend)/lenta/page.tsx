import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LentaFeed } from '@/components/Lenta/LentaFeed'
import type { LentaItem, LentaMedia } from '@/components/Lenta/lentaTypes'
import { publicUrl } from '@/server/ugc/s3'
import { withRetry } from '@/utilities/withRetry'

import './lenta.css'

// «Народная лента» (UGC, /lenta) — фото/видео посетителей. Сервер тянет видимые
// публикации (ISR, force-static — медиа лежит в Object Storage, браузер грузит
// напрямую, наш бокс отдаёт только лёгкий кэшированный HTML). Сортировка — на
// клиенте (LentaFeed), чтобы роут оставался статически кэшируемым. Новое видно ≤30с.
export const dynamic = 'force-static'
export const revalidate = 30

const FEED_LIMIT = 200 // сколько публикаций показываем в ленте

export const metadata: Metadata = {
  title: 'Народная лента — Гоньба',
  description:
    'Фото и видео от гостей и жителей Гоньбы: делитесь своими снимками прямо на сайте — без регистрации.',
}

type MediaDoc = {
  kind?: string | null
  objectKey?: string | null
  posterKey?: string | null
  width?: number | null
  height?: number | null
}

type SubmissionDoc = {
  id: number
  kind?: string | null
  objectKey?: string | null
  posterKey?: string | null
  media?: MediaDoc[] | null
  authorName?: string | null
  caption?: string | null
  likeCount?: number | null
  commentCount?: number | null
  viewCount?: number | null
  width?: number | null
  height?: number | null
}

function toMedia(m: MediaDoc): LentaMedia {
  return {
    kind: m.kind === 'video' ? 'video' : 'photo',
    mediaUrl: publicUrl(m.objectKey as string),
    posterUrl: m.posterKey ? publicUrl(m.posterKey) : null,
    width: m.width != null ? Number(m.width) : null,
    height: m.height != null ? Number(m.height) : null,
  }
}

function toItem(d: SubmissionDoc): LentaItem {
  const kind = d.kind === 'video' ? 'video' : 'photo'
  // Обложка (media[0]) — из верхнеуровневых полей; затем доп. файлы массива media.
  const cover = toMedia(d)
  const extra = Array.isArray(d.media)
    ? d.media.filter((m) => typeof m?.objectKey === 'string' && m.objectKey).map(toMedia)
    : []
  return {
    id: d.id,
    kind,
    mediaUrl: cover.mediaUrl,
    posterUrl: cover.posterUrl,
    media: [cover, ...extra],
    authorName: d.authorName?.trim() || null,
    caption: d.caption ?? null,
    likeCount: Number(d.likeCount) || 0,
    commentCount: Number(d.commentCount) || 0,
    viewCount: Number(d.viewCount) || 0,
    width: d.width != null ? Number(d.width) : null,
    height: d.height != null ? Number(d.height) : null,
  }
}

async function getItems(): Promise<LentaItem[]> {
  try {
    // pool #040: ретрай транзиентного сбоя БД; пустой каталог — штатное состояние.
    return await withRetry(async () => {
      const payload = await getPayload({ config: configPromise })
      const res = await payload.find({
        collection: 'submissions',
        where: { status: { equals: 'visible' } },
        sort: '-createdAt',
        depth: 0,
        limit: FEED_LIMIT,
        overrideAccess: true,
      })
      return (res.docs as SubmissionDoc[]).map(toItem)
    })
  } catch {
    // Транзиентный сбой пережил ретраи: показать пустую ленту с кнопкой загрузки
    // (клиент всё равно интерактивен), ISR перерендерит через 30с.
    return []
  }
}

export default async function LentaPage() {
  const items = await getItems()

  return (
    <div className="pb-24 pt-8">
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Народная лента' }]} />
      </div>
      <div className="container mb-8">
        <h1 className="text-3xl font-bold md:text-4xl">Народная лента</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Фото и видео от гостей и жителей Гоньбы. Поделитесь своим снимком — прямо с
          телефона, без регистрации.
        </p>
      </div>
      <div className="container">
        {/* Контейнер всегда: кнопка загрузки доступна и при пустой ленте. */}
        <LentaFeed initialItems={items} />
      </div>
    </div>
  )
}
