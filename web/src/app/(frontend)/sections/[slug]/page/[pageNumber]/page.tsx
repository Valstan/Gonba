import { redirect } from 'next/navigation'

import type { Metadata } from 'next/types'

type Args = {
  params: Promise<{
    slug: string
    pageNumber: string
  }>
}

export const revalidate = 600
export const dynamicParams = true

export default async function SectionSlugPaginationPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  redirect(`/projects/${slug}`)
}

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug } = await paramsPromise
  return {
    title: `Раздел ${slug} перенаправляется`,
  }
}
