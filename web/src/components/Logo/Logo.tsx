import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { loading: loadingFromProps, priority: priorityFromProps, className } = props

  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || 'low'

  return (
    /* eslint-disable @next/next/no-img-element */
    <img
      alt="Жемчужина Вятки"
      width={320}
      height={48}
      loading={loading}
      fetchPriority={priority}
      decoding="async"
      className={clsx('w-full h-[48px] max-w-[12rem] sm:max-w-[16rem] md:max-w-[20rem]', className)}
      src="/branding/zhemchuzhina-vyatki.svg"
    />
  )
}
