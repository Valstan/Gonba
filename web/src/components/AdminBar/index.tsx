'use client'

import type { PayloadAdminBarProps, PayloadMeUser } from '@payloadcms/admin-bar'
import { PayloadAdminBar } from '@payloadcms/admin-bar'
import Link from 'next/link'
import { usePathname, useSelectedLayoutSegments } from 'next/navigation'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

import { useAdminMode } from '@/providers/AdminMode'
import { cn } from '@/utilities/ui'
import { getClientSideURL } from '@/utilities/getURL'

import './index.scss'

const baseClass = 'admin-bar'

type AdminEditTarget = {
  found: boolean
  editUrl?: string
  title?: string | null
}

const collectionLabels = {
  pages: {
    plural: 'Страницы',
    singular: 'страницу',
  },
  posts: {
    plural: 'Посты',
    singular: 'пост',
  },
  projects: {
    plural: 'Проекты',
    singular: 'проект',
  },
  events: {
    plural: 'События',
    singular: 'событие',
  },
  services: {
    plural: 'Сервисы',
    singular: 'сервис',
  },
  products: {
    plural: 'Товары',
    singular: 'товар',
  },
  orders: {
    plural: 'Заказы',
    singular: 'заказ',
  },
  bookings: {
    plural: 'Бронирования',
    singular: 'бронирование',
  },
  media: {
    plural: 'Медиа',
    singular: 'медиа',
  },
  categories: {
    plural: 'Категории',
    singular: 'категорию',
  },
  users: {
    plural: 'Пользователи',
    singular: 'пользователя',
  },
}

const Title: React.FC = () => <span>Панель</span>

const getEditTarget = async (path: string) => {
  const response = await fetch(`/api/admin/edit-target?path=${encodeURIComponent(path || '/')}`, {
    credentials: 'include',
  })

  if (!response.ok) return null

  const json = (await response.json()) as AdminEditTarget
  return json
}

export const AdminBar: React.FC<{
  adminBarProps?: PayloadAdminBarProps
}> = (props) => {
  const { adminBarProps } = props || {}
  const { mode, setIsAdmin, setMode } = useAdminMode()
  const segments = useSelectedLayoutSegments()
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminEditTarget | null>(null)
  const collection = (
    collectionLabels[segments?.[1] as keyof typeof collectionLabels] ? segments[1] : 'pages'
  ) as keyof typeof collectionLabels
  const router = useRouter()
  const isManageMode = mode === 'manage'

  const onAuthChange = useCallback((user: PayloadMeUser) => {
    const isAuthorized = Boolean(user?.id)
    setShow(isAuthorized)
    setIsAdmin(isAuthorized)
  }, [setIsAdmin])

  useEffect(() => {
    let cancelled = false

    if (!show) {
      setEditTarget(null)
      return () => {
        cancelled = true
      }
    }

    const loadEditTarget = async () => {
      const data = await getEditTarget(pathname)
      if (!cancelled) {
        setEditTarget(data?.found ? data : null)
      }
    }

    void loadEditTarget()

    return () => {
      cancelled = true
    }
  }, [pathname, show])

  return (
    <div
      className={cn(baseClass, 'py-2 bg-black text-white', {
        block: show,
        hidden: !show,
        'admin-bar--manage': isManageMode,
        'admin-bar--view': !isManageMode,
      })}
    >
      <div className="container admin-bar__shell">
        <div className="admin-bar__modeSwitch" role="tablist" aria-label="Режим управления контентом">
          <button
            type="button"
            className={cn('admin-bar__modeButton', { 'is-active': mode === 'view' })}
            onClick={() => setMode('view')}
          >
            Просмотр
          </button>
          <button
            type="button"
            className={cn('admin-bar__modeButton', { 'is-active': mode === 'manage' })}
            onClick={() => setMode('manage')}
          >
            Управление
          </button>
        </div>

        <PayloadAdminBar
          {...adminBarProps}
          className="py-2 text-white"
          classNames={{
            controls: 'font-medium text-white',
            logo: 'text-white',
            user: 'text-white admin-bar__user',
            create: cn('text-white admin-bar__create', {
              'admin-bar__controlHidden': !isManageMode,
            }),
            edit: cn('text-white admin-bar__edit', {
              'admin-bar__controlHidden': !isManageMode,
            }),
            logout: 'text-white admin-bar__logout',
            preview: 'text-white admin-bar__preview',
          }}
          cmsURL={getClientSideURL()}
          collectionSlug={collection}
          collectionLabels={{
            plural: collectionLabels[collection]?.plural || 'Страницы',
            singular: collectionLabels[collection]?.singular || 'страницу',
          }}
          logo={<Title />}
          onAuthChange={onAuthChange}
          onPreviewExit={() => {
            fetch('/next/exit-preview').then(() => {
              router.push('/')
              router.refresh()
            })
          }}
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />

        {isManageMode ? (
          <div className="admin-bar__quick-actions">
            <Link href="/admin/collections/pages/create" className="admin-bar__actionLink">
              + Страница
            </Link>
            <Link href="/admin/collections/posts/create" className="admin-bar__actionLink">
              + Пост
            </Link>
            <Link href="/admin/collections/media" className="admin-bar__actionLink">
              Медиа
            </Link>
            <Link href="/admin/collections/projects" className="admin-bar__actionLink">
              Проекты
            </Link>
            <Link href="/vk-import" className="admin-bar__actionLink">
              Импорт VK
            </Link>
            {editTarget?.editUrl ? (
              <a href={editTarget.editUrl} className="admin-bar__actionLink">
                Редактировать {editTarget.title || 'текущий документ'}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
