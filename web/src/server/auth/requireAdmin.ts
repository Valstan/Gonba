import configPromise from '@payload-config'
import { createPayloadRequest } from 'payload'

export const requireAdmin = async (request: Request) => {
  const req = await createPayloadRequest({
    config: configPromise,
    request,
  })

  const user = req.user
  if (!user) {
    return { authorized: false, status: 401, message: 'Unauthorized' }
  }

  const roles = Array.isArray(user.roles) ? user.roles : []
  const isAdmin = roles.includes('admin') || roles.includes('manager')

  if (!isAdmin) {
    return { authorized: false, status: 403, message: 'Forbidden' }
  }

  return { authorized: true, user }
}
