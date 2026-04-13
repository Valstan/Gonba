import { redirect } from 'next/navigation'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function SectionsPage() {
  redirect('/projects')
}
