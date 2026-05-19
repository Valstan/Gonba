import configPromise from '@payload-config'
import { getPayload } from 'payload'

import { getRequestIpHash } from '@/utilities/getRequestIpHash'
import { checkRateLimit } from '@/server/rate-limit/inMemory'
import { queryProjectBySlug } from '@/app/(frontend)/projects/queries'

const RATE_LIMIT_COUNT = 10
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_BODY_LENGTH = 2000
const MAX_NAME_LENGTH = 64
const MIN_NAME_LENGTH = 2

type RouteParams = { params: Promise<{ slug: string }> }

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // Удаляем угловые скобки (анти-HTML), управляющие символы кроме \n\t.
  const cleaned = value
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B-\x1F]/g, '')
    .trim()
  return cleaned.length > 0 ? cleaned : null
}

export async function GET(request: Request, { params }: RouteParams) {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const since = url.searchParams.get('since')
  const limitRaw = Number.parseInt(url.searchParams.get('limit') || '50', 10)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50

  const payload = await getPayload({ config: configPromise })

  const where: Record<string, unknown> = {
    project: { equals: project.id },
    isModerated: { not_equals: true },
  }
  if (since) {
    where.createdAt = { greater_than: since }
  }

  const result = await payload.find({
    collection: 'messages',
    where: where as never,
    sort: 'createdAt',
    limit,
    depth: 0,
    overrideAccess: true,
  })

  const messages = result.docs.map((m) => ({
    id: m.id,
    authorName: m.authorName,
    body: m.body,
    createdAt: m.createdAt,
  }))

  return Response.json(
    { messages, serverTime: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params
  const project = await queryProjectBySlug({ slug })
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.chat?.enabled) {
    return Response.json({ error: 'Чат отключён для этого проекта' }, { status: 404 })
  }

  const ipHash = getRequestIpHash(request.headers)
  const rl = checkRateLimit(`chat:${slug}:${ipHash}`, RATE_LIMIT_COUNT, RATE_LIMIT_WINDOW_MS)
  if (!rl.allowed) {
    return Response.json(
      { error: 'Слишком часто. Подождите немного.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const authorName = clean(body.authorName)?.slice(0, MAX_NAME_LENGTH)
  const messageBody = clean(body.body)?.slice(0, MAX_BODY_LENGTH)

  if (!authorName || authorName.length < MIN_NAME_LENGTH) {
    return Response.json({ error: 'Имя должно быть от 2 до 64 символов' }, { status: 400 })
  }
  if (!messageBody) {
    return Response.json({ error: 'Сообщение не может быть пустым' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  // Анти-дубликат: смотрим последние 5 сообщений от того же ipHash в этом проекте.
  const recent = await payload.find({
    collection: 'messages',
    where: {
      project: { equals: project.id },
      ipHash: { equals: ipHash },
    },
    sort: '-createdAt',
    limit: 5,
    overrideAccess: true,
    depth: 0,
  })
  if (recent.docs.some((m) => m.body === messageBody)) {
    return Response.json({ error: 'Это сообщение уже отправлено' }, { status: 409 })
  }

  const userAgent = (request.headers.get('user-agent') || '').slice(0, 500)
  const created = await payload.create({
    collection: 'messages',
    data: {
      project: project.id,
      authorName,
      body: messageBody,
      ipHash,
      userAgent,
      isModerated: false,
    },
    overrideAccess: true,
  })

  return Response.json({ id: created.id, createdAt: created.createdAt }, { status: 201 })
}
