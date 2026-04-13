import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { syncVkSource, syncAllVkSources } from '@/server/integrations/vk-auto-sync'

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  // Проверяем авторизацию: CRON_SECRET или admin
  if (secret && authHeader !== `Bearer ${secret}`) {
    // Проверяем, есть ли пользователь (из админки)
    const authCookie = request.headers.get('cookie')
    if (!authCookie?.includes('payload-token')) {
      return Response.json(
        { error: 'Unauthorized. Provide Bearer CRON_SECRET or payload-token cookie.' },
        { status: 401 },
      )
    }
  }

  const payload = await getPayload({ config: configPromise })

  const body = await request.json().catch(() => ({}))

  // Seed: создать начальный источник
  if (body.seed) {
    try {
      const vkToken = process.env.VK_TOKEN_229392127 || process.env.VK_TOKEN
      if (!vkToken) {
        return Response.json({ error: 'VK token not found in env' }, { status: 500 })
      }

      const existing = await payload.find({
        collection: 'vkAutoSync',
        overrideAccess: true,
        limit: 1,
      })

      if (existing.docs.length > 0) {
        return Response.json({
          message: 'Source already exists',
          source: existing.docs[0],
        })
      }

      const source = await payload.create({
        collection: 'vkAutoSync',
        overrideAccess: true,
        data: {
          communityUrl: 'https://vk.com/club229392127',
          groupId: 229392127,
          accessToken: vkToken,
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

    return Response.json({
      success: true,
      total: results.length,
      successCount,
      importedCount,
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
