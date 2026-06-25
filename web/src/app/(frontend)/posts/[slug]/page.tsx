import type { Metadata } from 'next'

import { RelatedPosts } from '@/blocks/RelatedPosts/Component'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'
import RichText from '@/components/RichText'

import type { Post } from '@/payload-types'

import { PostHero } from '@/heros/PostHero'
import { generateMeta } from '@/utilities/generateMeta'
import { withRetry } from '@/utilities/withRetry'
import { JsonLd } from '@/components/seo/JsonLd'
import { articleJsonLd } from '@/seo/jsonld'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { PostEditor } from '@/components/InlineEdit/PostEditor.client'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const params = posts.docs.map(({ slug }) => {
    return { slug }
  })

  return params
}

type Args = {
  params: Promise<{
    slug?: string
  }>
}

export default async function Post({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/posts/' + decodedSlug
  const post = await queryPostBySlug({ slug: decodedSlug })

  if (!post) return <PayloadRedirects url={url} />

  const hero = post.heroImage
  const heroImageId =
    hero && typeof hero === 'object' ? hero.id : typeof hero === 'number' || typeof hero === 'string' ? hero : null
  const heroImageUrl = hero && typeof hero === 'object' ? hero.url ?? null : null

  return (
    <>
      <JsonLd data={articleJsonLd(post, url)} />
      <article className="pt-16 pb-16">
        {/* z-20 поднимает крошки над PostHero (у него -mt-[10.4rem] + relative z-10),
            иначе hero перехватывает клики по ссылкам крошек. overlay — белый текст
            с тенью, читаемо поверх тёмного hero. */}
        <div className="container relative z-20">
          <Breadcrumbs
            variant="overlay"
            items={[
              { href: '/', label: 'Главная' },
              { href: '/posts', label: 'Посты' },
              { label: post.title || decodedSlug },
            ]}
          />
        </div>
        <PageClient />

        {/* Allows redirects for valid pages too */}
        <PayloadRedirects disableNotFound url={url} />

        {draft && <LivePreviewListener />}

        <PostHero post={post} />

        <PostEditor
          post={{
            id: post.id,
            title: post.title || '',
            content: post.content,
            heroImageId,
            heroImageUrl,
          }}
        />

        <div className="flex flex-col items-center gap-4 pt-8">
          <div className="container">
            <RichText className="max-w-[48rem] mx-auto" data={post.content} enableGutter={false} />
            {post.relatedPosts && post.relatedPosts.length > 0 && (
              <RelatedPosts
                className="mt-12 max-w-[52rem] lg:grid lg:grid-cols-subgrid col-start-1 col-span-3 grid-rows-[2fr]"
                docs={post.relatedPosts.filter((post) => typeof post === 'object')}
              />
            )}
          </div>
        </div>
      </article>
    </>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const post = await queryPostBySlug({ slug: decodedSlug })

  return generateMeta({ doc: post })
}

const queryPostBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  // pool #040: ретрай против транзиентного сбоя БД. Бросает после ретраев →
  // ISR не кэширует ложный 404; null (0 docs) = реально нет → штатный 404.
  const result = await withRetry(() =>
    payload.find({
      collection: 'posts',
      draft,
      limit: 1,
      overrideAccess: draft,
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
