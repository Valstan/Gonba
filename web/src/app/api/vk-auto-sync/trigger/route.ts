import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { syncVkSource, syncAllVkSources } from '@/server/integrations/vk-auto-sync'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  // Проверяем авторизацию: CRON_SECRET Bearer ИЛИ staff-роль (admin/editor/manager),
  // подтверждённая payload.auth — а не просто наличие cookie 'payload-token'.
  // Раньше при пустом CRON_SECRET проверка обходилась полностью.
  const hasValidSecret = Boolean(secret) && authHeader === `Bearer ${secret}`
  if (!hasValidSecret) {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    const roles = user && Array.isArray(user.roles) ? (user.roles as string[]) : []
    const isStaff = roles.some((r) => r === 'admin' || r === 'editor' || r === 'manager')
    if (!isStaff) {
      return Response.json(
        { error: 'Unauthorized. Provide Bearer CRON_SECRET or a staff account.' },
        { status: 401 },
      )
    }
  }

  const payload = await getPayload({ config: configPromise })

  const body = await request.json().catch(() => ({}))

  // Seed: создать начальный источник
  if (body.seed) {
    try {
      if (!process.env.SARAFAN_GATEWAY_KEY) {
        return Response.json({ error: 'SARAFAN_GATEWAY_KEY not found in env' }, { status: 500 })
      }

      const existing = await payload.find({
        collection: 'vk-auto-sync',
        overrideAccess: true,
        limit: 1,
      })

      if (existing.docs.length > 0) {
        return Response.json({
          message: 'Source already exists',
          source: existing.docs[0],
        })
      }

      // С новой схемой project/category — relationship, обязательные.
      // Находим их по slug, чтобы seed работал на любом env.
      const projectDoc = await payload.find({
        collection: 'projects',
        overrideAccess: true,
        limit: 1,
        where: { slug: { equals: 'vyatskaya-lepota' } },
      })
      const categoryDoc = await payload.find({
        collection: 'categories',
        overrideAccess: true,
        limit: 1,
        where: { slug: { equals: 'vyatskaya-lepota-malmyzh' } },
      })
      const projectId = projectDoc.docs[0]?.id
      const categoryId = categoryDoc.docs[0]?.id

      if (!projectId || !categoryId) {
        return Response.json(
          {
            error: 'Seed: не найдены проект "vyatskaya-lepota" или категория "vyatskaya-lepota-malmyzh" в CMS.',
          },
          { status: 400 },
        )
      }

      const source = await payload.create({
        collection: 'vk-auto-sync',
        overrideAccess: true,
        data: {
          communityUrl: 'https://vk.com/club229392127',
          groupId: 229392127,
          project: projectId,
          category: categoryId,
          sectionSlug: 'vyatskaya-lepota-malmyzh',
          projectSlug: 'vyatskaya-lepota',
          syncIntervalHours: 3,
          isEnabled: true,
          postType: 'news',
          lastSyncStatus: 'pending',
        },
      })

      return Response.json({
        success: true,
        message: 'VK Auto-Sync source created',
        source,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return Response.json({ error: message }, { status: 500 })
    }
  }

  const sourceId = body.sourceId as number | undefined

  try {
    let results

    if (sourceId) {
      // Синхронизируем конкретный источник
      const result = await syncVkSource(payload, sourceId)
      results = [result]
    } else {
      // Синхронизируем все источники
      results = await syncAllVkSources(payload)
    }

    const successCount = results.filter((r) => r.success).length
    const importedCount = results.filter((r) => r.newPostId).length
    const errorCount = results.filter((r) => r.status === 'error').length

    return Response.json({
      success: true,
      total: results.length,
      successCount,
      importedCount,
      errorCount,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function GET() {
  return Response.json({
    message: 'VK Auto-Sync API',
    endpoints: {
      trigger: 'POST /api/vk-auto-sync/trigger',
      triggerSingle: 'POST /api/vk-auto-sync/trigger (body: { sourceId: number })',
    },
  })
}
