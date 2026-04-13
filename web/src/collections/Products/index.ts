import type { CollectionConfig } from 'payload'

import { slugField } from 'payload'
import { adminOrEditor } from '../../access/adminOrEditor'
import { anyone } from '../../access/anyone'
import { defaultLexical } from '@/fields/defaultLexical'

export const Products: CollectionConfig<'products'> = {
  slug: 'products',
  labels: {
    singular: 'Товар',
    plural: 'Товары',
  },
  access: {
    create: adminOrEditor,
    delete: adminOrEditor,
    read: anyone,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['title', 'price', 'inStock', 'updatedAt'],
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
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'description',
      type: 'richText',
      editor: defaultLexical,
    },
    {
      name: 'sku',
      type: 'text',
    },
    {
      name: 'price',
      type: 'number',
      required: true,
    },
    {
      name: 'currency',
      type: 'select',
      defaultValue: 'RUB',
      options: ['RUB', 'USD', 'EUR'],
    },
    {
      name: 'images',
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
      name: 'inStock',
      type: 'checkbox',
      defaultValue: true,
    },
    slugField(),
  ],
}
