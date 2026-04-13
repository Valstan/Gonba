import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'
import { adminOrEditor } from '../../access/adminOrEditor'
import { anyone } from '../../access/anyone'
import { populatePublishedAt } from '../../hooks/populatePublishedAt'
import { defaultLexical } from '@/fields/defaultLexical'

export const Events: CollectionConfig<'events'> = {
  slug: 'events',
  labels: {
    singular: 'Событие',
    plural: 'События',
  },
  access: {
    create: adminOrEditor,
    delete: adminOrEditor,
    read: anyone,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['title', 'startDate', 'status', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'summary',
      type: 'textarea',
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
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
      name: 'location',
      type: 'text',
    },
    {
      name: 'price',
      type: 'number',
    },
    {
      name: 'currency',
      type: 'select',
      defaultValue: 'RUB',
      options: ['RUB', 'USD', 'EUR'],
    },
    {
      name: 'capacity',
      type: 'number',
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'content',
      type: 'richText',
      editor: defaultLexical,
    },
    {
      name: 'gallery',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
    },
    {
      name: 'bookingEnabled',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'eventStatus',
      type: 'select',
      defaultValue: 'active',
      options: ['active', 'cancelled', 'soldOut', 'completed'],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    slugField(),
  ],
  hooks: {
    beforeChange: [populatePublishedAt],
  },
  versions: {
    drafts: true,
  },
}
