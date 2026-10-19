import type { CollectionConfig } from 'payload'

import { adminOrManager } from '../../access/adminOrManager'

export const Orders: CollectionConfig<'orders'> = {
  slug: 'orders',
  labels: {
    singular: 'Заказ',
    plural: 'Заказы',
  },
  access: {
    // Заказы создаются только из админки: в витрине нет оформления заказа, ни один
    // маршрут приложения их не пишет (аудит 2026-10-18 — проверено grep'ом по `collection: 'orders'`).
    // Публичное `create: anyone` означало, что аноним мог наполнить очередь заказов
    // поддельными заявками с произвольной суммой и статусом оплаты.
    create: adminOrManager,
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
