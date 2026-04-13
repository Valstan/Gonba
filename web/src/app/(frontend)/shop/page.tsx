import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { Breadcrumbs } from '@/components/Breadcrumbs'

import { Media } from '@/components/Media'
import { AdminManageActions } from '@/components/AdminOverlay'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function ShopPage() {
  const payload = await getPayload({ config: configPromise })

  const products = await payload.find({
    collection: 'products',
    depth: 1,
    limit: 100,
    overrideAccess: false,
  })

  return (
    <div className="pt-24 pb-24">
      <div className="container">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Магазин' }]} />
      </div>
      <div className="container mb-10 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">Магазин</h1>
        <AdminManageActions addLabel="Добавить товар" addUrl="/admin/collections/products/create" />
      </div>
      <div className="container grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.docs.map((product) => (
          <article key={product.id} className="rounded-xl border border-border p-4">
            {product.images?.[0]?.image && typeof product.images[0].image !== 'string' && (
              <Media resource={product.images[0].image} className="rounded-lg" />
            )}
            <h2 className="mt-4 text-lg font-medium">
              <Link href={`/shop/${product.slug}`}>{product.title}</Link>
            </h2>
            {product.summary && <p className="mt-2 text-sm text-muted-foreground">{product.summary}</p>}
            <p className="mt-2 text-sm text-muted-foreground">
              {product.price} {product.currency}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
