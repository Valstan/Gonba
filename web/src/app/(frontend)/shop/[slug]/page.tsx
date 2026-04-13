import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React, { cache } from 'react'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { AdminOverlay } from '@/components/AdminOverlay'

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
      <article className="pt-16 pb-16">
        <div className="container">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              { href: '/shop', label: 'Магазин' },
              { label: product.title || decodedSlug },
            ]}
          />
        </div>
        <div className="container">
          <h1 className="text-3xl font-semibold">{product.title}</h1>
          {product.summary && <p className="mt-2 text-sm text-muted-foreground">{product.summary}</p>}
          <p className="mt-2 text-sm text-muted-foreground">
            {product.price} {product.currency}
          </p>
        </div>
        {product.images && product.images.length > 0 && (
          <div className="container mt-6 grid gap-4 md:grid-cols-2">
            {product.images.map((item, index) => (
              <div key={index} className="space-y-2">
                <Media resource={item.image} className="rounded-lg" />
                {item.caption && <p className="text-sm text-muted-foreground">{item.caption}</p>}
              </div>
            ))}
          </div>
        )}
        {product.description && (
          <div className="container mt-6">
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

  const result = await payload.find({
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
  })

  return result.docs?.[0] || null
})
