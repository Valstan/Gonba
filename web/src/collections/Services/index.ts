import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'
import { adminOrEditor } from '../../access/adminOrEditor'
import { anyone } from '../../access/anyone'
import { populatePublishedAt } from '../../hooks/populatePublishedAt'
import { defaultLexical } from '@/fields/defaultLexical'

export const Services: CollectionConfig<'services'> = {
  slug: 'services',
  labels: {
    singular: 'Сервис',
    plural: 'Сервисы',
  },
  access: {
    create: adminOrEditor,
    delete: adminOrEditor,
    read: anyone,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['title', 'project', 'status', 'updatedAt'],
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
      name: 'description',
      type: 'richText',
      editor: defaultLexical,
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
      name: 'duration',
      type: 'text',
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bookingEnabled',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'serviceStatus',
      type: 'select',
      defaultValue: 'active',
      options: ['active', 'paused', 'archived'],
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
