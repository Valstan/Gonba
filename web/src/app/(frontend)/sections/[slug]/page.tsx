import SectionDetailPage from './SectionDetailPage'

// generateMetadata/generateStaticParams определены во вложенном компоненте, а Next
// читает их ТОЛЬКО из page.tsx → реэкспортируем (иначе per-section SEO + SSG молча
// не работают). revalidate здесь же: SSG-страницы иначе заморозились бы без ISR
// (страница тянет живой контент из БД — посты/события проекта).
export { generateMetadata, generateStaticParams } from './SectionDetailPage'

export const revalidate = 600

type Args = {
  params: Promise<{
    slug: string
  }>
}

export default function Page({ params }: Args) {
  return <SectionDetailPage params={params} />
}
