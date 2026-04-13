import type { Access } from 'payload'

export const adminOrEditor: Access = ({ req: { user } }) => {
  if (!user || !Array.isArray(user.roles)) return false
  return user.roles.includes('admin') || user.roles.includes('editor')
}
