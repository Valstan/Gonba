import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Media } from '@/components/Media'
import { queryProjectBySlug } from '../../queries'

export const dynamic = 'force-static'
export const revalidate = 600

type Args = {
  params: Promise<{
    slug: string
  }>
}

export const generateMetadata = async ({ params }: Args) => {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })

  if (!project) {
    return {
      title: 'Проект не найден',
    }
  }

  return {
    title: `${project.title} — Магазин`,
  }
}

export default async function ProjectShopPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const payload = await getPayload({ config: configPromise })
  const products = await payload.find({
    collection: 'products',
    depth: 1,
    sort: '-updatedAt',
    limit: 100,
    overrideAccess: false,
    where: {
      project: {
        equals: project.id,
      },
    },
  })

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <Breadcrumbs
          items={[
            { href: '/', label: 'Главная' },
            { href: '/projects', label: 'Проекты' },
            { href: `/projects/${project.slug}`, label: project.title },
            { label: 'Магазин' },
          ]}
        />
        <h1 className="mt-6 text-3xl font-semibold">Магазин проекта</h1>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.docs.length > 0 ? (
            products.docs.map((product) => (
              <article key={product.id} className="rounded-xl border border-border p-4">
                {product.images?.[0]?.image ? <Media resource={product.images[0].image} className="rounded-lg" /> : null}
                <h2 className="mt-4 text-lg font-medium">{product.title}</h2>
                {product.summary ? <p className="mt-2 text-sm text-muted-foreground">{product.summary}</p> : null}
                <p className="mt-2 text-sm text-muted-foreground">
                  {product.price} {product.currency}
                </p>
                <Link href={`/shop/${product.slug}`} className="mt-4 inline-block text-sm text-[var(--project-accent)] hover:underline">
                  Подробнее
                </Link>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Товаров пока нет.</p>
          )}
        </div>
      </section>
    </main>
  )
}
