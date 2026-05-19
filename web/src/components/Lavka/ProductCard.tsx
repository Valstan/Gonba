import React from 'react'
import Link from 'next/link'

import type { Product } from '@/payload-types'
import { Media } from '@/components/Media'
import { BookingDialog } from './BookingDialog'

const formatPrice = (price?: number | null, currency?: string | null) => {
  if (price == null) return null
  const cur = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₽'
  return `${price.toLocaleString('ru-RU')} ${cur}`
}

type Props = {
  product: Product
  projectSlug: string
  projectId: number
}

export const ProductCard: React.FC<Props> = ({ product, projectSlug, projectId }) => {
  const price = formatPrice(product.price, product.currency)
  const firstImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0]?.image : null
  const outOfStock = product.inStock === false

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
      {firstImage ? (
        <div className="aspect-[4/5] overflow-hidden">
          <Media resource={firstImage} className="h-full w-full" imgClassName="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[4/5] bg-muted/40" />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          <Link href={product.slug ? `/shop/${product.slug}` : `/projects/${projectSlug}/lavka?tab=shop`}>
            {product.title}
          </Link>
        </h3>
        {product.summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{product.summary}</p> : null}
        <div className="mt-auto flex flex-col gap-2">
          {price ? <div className="text-base font-semibold text-[var(--project-accent)]">{price}</div> : null}
          {outOfStock ? (
            <p className="text-sm text-muted-foreground">Сейчас нет в наличии</p>
          ) : (
            <BookingDialog
              mode="product"
              itemId={product.id}
              itemTitle={product.title}
              projectId={projectId}
              triggerLabel="Заказать"
            />
          )}
        </div>
      </div>
    </article>
  )
}
