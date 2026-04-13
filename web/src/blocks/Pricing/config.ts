import type { Block } from 'payload'

export const Pricing: Block = {
  slug: 'pricing',
  interfaceName: 'PricingBlock',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Заголовок',
    },
    {
      name: 'items',
      type: 'array',
      label: 'Позиции',
      minRows: 1,
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Название',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'Описание',
        },
        {
          name: 'price',
          type: 'number',
          label: 'Цена',
        },
        {
          name: 'unit',
          type: 'text',
          label: 'Единица',
        },
      ],
    },
  ],
  labels: {
    singular: 'Прайс',
    plural: 'Прайсы',
  },
}
