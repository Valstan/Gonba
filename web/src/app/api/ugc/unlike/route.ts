import type { Where } from 'payload'

import { NextResponse } from 'next/server'

import { getPayloadClient, mutateRateOk, requestOwnerHash, requestVisitorId } from '@/server/ugc/ugcOwner'

// Отменить «свой» лайк: ищем реакцию по (submission, ownerHash текущего браузера) и
// удаляем → afterDelete-хук пересчитывает likeCount на публикации. Только владелец
// (по токену) — лайки персональны, «чужой» лайк отменять некому. Идемпотентно.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!mutateRateOk(req.headers)) {
    return NextResponse.json({ error: 'Слишком много запросов. Попробуйте позже.' }, { status: 429 })
  }

  const owner = requestOwnerHash(req.headers)
  const visitorId = requestVisitorId(req.headers)
  if (!owner && !visitorId) return NextResponse.json({ error: 'Нет токена владельца.' }, { status: 400 })

  let submissionId: number | null = null
  try {
    const body = (await req.json()) as { submissionId?: unknown }
    if (typeof body.submissionId === 'number' && Number.isInteger(body.submissionId)) {
      submissionId = body.submissionId
    }
  } catch {
    /* ignore */
  }
  if (!submissionId) return NextResponse.json({ error: 'Не указана публикация.' }, { status: 400 })

  // Реакция «своя», если совпал браузерный токен (ownerHash) ИЛИ VK-аккаунт (ownerVisitor).
  const orConds: Where[] = []
  if (owner) orConds.push({ ownerHash: { equals: owner } })
  if (visitorId) orConds.push({ ownerVisitor: { equals: visitorId } })

  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'submission-reactions',
    where: { and: [{ submission: { equals: submissionId } }, { or: orConds }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const reaction = found.docs[0]
  if (!reaction) return NextResponse.json({ ok: true, removed: false }, { status: 200 })

  await payload.delete({ collection: 'submission-reactions', id: reaction.id, overrideAccess: true })

  return NextResponse.json({ ok: true, removed: true }, { status: 200 })
}
