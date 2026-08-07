import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminOverlay } from '@/components/AdminOverlay'
import { withRetry } from '@/utilities/withRetry'
import { JsonLd } from '@/components/seo/JsonLd'
import { productJsonLd } from '@/seo/jsonld'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const products = await payload.find({
    collection: 'products',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return products.docs.map(({ slug }) => ({ slug }))
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function ProductPage({ params: paramsPromise }: Args) {
  const { slug = '' } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const url = `/shop/${decodedSlug}`

  const product = await queryProductBySlug({ slug: decodedSlug })
  if (!product) return <PayloadRedirects url={url} />
  const productEditUrl = `/admin/collections/products/${product.id}`

  return (
    <AdminOverlay
      addLabel="Добавить контент"
      addUrl={productEditUrl}
      editLabel="Редактировать"
      editUrl={productEditUrl}
      label="товар"
    >
      <article className="min-h-screen bg-[radial-gradient(circle_at_85%_12%,rgba(211,151,63,0.2),transparent_28%),linear-gradient(180deg,rgba(239,231,201,0.65),transparent_52%)] pt-20 pb-20">
        <JsonLd data={productJsonLd(product, url)} />
        <div className="container">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              { href: '/shop', label: 'Магазин' },
              { label: product.title || decodedSlug },
            ]}
          />
        </div>
        <div className="container mt-8 max-w-5xl">
          <p className="text-sm font-semibold tracking-[0.2em] text-amber-800 uppercase">Из лавки на берегу Вятки</p>
          <h1 className="mt-3 text-4xl font-semibold md:text-6xl">{product.title}</h1>
          {product.summary && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">{product.summary}</p>}
          <p className="mt-6 inline-flex rounded-full bg-emerald-950 px-6 py-3 text-base font-semibold text-amber-50 shadow-lg">
            {product.price != null
              ? `${product.price} ${product.currency === 'RUB' ? '₽' : product.currency || '₽'}`
              : 'Цена по запросу'}
          </p>
        </div>
        {product.images && product.images.length > 0 && (
          <div className="container mt-10 grid max-w-5xl gap-5 md:grid-cols-2">
            {product.images.map((item, index) => (
              <div key={index} className="space-y-2">
                <Media resource={item.image} className="overflow-hidden rounded-[2rem] shadow-lg" />
                {item.caption && <p className="text-sm text-muted-foreground">{item.caption}</p>}
              </div>
            ))}
          </div>
        )}
        {(!product.images || product.images.length === 0) && (
          <div className="container mt-10 max-w-5xl">
            <div className="flex aspect-[16/6] items-end rounded-[2rem] bg-[radial-gradient(circle_at_72%_28%,rgba(230,181,88,0.42),transparent_25%),linear-gradient(135deg,#315e45,#173c34)] p-8 text-amber-50 shadow-lg">
              <p className="max-w-md text-lg">Небольшая вещь с характером Вятского края — подробности и фотографии скоро появятся в витрине.</p>
            </div>
          </div>
        )}
        {product.description && (
          <div className="container mt-10 max-w-3xl rounded-3xl bg-card/80 p-6 shadow-sm md:p-10">
            <RichText data={product.description} enableGutter={false} />
          </div>
        )}
        <PayloadRedirects disableNotFound url={url} />
      </article>
    </AdminOverlay>
  )
}

const queryProductBySlug = cache(async ({ slug }: { slug: string }) => {
  const payload = await getPayload({ config: configPromise })

  // pool #040: ретрай против транзиентного сбоя БД. Бросает после ретраев →
  // ISR не кэширует ложный 404; null (0 docs) = реально нет → штатный 404.
  const result = await withRetry(() =>
    payload.find({
      collection: 'products',
      draft: false,
      limit: 1,
      overrideAccess: false,
      pagination: false,
      where: {
        slug: {
          equals: slug,
        },
      },
    }),
  )

  return result.docs?.[0] || null
})
