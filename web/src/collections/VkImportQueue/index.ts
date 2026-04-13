import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'

export const VkImportQueue: CollectionConfig<'vkImportQueue'> = {
  slug: 'vkImportQueue',
  labels: {
    singular: 'Заявка импорта VK',
    plural: 'Очередь импорта VK',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  admin: {
    defaultColumns: ['status', 'title', 'sourceGroupId', 'sourcePostId', 'queuedAt', 'createdAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      options: ['queued', 'published', 'discarded'],
      admin: {
        description: 'queued — ожидает модерации; published — уже опубликовано; discarded — удален из очереди вручную',
      },
    },
    {
      name: 'sourceGroupId',
      type: 'number',
      required: true,
      index: true,
    },
    {
      name: 'sourcePostId',
      type: 'number',
      required: true,
      index: true,
    },
    {
      name: 'sourceUrl',
      type: 'text',
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'text',
      type: 'textarea',
      admin: {
        description: 'Полный текст поста из VK',
      },
    },
    {
      name: 'previewText',
      type: 'textarea',
      admin: {
        description: 'Короткая превью-строка',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'suggestedSections',
      type: 'array',
      fields: [
        {
          name: 'slug',
          type: 'text',
          required: true,
        },
      ],
      admin: {
        description: 'Разделы, предложенные автоматической классификацией',
      },
    },
    {
      name: 'suggestedDestination',
      type: 'select',
      options: ['posts', 'events', 'services', 'products', 'pages'],
      admin: {
        description: 'Рекомендуемый тип целевого контента',
      },
    },
    {
      name: 'suggestedDestinationScore',
      type: 'number',
    },
    {
      name: 'suggestedDestinationHints',
      type: 'array',
      fields: [
        {
          name: 'item',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'detectedDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'queuedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'publishedPostId',
      type: 'relationship',
      relationTo: 'posts',
    },
    {
      name: 'sourceMeta',
      type: 'json',
      admin: {
        description: 'Технические метаданные из импорта',
      },
    },
  ],
  timestamps: true,
}
