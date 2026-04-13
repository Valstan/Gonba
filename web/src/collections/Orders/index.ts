import type { CollectionConfig } from 'payload'

import { adminOrManager } from '../../access/adminOrManager'
import { anyone } from '../../access/anyone'

export const Orders: CollectionConfig<'orders'> = {
  slug: 'orders',
  labels: {
    singular: 'Заказ',
    plural: 'Заказы',
  },
  access: {
    create: anyone,
    delete: adminOrManager,
    read: adminOrManager,
    update: adminOrManager,
  },
  admin: {
    defaultColumns: ['customerName', 'status', 'paymentStatus', 'createdAt'],
    useAsTitle: 'customerName',
  },
  fields: [
    {
      name: 'customerName',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          required: true,
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
        },
        {
          name: 'price',
          type: 'number',
          required: true,
        },
      ],
    },
    {
      name: 'total',
      type: 'number',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: ['new', 'processing', 'completed', 'cancelled'],
    },
    {
      name: 'paymentStatus',
      type: 'select',
      defaultValue: 'unpaid',
      options: ['unpaid', 'paid', 'refunded'],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
