import type { Block } from 'payload'

export const MediaBlock: Block = {
  slug: 'mediaBlock',
  interfaceName: 'MediaBlock',
  fields: [
    {
      name: 'items',
      type: 'array',
      label: 'Медиафайлы',
      minRows: 1,
      admin: {
        description: 'Добавьте одно или несколько изображений/видео в этот блок.',
      },
      fields: [
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          label: 'Файл',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Подпись',
        },
      ],
    },
  ],
  labels: {
    singular: 'Медиа',
    plural: 'Медиаблоки',
  },
}
