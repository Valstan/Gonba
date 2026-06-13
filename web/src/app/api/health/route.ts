import configPromise from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { summarizeVkSyncHealth, type VkSyncHealth } from '@/server/integrations/vk-sync-health'

const HEALTH_TIMEOUT_MS = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 3000)

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Healthcheck timed out after ${timeoutMs}ms`)), timeoutMs)
    }),
  ])
}

/**
 * VK auto-sync health — informational, НЕ влияет на HTTP-статус /api/health.
 * Liveness и deploy-smoke ждут 200; провал VK не должен ронять health (иначе
 * протухший токен = рестарт-петля / красный деплой). Внешний мониторинг алертит
 * по полю `.vkSync.healthy === false`. Любая ошибка/таймаут → healthy:null.
 */
const computeVkSyncHealth = async (
  payload: Payload,
): Promise<VkSyncHealth | { healthy: null; error: string }> => {
  try {
    const res = await withTimeout(
      payload.find({
        collection: 'vk-auto-sync',
        overrideAccess: true,
        depth: 0,
        limit: 100,
        where: { isEnabled: { equals: true } },
      }),
      HEALTH_TIMEOUT_MS,
    )
    return summarizeVkSyncHealth(res.docs, Date.now())
  } catch (error) {
    return { healthy: null, error: error instanceof Error ? error.message : 'vkSync check failed' }
  }
}

export async function GET() {
  const startedAt = Date.now()

  try {
    const payload = await withTimeout(getPayload({ config: configPromise }), HEALTH_TIMEOUT_MS)

    await withTimeout(
      payload.count({
        collection: 'users',
        overrideAccess: true,
      }),
      HEALTH_TIMEOUT_MS,
    )

    const vkSync = await computeVkSyncHealth(payload)

    return Response.json({
      ok: true,
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      responseMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      vkSync,
    })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        status: 'unhealthy',
        responseMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown healthcheck error',
      },
      { status: 503 },
    )
  }
}
