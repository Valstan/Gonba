import type { Block } from 'payload'

import { link } from '@/fields/link'

export const BookingCTA: Block = {
  slug: 'bookingCta',
  interfaceName: 'BookingCTABlock',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Заголовок',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Описание',
    },
    link({
      overrides: {
        name: 'action',
        label: 'Кнопка действия',
      },
    }),
  ],
  labels: {
    singular: 'Призыв к бронированию',
    plural: 'Призывы к бронированию',
  },
}
