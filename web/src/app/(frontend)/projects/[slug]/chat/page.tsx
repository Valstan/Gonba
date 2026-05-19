import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import React from 'react'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ChatBoard, type ChatMessage } from '@/components/Chat/ChatBoard.client'
import { queryProjectBySlug } from '../../queries'

export const dynamic = 'force-dynamic'

type Args = { params: Promise<{ slug: string }> }

export const generateMetadata = async ({ params }: Args) => {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) return { title: 'Проект не найден' }
  return { title: `${project.title} — Чат` }
}

export default async function ProjectChatPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const project = await queryProjectBySlug({ slug })
  if (!project) return notFound()

  const enabled = Boolean(project.chat?.enabled)
  const placeholder = project.chat?.placeholder || 'Напишите сообщение...'

  let initialMessages: ChatMessage[] = []
  if (enabled) {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'messages',
      where: {
        project: { equals: project.id },
        isModerated: { not_equals: true },
      },
      sort: 'createdAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    initialMessages = result.docs.map((m) => ({
      id: m.id,
      authorName: m.authorName,
      body: m.body,
      createdAt: m.createdAt,
    }))
  }

  return (
    <main className="pb-20 pt-24">
      <section className="container">
        <div className="hidden md:block">
          <Breadcrumbs
            items={[
              { href: '/', label: 'Главная' },
              { href: '/projects', label: 'Проекты' },
              { href: `/projects/${project.slug}`, label: project.title },
              { label: 'Чат' },
            ]}
          />
        </div>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">Чат проекта</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {enabled
            ? 'Общайтесь с командой проекта и другими гостями. Регистрация не нужна — представьтесь только.'
            : 'Чат для этого проекта пока отключён.'}
        </p>
      </section>

      <section className="container mt-6">
        {enabled ? (
          <ChatBoard projectSlug={project.slug as string} initialMessages={initialMessages} placeholder={placeholder} />
        ) : (
          <p className="rounded-2xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
            Чат можно включить в админке: проект → раздел «Чат» → галочка «Включить».
          </p>
        )}
      </section>
    </main>
  )
}
