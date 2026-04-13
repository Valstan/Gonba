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
