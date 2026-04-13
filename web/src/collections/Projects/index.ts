import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'
import { adminOrEditor } from '../../access/adminOrEditor'
import { anyone } from '../../access/anyone'
import { populatePublishedAt } from '../../hooks/populatePublishedAt'
import { defaultLexical } from '@/fields/defaultLexical'

export const Projects: CollectionConfig<'projects'> = {
  slug: 'projects',
  labels: {
    singular: 'Проект',
    plural: 'Проекты',
  },
  access: {
    create: adminOrEditor,
    delete: adminOrEditor,
    read: anyone,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['title', 'projectType', 'isActive', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'shortLabel',
      type: 'text',
      required: true,
      defaultValue: 'Проект',
      admin: {
        description: 'Короткое название для меню и карточек.',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Логотип/иконка проекта для хедера и карточек.',
      },
    },
    {
      name: 'accentColor',
      type: 'text',
      admin: {
        description: 'HEX-цвет, например #2d7a4f',
      },
    },
    {
      name: 'enabledSections',
      type: 'select',
      hasMany: true,
      defaultValue: ['posts', 'events', 'services', 'shop', 'contacts'],
      options: ['posts', 'events', 'services', 'shop', 'gallery', 'contacts'],
      admin: {
        description: 'Какие подразделы будут доступны в этом проектном “дворике”.',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 10,
      admin: {
        description: 'Порядок в карусели и списке проектов.',
      },
    },
    {
      name: 'projectType',
      type: 'select',
      required: true,
      options: ['deerFarm', 'ecoHotel', 'craftStudio', 'travelClub', 'productLine', 'other'],
    },
    {
      name: 'summary',
      type: 'textarea',
    },
    {
      name: 'description',
      type: 'richText',
      editor: defaultLexical,
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
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
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'address',
          type: 'text',
        },
        {
          name: 'mapUrl',
          type: 'text',
        },
        {
          name: 'coordinates',
          type: 'text',
          admin: {
            description: 'Широта,Долгота (например: 56.5240, 50.6830)',
          },
        },
      ],
    },
    {
      name: 'contacts',
      type: 'group',
      fields: [
        {
          name: 'phone',
          type: 'text',
        },
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'whatsApp',
          type: 'text',
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
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
