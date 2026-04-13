import type { CollectionConfig } from 'payload'

import { adminOrManager } from '../../access/adminOrManager'
import { anyone } from '../../access/anyone'

export const Bookings: CollectionConfig<'bookings'> = {
  slug: 'bookings',
  labels: {
    singular: 'Бронирование',
    plural: 'Бронирования',
  },
  access: {
    create: anyone,
    delete: adminOrManager,
    read: adminOrManager,
    update: adminOrManager,
  },
  admin: {
    defaultColumns: ['customerName', 'type', 'status', 'createdAt'],
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
      required: true,
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: ['stay', 'event', 'tour', 'service', 'other'],
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
    },
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
    },
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
    },
    {
      name: 'guests',
      type: 'number',
    },
    {
      name: 'startDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: ['new', 'confirmed', 'cancelled', 'done'],
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'website',
      options: ['website', 'phone', 'vk', 'telegram', 'other'],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
