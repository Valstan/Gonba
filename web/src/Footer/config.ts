import type { GlobalConfig } from 'payload'

import { adminOrEditor } from '@/access/adminOrEditor'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  label: 'Подвал',
  access: {
    read: () => true,
    update: adminOrEditor,
  },
  fields: [
    {
      name: 'description',
      type: 'textarea',
      label: 'Описание под логотипом',
      admin: {
        description: 'Короткий текст под названием «Гоньба» в подвале.',
      },
    },
    {
      name: 'columns',
      type: 'array',
      label: 'Колонки ссылок',
      maxRows: 4,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
      fields: [
        {
          name: 'heading',
          type: 'text',
          label: 'Заголовок колонки',
        },
        {
          name: 'items',
          type: 'array',
          label: 'Ссылки',
          fields: [
            {
              name: 'label',
              type: 'text',
              label: 'Текст',
              required: true,
            },
            {
              name: 'href',
              type: 'text',
              label: 'Ссылка',
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: 'legalAddress',
      type: 'text',
      label: 'Адрес в строке копирайта',
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}
