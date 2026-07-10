import { NextResponse } from 'next/server'

import { getPayloadClient, isOwnerOf, isStaffRequest, mutateRateOk } from '@/server/ugc/ugcOwner'

// Удалить «свой» комментарий (автор по токену) ИЛИ любой (персонал). Мягкое удаление:
// status='removed' → afterChange-хук пересчитывает commentCount (видимые) на публикации.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!mutateRateOk(req.headers)) {
    return NextResponse.json({ error: 'Слишком много запросов. Попробуйте позже.' }, { status: 429 })
  }

  let id: number | null = null
  try {
    const body = (await req.json()) as { id?: unknown }
    if (typeof body.id === 'number' && Number.isInteger(body.id)) id = body.id
  } catch {
    /* ignore */
  }
  if (!id) return NextResponse.json({ error: 'Не указан комментарий.' }, { status: 400 })

  const payload = await getPayloadClient()
  let comment: { status?: string | null; ownerHash?: string | null; ownerVisitor?: number | null }
  try {
    comment = await payload.findByID({ collection: 'submission-comments', id, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'Комментарий не найден.' }, { status: 404 })
  }

  if (comment.status === 'removed') return NextResponse.json({ ok: true }, { status: 200 })

  const staff = await isStaffRequest(payload, req.headers)
  const isOwner = isOwnerOf(comment, req.headers)
  if (!staff && !isOwner) {
    return NextResponse.json({ error: 'Нет прав на удаление.' }, { status: 403 })
  }

  await payload.update({
    collection: 'submission-comments',
    id,
    data: {
      status: 'removed',
      hiddenReason: isOwner && !staff ? 'удалено автором' : 'удалено персоналом',
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
