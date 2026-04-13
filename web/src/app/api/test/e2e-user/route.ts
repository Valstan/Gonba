import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { User } from '@/payload-types'

const isE2EEnabled = () => process.env.ENABLE_E2E_HELPERS === 'true'

const isAuthorized = (request: Request) => {
  const expectedSecret = process.env.E2E_TEST_SECRET || 'local-e2e-secret'
  const providedSecret = request.headers.get('x-e2e-secret') || ''
  return providedSecret === expectedSecret
}

type SeedBody = {
  email?: string
  password?: string
  roles?: User['roles']
  name?: string
}

export async function POST(request: Request) {
  if (!isE2EEnabled()) {
    return Response.json({ error: 'E2E helpers are disabled' }, { status: 404 })
  }
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config: configPromise })
  const body = (await request.json()) as SeedBody
  const email = (body.email || '').trim()
  const password = body.password || ''
  const roles: User['roles'] =
    Array.isArray(body.roles) && body.roles.length ? body.roles : ['admin']
  const name = body.name || 'E2E Admin'

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required' }, { status: 400 })
  }

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: email,
      },
    },
    overrideAccess: true,
  })

  const created = await payload.create({
    collection: 'users',
    data: {
      email,
      password,
      roles,
      name,
    },
    overrideAccess: true,
    draft: false,
  })

  return Response.json({ ok: true, id: created.id })
}

export async function DELETE(request: Request) {
  if (!isE2EEnabled()) {
    return Response.json({ error: 'E2E helpers are disabled' }, { status: 404 })
  }
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config: configPromise })
  const body = (await request.json()) as SeedBody
  const email = (body.email || '').trim()
  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 })
  }

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: email,
      },
    },
    overrideAccess: true,
  })

  return Response.json({ ok: true })
}
