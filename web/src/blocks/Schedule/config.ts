import type { Block } from 'payload'

export const Schedule: Block = {
  slug: 'schedule',
  interfaceName: 'ScheduleBlock',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Заголовок',
    },
    {
      name: 'items',
      type: 'array',
      label: 'Пункты расписания',
      minRows: 1,
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Название',
          required: true,
        },
        {
          name: 'time',
          type: 'text',
          label: 'Время',
        },
        {
          name: 'note',
          type: 'text',
          label: 'Примечание',
        },
      ],
    },
  ],
  labels: {
    singular: 'Расписание',
    plural: 'Расписания',
  },
}
