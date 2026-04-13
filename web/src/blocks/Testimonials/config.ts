import type { Block } from 'payload'

export const Testimonials: Block = {
  slug: 'testimonials',
  interfaceName: 'TestimonialsBlock',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Заголовок',
    },
    {
      name: 'items',
      type: 'array',
      label: 'Отзывы',
      minRows: 1,
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Имя',
          required: true,
        },
        {
          name: 'role',
          type: 'text',
          label: 'Роль',
        },
        {
          name: 'quote',
          type: 'textarea',
          label: 'Текст отзыва',
          required: true,
        },
        {
          name: 'photo',
          type: 'upload',
          relationTo: 'media',
          label: 'Фото',
        },
      ],
    },
  ],
  labels: {
    singular: 'Отзыв',
    plural: 'Отзывы',
  },
}
