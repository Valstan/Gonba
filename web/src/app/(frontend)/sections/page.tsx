import type { Metadata } from 'next'

import SectionMapPage from './SectionMapPage'

// Route-config и metadata Next читает ТОЛЬКО из page.tsx. Раньше они жили во
// вложенном SectionMapPage → Next молча их игнорировал (SEO/кэш не применялись).
export const dynamic = 'force-static'
export const revalidate = 600

export const metadata: Metadata = {
  title: 'Миры Жемчужины Вятки — все разделы',
  description: 'Выберите тематический раздел и погрузитесь в его атмосферу.',
}

export default function Page() {
  return <SectionMapPage />
}
