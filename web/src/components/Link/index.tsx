import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React from 'react'

import type { Event, Page, Post, Product, Project, Service } from '@/payload-types'

type CMSLinkType = {
  appearance?: 'inline' | ButtonProps['variant']
  children?: React.ReactNode
  className?: string
  label?: string | null
  newTab?: boolean | null
  reference?: {
    relationTo: 'pages' | 'posts' | 'projects' | 'events' | 'services' | 'products'
    value: Page | Post | Project | Event | Service | Product | string | number
  } | null
  size?: ButtonProps['size'] | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

export const CMSLink: React.FC<CMSLinkType> = (props) => {
  const {
    type,
    appearance = 'inline',
    children,
    className,
    label,
    newTab,
    reference,
    size: sizeFromProps,
    url,
  } = props

  const href = (() => {
    if (type !== 'reference' || typeof reference?.value !== 'object' || !reference.value.slug) {
      return url
    }

    const slug = reference.value.slug
    switch (reference.relationTo) {
      case 'pages':
        return `/${slug}`
      case 'posts':
        return `/posts/${slug}`
      case 'projects':
        return `/projects/${slug}`
      case 'events':
        return `/events/${slug}`
      case 'services':
        return `/services/${slug}`
      case 'products':
        return `/shop/${slug}`
      default:
        return url
    }
  })()

  if (!href) return null

  const size = appearance === 'link' ? 'clear' : sizeFromProps
  const newTabProps = newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  /* Ensure we don't break any styles set by richText */
  if (appearance === 'inline') {
    return (
      <Link className={cn(className)} href={href || url || ''} prefetch={false} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    )
  }

  return (
    <Button asChild className={className} size={size} variant={appearance}>
      <Link className={cn(className)} href={href || url || ''} prefetch={false} {...newTabProps}>
        {label && label}
        {children && children}
      </Link>
    </Button>
  )
}
