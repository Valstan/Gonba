import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import React from 'react'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LavkaTabs } from '@/components/Lavka/LavkaTabs'
import { ProductCard } from '@/components/Lavka/ProductCard'
import { ServiceCard } from '@/components/Lavka/ServiceCard'
import { queryProjectBySlug } from '../../queries'

export const dynamic = 'force-dynamic'
export const revalidate = 300

type Args = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}

export const generateMetadata = async ({ params }: Args) => {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) return { title: 'Проект не найден' }
  return { title: `${project.title} — Лавка` }
}

type Tab = 'services' | 'shop'

export default async function ProjectLavkaPage({ params: paramsPromise, searchParams: searchParamsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const sp = await searchParamsPromise
  const tab: Tab = sp?.tab === 'shop' ? 'shop' : 'services'

  const payload = await getPayload({ config: configPromise })
  const [servicesResult, productsResult] = await Promise.all([
    payload.find({
      collection: 'services',
      depth: 1,
      limit: 50,
      sort: '-updatedAt',
      overrideAccess: false,
      where: { project: { equals: project.id } },
    }),
    payload.find({
      collection: 'products',
      depth: 1,
      limit: 50,
      sort: '-updatedAt',
      overrideAccess: false,
      where: { project: { equals: project.id } },
    }),
  ])

  const services = servicesResult.docs
  const products = productsResult.docs

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <div className="hidden md:block">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              { href: '/projects', label: 'Проекты' },
              { href: `/projects/${project.slug}`, label: project.title },
              { label: 'Лавка' },
            ]}
          />
        </div>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Лавка</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Что мы предлагаем гостям и что можно у нас приобрести.
        </p>
        <div className="mt-6">
          <LavkaTabs current={tab} counts={{ services: services.length, shop: products.length }} />
        </div>
      </section>

      <section className="container mt-6">
        {tab === 'services' ? (
          services.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
              Пока услуги не добавлены.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  projectSlug={project.slug as string}
                  projectId={project.id}
                />
              ))}
            </div>
          )
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
            Пока товаров в лавке нет.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                projectSlug={project.slug as string}
                projectId={project.id}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
