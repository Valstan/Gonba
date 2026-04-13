import { redirect } from 'next/navigation'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export default async function SectionPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  redirect(`/projects/${slug}`)
}
