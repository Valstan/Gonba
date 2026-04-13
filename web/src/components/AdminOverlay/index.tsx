'use client'

import Link from 'next/link'
import React from 'react'

import { useAdminMode } from '@/providers/AdminMode'
import { cn } from '@/utilities/ui'

type ActionProps = {
  editUrl?: string
  addUrl?: string
  label?: string
  editLabel?: string
  addLabel?: string
  className?: string
}

const actionButtonClassName =
  'inline-flex items-center rounded-full border border-white/40 bg-black/80 px-3 py-1 text-xs font-medium text-white transition hover:border-white hover:bg-black'

export const AdminManageActions: React.FC<ActionProps> = ({
  addLabel,
  addUrl,
  className,
  editLabel,
  editUrl,
  label,
}) => {
  const { isAdmin, mode } = useAdminMode()

  if (!isAdmin || mode !== 'manage' || (!editUrl && !addUrl)) {
    return null
  }

  const resolvedEditLabel = editLabel || (label ? `Редактировать ${label}` : 'Редактировать')
  const resolvedAddLabel = addLabel || 'Добавить...'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {editUrl ? (
        <Link href={editUrl} className={actionButtonClassName}>
          {resolvedEditLabel}
        </Link>
      ) : null}
      {addUrl ? (
        <Link href={addUrl} className={actionButtonClassName}>
          {resolvedAddLabel}
        </Link>
      ) : null}
    </div>
  )
}

type AdminOverlayProps = ActionProps & {
  children: React.ReactNode
  contentClassName?: string
}

export const AdminOverlay: React.FC<AdminOverlayProps> = ({
  addLabel,
  addUrl,
  children,
  className,
  contentClassName,
  editLabel,
  editUrl,
  label,
}) => {
  const { isAdmin, mode } = useAdminMode()
  const hasActions = Boolean(editUrl || addUrl)

  if (!isAdmin || mode !== 'manage' || !hasActions) {
    return <>{children}</>
  }

  return (
    <div className={cn('group relative', className)}>
      <div className={cn('relative', contentClassName)}>{children}</div>
      <div className="pointer-events-none absolute inset-0 rounded-md border border-dashed border-blue-400/55 opacity-0 transition group-hover:opacity-100" />
      <AdminManageActions
        addLabel={addLabel}
        addUrl={addUrl}
        className="absolute right-2 top-2 z-20 opacity-0 transition group-hover:opacity-100"
        editLabel={editLabel}
        editUrl={editUrl}
        label={label}
      />
    </div>
  )
}
