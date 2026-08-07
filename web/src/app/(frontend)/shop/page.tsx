import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import React from 'react'
import { Breadcrumbs } from '@/components/Breadcrumbs'

import { Media } from '@/components/Media'
import { AdminManageActions } from '@/components/AdminOverlay'
import { withRetry } from '@/utilities/withRetry'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function ShopPage() {
  const payload = await getPayload({ config: configPromise })

  // pool #040: ретрай транзиентного сбоя БД (бросает → ISR не кэширует пустым).
  const products = await withRetry(() =>
    payload.find({
      collection: 'products',
      depth: 1,
      limit: 100,
      overrideAccess: false,
    }),
  )

  return (
    <main className="editorial-page editorial-page--shop pb-24 pt-20">
      <div className="editorial-page__wash" aria-hidden />
      <div className="container editorial-page__breadcrumbs">
        <Breadcrumbs items={[{ href: '/', label: 'Главная' }, { label: 'Магазин' }]} />
      </div>
      <header className="container editorial-hero">
        <div className="editorial-hero__art" aria-hidden />
        <div className="editorial-hero__content">
          <p className="editorial-hero__kicker">Сделано на Малмыжской земле</p>
          <h1>Витрина вещей с местным характером</h1>
          <p>Не склад и не безликий каталог — выбор мастеров, хозяйств и проектов Гоньбы. У каждой вещи есть автор и история.</p>
          <AdminManageActions addLabel="Добавить товар" addUrl="/admin/collections/products/create" />
        </div>
      </header>
      <section className="container editorial-list" aria-label="Витрина товаров">
        <div className="editorial-list__heading"><span>Местная витрина</span><h2>Выбрано с любовью</h2></div>
        {products.docs.length ? (
          <div className="shop-showcase">
            {products.docs.map((product) => (
              <article key={product.id} className="shop-showcase__card">
                <Link href={`/shop/${product.slug}`} className="shop-showcase__media" aria-label={product.title}>
                  {product.images?.[0]?.image && typeof product.images[0].image !== 'string' ? (
                    <Media resource={product.images[0].image} imgClassName="h-full w-full object-cover" />
                  ) : <span aria-hidden>✦</span>}
                </Link>
                <div className="shop-showcase__content">
                  <p className="shop-showcase__eyebrow">Из Гоньбы и окрестностей</p>
                  <h3><Link href={`/shop/${product.slug}`}>{product.title}</Link></h3>
                  {product.summary && <div>{product.summary}</div>}
                  <div className="shop-showcase__footer">
                    <strong>{product.price} {product.currency}</strong>
                    <Link href={`/shop/${product.slug}`}>Рассмотреть ↗</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="editorial-empty">Витрина наполняется — скоро здесь появятся первые вещи и гостинцы.</p>}
      </section>
    </main>
  )
}
