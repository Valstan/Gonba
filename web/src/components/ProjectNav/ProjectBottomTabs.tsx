'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HomeIcon, NewspaperIcon, ShoppingBagIcon, ImageIcon, MessageCircleIcon, type LucideIcon } from 'lucide-react'
import React from 'react'

import { useProjectContext } from '@/providers/ProjectContext'
import { cn } from '@/utilities/ui'
import type { ProjectSectionKey } from '@/app/(frontend)/projects/shared'

type TabKey = 'home' | ProjectSectionKey

type TabConfig = {
  key: TabKey
  label: string
  Icon: LucideIcon
  href: (slug: string) => string
  isActive: (pathname: string, slug: string) => boolean
  section?: ProjectSectionKey // нужен в enabledSections, кроме home
}

const TABS: TabConfig[] = [
  {
    key: 'home',
    label: 'Главная',
    Icon: HomeIcon,
    href: (slug) => `/projects/${slug}`,
    isActive: (pathname, slug) => pathname === `/projects/${slug}`,
  },
  {
    key: 'feed',
    section: 'feed',
    label: 'Жизнь',
    Icon: NewspaperIcon,
    href: (slug) => `/projects/${slug}/feed`,
    isActive: (pathname, slug) => pathname.startsWith(`/projects/${slug}/feed`) || pathname.startsWith(`/projects/${slug}/posts`) || pathname.startsWith(`/projects/${slug}/events`),
  },
  {
    key: 'lavka',
    section: 'lavka',
    label: 'Лавка',
    Icon: ShoppingBagIcon,
    href: (slug) => `/projects/${slug}/lavka`,
    isActive: (pathname, slug) => pathname.startsWith(`/projects/${slug}/lavka`) || pathname.startsWith(`/projects/${slug}/services`) || pathname.startsWith(`/projects/${slug}/shop`),
  },
  {
    key: 'gallery',
    section: 'gallery',
    label: 'Галерея',
    Icon: ImageIcon,
    href: (slug) => `/projects/${slug}/gallery`,
    isActive: (pathname, slug) => pathname.startsWith(`/projects/${slug}/gallery`),
  },
  {
    key: 'chat',
    section: 'chat',
    label: 'Чат',
    Icon: MessageCircleIcon,
    href: (slug) => `/projects/${slug}/chat`,
    isActive: (pathname, slug) => pathname.startsWith(`/projects/${slug}/chat`),
  },
]

export const ProjectBottomTabs: React.FC = () => {
  const pathname = usePathname()
  const { project, enabledSections } = useProjectContext()

  if (!project) return null

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'home') return true
    if (!tab.section) return false
    return enabledSections.includes(tab.section)
  })

  return (
    <nav
      aria-label="Навигация проекта"
      className="fixed bottom-0 inset-x-0 z-30 md:hidden border-t border-border/80 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 pb-safe"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
        {visibleTabs.map((tab) => {
          const active = tab.isActive(pathname, project.slug as string)
          const { Icon } = tab
          return (
            <li key={tab.key}>
              <Link
                href={tab.href(project.slug as string)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 min-h-14 py-2 text-[11px] font-medium transition-colors',
                  active
                    ? 'text-[var(--project-accent)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                style={
                  active
                    ? { boxShadow: 'inset 0 2px 0 0 var(--project-accent)' }
                    : undefined
                }
              >
                <Icon className="size-5" aria-hidden />
                <span className="leading-tight">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
