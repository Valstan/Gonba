'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type TabValue = 'services' | 'shop'

type Props = {
  current: TabValue
  counts: { services: number; shop: number }
}

export const LavkaTabs: React.FC<Props> = ({ current, counts }) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('tab', value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={current} onValueChange={onChange} className="w-full">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="services" className="flex-1 sm:flex-none">
          Что предлагаем
          {counts.services > 0 ? (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{counts.services}</span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="shop" className="flex-1 sm:flex-none">
          Готовое
          {counts.shop > 0 ? (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{counts.shop}</span>
          ) : null}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
