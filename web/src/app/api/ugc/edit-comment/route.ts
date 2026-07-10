import { NextResponse } from 'next/server'

import { containsProfanity } from '@/server/ugc/profanity'
import { clampText } from '@/server/ugc/ugc'
import { getPayloadClient, isOwnerOf, isStaffRequest, mutateRateOk } from '@/server/ugc/ugcOwner'

// Редактировать «свой» комментарий (автор по токену) ИЛИ любой (персонал). Новый текст
// проходит тот же санитайз + стоп-фильтр мата, что и при создании. Статус не меняем.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 1000

export async function POST(req: Request) {
  if (!mutateRateOk(req.headers)) {
    return NextResponse.json({ error: 'Слишком много запросов. Попробуйте позже.' }, { status: 429 })
  }

  let id: number | null = null
  let rawBody: unknown
  try {
    const json = (await req.json()) as { id?: unknown; body?: unknown }
    if (typeof json.id === 'number' && Number.isInteger(json.id)) id = json.id
    rawBody = json.body
  } catch {
    /* ignore */
  }
  if (!id) return NextResponse.json({ error: 'Не указан комментарий.' }, { status: 400 })

  const body = clampText(rawBody, MAX_BODY)
  if (!body) return NextResponse.json({ error: 'Комментарий пуст.' }, { status: 400 })
  if (containsProfanity(body)) {
    return NextResponse.json({ error: 'Текст содержит недопустимые выражения.' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  let comment: { status?: string | null; ownerHash?: string | null; ownerVisitor?: number | null }
  try {
    comment = await payload.findByID({ collection: 'submission-comments', id, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'Комментарий не найден.' }, { status: 404 })
  }
  if (comment.status === 'removed') {
    return NextResponse.json({ error: 'Комментарий удалён.' }, { status: 409 })
  }

  const staff = await isStaffRequest(payload, req.headers)
  const isOwner = isOwnerOf(comment, req.headers)
  if (!staff && !isOwner) {
    return NextResponse.json({ error: 'Нет прав на редактирование.' }, { status: 403 })
  }

  await payload.update({ collection: 'submission-comments', id, data: { body }, overrideAccess: true })

  return NextResponse.json({ ok: true, body }, { status: 200 })
}
