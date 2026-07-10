import { NextResponse } from 'next/server'

import { deleteObject } from '@/server/ugc/s3'
import { getPayloadClient, isOwnerOf, isStaffRequest, mutateRateOk } from '@/server/ugc/ugcOwner'

// Удалить «свою» публикацию (автор по токену) ИЛИ любую (персонал). Мягкое удаление:
// status='removed' (исчезает из ленты, строка остаётся для аудита) + удаление файлов из
// Object Storage (честное «удалить файл» + экономия места). Идемпотентно.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MediaRow = { objectKey?: string | null; posterKey?: string | null }

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
  if (!id) return NextResponse.json({ error: 'Не указана публикация.' }, { status: 400 })

  const payload = await getPayloadClient()
  let sub: {
    status?: string | null
    ownerHash?: string | null
    ownerVisitor?: number | null
    objectKey?: string | null
    posterKey?: string | null
    media?: MediaRow[] | null
  }
  try {
    sub = await payload.findByID({ collection: 'submissions', id, depth: 0, overrideAccess: true })
  } catch {
    return NextResponse.json({ error: 'Публикация не найдена.' }, { status: 404 })
  }

  if (sub.status === 'removed') return NextResponse.json({ ok: true }, { status: 200 })

  const staff = await isStaffRequest(payload, req.headers)
  const isOwner = isOwnerOf(sub, req.headers)
  if (!staff && !isOwner) {
    return NextResponse.json({ error: 'Нет прав на удаление.' }, { status: 403 })
  }

  // Удаляем файлы из бакета (best-effort): обложку, её постер и ВСЕ доп. файлы поста.
  const keys = [sub.objectKey, sub.posterKey]
  for (const m of sub.media ?? []) keys.push(m?.objectKey, m?.posterKey)
  for (const key of keys) if (key) await deleteObject(key)

  await payload.update({
    collection: 'submissions',
    id,
    data: {
      status: 'removed',
      hiddenReason: isOwner && !staff ? 'удалено автором' : 'удалено персоналом',
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}
