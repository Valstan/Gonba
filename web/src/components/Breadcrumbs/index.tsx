import Link from 'next/link'
import React from 'react'

type Breadcrumb = {
  href?: string
  label: string
}

type Props = {
  items: Breadcrumb[]
}

export const Breadcrumbs: React.FC<Props> = ({ items }) => {
  if (items.length <= 1) {
    return null
  }

  return (
    <nav className="mb-4 text-sm" aria-label="Хлебные крошки">
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={`${item.href || item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {isLast ? (
                <span className="text-foreground" aria-current="page">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
