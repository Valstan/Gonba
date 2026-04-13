import SectionDetailPage from './SectionDetailPage'

type Args = {
  params: Promise<{
    slug: string
  }>
}

export default function Page({ params }: Args) {
  return <SectionDetailPage params={params} />
}
