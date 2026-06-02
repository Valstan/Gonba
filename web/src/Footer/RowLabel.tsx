'use client'
import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

export const RowLabel: React.FC<RowLabelProps> = () => {
  const data = useRowLabel<{ heading?: string }>()

  const n = data?.rowNumber !== undefined ? data.rowNumber + 1 : ''
  const label = data?.data?.heading ? `Колонка ${n}: ${data.data.heading}` : `Колонка ${n}`

  return <div>{label}</div>
}
