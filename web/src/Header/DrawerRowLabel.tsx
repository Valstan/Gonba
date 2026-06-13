'use client'
import { Header } from '@/payload-types'
import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

const SECTION_LABELS: Record<string, string> = {
  stay: 'Пожить',
  do: 'Делать',
  see: 'Смотреть',
  shop: 'Лавка',
  extra: 'Доп.',
}

export const DrawerRowLabel: React.FC<RowLabelProps> = () => {
  const data = useRowLabel<NonNullable<Header['drawerItems']>[number]>()

  const section = data?.data?.section ? SECTION_LABELS[data.data.section] ?? data.data.section : '—'
  const title = data?.data?.link?.label
  const label = title ? `[${section}] ${title}` : `Пункт ${(data?.rowNumber ?? 0) + 1}`

  return <div>{label}</div>
}
