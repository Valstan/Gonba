import configPromise from '@payload-config'
import { getPayload } from 'payload'

const HEALTH_TIMEOUT_MS = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 3000)

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Healthcheck timed out after ${timeoutMs}ms`)), timeoutMs)
    }),
  ])
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

    return Response.json({
      ok: true,
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      responseMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
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
