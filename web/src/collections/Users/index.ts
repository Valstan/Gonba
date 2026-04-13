import type { CollectionConfig, PayloadRequest } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { adminOrSelf } from '../../access/adminOrSelf'

const adminAccess = ({ req }: { req: PayloadRequest }) => {
  return Boolean(req.user && Array.isArray(req.user.roles) && req.user.roles.includes('admin'))
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Пользователь',
    plural: 'Пользователи',
  },
  access: {
    admin: adminAccess,
    create: adminOnly,
    delete: adminOnly,
    read: adminOrSelf,
    update: adminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['user'],
      saveToJWT: true,
      options: ['admin', 'editor', 'manager', 'support', 'user'],
    },
  ],
  timestamps: true,
}
