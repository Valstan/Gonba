import type { Block } from 'payload'

export const Gallery: Block = {
  slug: 'gallery',
  interfaceName: 'GalleryBlock',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Заголовок',
    },
    {
      name: 'items',
      type: 'array',
      label: 'Изображения',
      minRows: 1,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Изображение',
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
    singular: 'Галерея',
    plural: 'Галереи',
  },
}
