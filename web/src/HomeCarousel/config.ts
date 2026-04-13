import type { GlobalConfig } from 'payload'

import { adminOrManager } from '@/access/adminOrManager'

export const HomeCarousel: GlobalConfig = {
  slug: 'homeCarousel',
  label: 'Меню-карусель',
  access: {
    read: () => true,
    update: adminOrManager,
  },
  fields: [
    {
      name: 'center',
      label: 'Центральная кнопка',
      type: 'group',
      fields: [
        {
          name: 'title',
          label: 'Текст',
          type: 'text',
          defaultValue: 'Вятские олени',
        },
        {
          name: 'link',
          label: 'Ссылка',
          type: 'text',
          defaultValue: '/projects/gonba',
        },
        {
          name: 'image',
          label: 'Картинка',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
    {
      name: 'items',
      label: 'Кружки меню',
      type: 'array',
      maxRows: 12,
      fields: [
        {
          name: 'title',
          label: 'Текст',
          type: 'text',
          required: true,
        },
        {
          name: 'link',
          label: 'Ссылка',
          type: 'text',
          required: true,
        },
        {
          name: 'image',
          label: 'Картинка',
          type: 'upload',
          relationTo: 'media',
        },
      ],
    },
  ],
}
