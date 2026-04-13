import type { Access } from 'payload'

export const adminOrManager: Access = ({ req: { user } }) => {
  if (!user || !Array.isArray(user.roles)) return false
  return user.roles.includes('admin') || user.roles.includes('manager')
}
