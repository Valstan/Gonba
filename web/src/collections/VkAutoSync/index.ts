import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../../access/adminOrEditor'
import { anyone } from '../../access/anyone'

export const VkAutoSync: CollectionConfig<'vk-auto-sync'> = {
  slug: 'vk-auto-sync',
  labels: {
    singular: 'Источник авто-импорта VK',
    plural: 'Источники авто-импорта VK',
  },
  access: {
    create: adminOrEditor,
    delete: adminOrEditor,
    read: anyone,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['communityUrl', 'isEnabled', 'syncIntervalHours', 'lastSyncStatus', 'updatedAt'],
    useAsTitle: 'communityUrl',
    description: 'Настройки автоматического импорта постов из VK сообществ.',
  },
  fields: [
    {
      name: 'communityUrl',
      type: 'text',
      required: true,
      admin: {
        description: 'URL VK-сообщества, например: https://vk.com/club229392127',
      },
    },
    {
      name: 'groupId',
      type: 'number',
      required: true,
      admin: {
        description: 'Numeric ID группы VK (без минуса). Для club229392127 это 229392127.',
      },
    },
    {
      name: 'accessToken',
      type: 'text',
      required: true,
      admin: {
        description: 'Сервисный токен VK для доступа к API сообщества.',
      },
    },
    {
      name: 'sectionSlug',
      type: 'text',
      required: true,
      defaultValue: 'vyatskaya-lepota-malmyzh',
      admin: {
        description: 'Slug секции, к которой привязываются посты. Например: vyatskaya-lepota-malmyzh',
      },
    },
    {
      name: 'projectSlug',
      type: 'text',
      required: true,
      defaultValue: 'vyatskaya-lepota',
      admin: {
        description: 'Slug проекта в CMS, к которому привязываются посты.',
      },
    },
    {
      name: 'syncIntervalHours',
      type: 'number',
      required: true,
      defaultValue: 3,
      min: 1,
      max: 24,
      admin: {
        description: 'Интервал проверки в часах (1-24). По умолчанию: 3.',
      },
    },
    {
      name: 'isEnabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Включён ли авто-импорт для этого сообщества.',
      },
    },
    {
      name: 'postType',
      type: 'select',
      required: true,
      defaultValue: 'news',
      options: ['news', 'blog', 'announcement', 'story'],
      admin: {
        description: 'Тип создаваемых постов.',
      },
    },
    {
      name: 'lastSyncedPostId',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'ID последнего импортированного поста из VK (для отслеживания дубликатов).',
      },
    },
    {
      name: 'lastSyncStatus',
      type: 'select',
      options: ['success', 'error', 'pending', 'no-new-posts'],
      defaultValue: 'pending',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'lastSyncAt',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'lastError',
      type: 'textarea',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'totalImported',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Общее количество импортированных постов.',
      },
    },
    {
      name: 'syncLog',
      type: 'array',
      maxRows: 50,
      admin: {
        description: 'Последние 50 записей лога синхронизации.',
      },
      fields: [
        {
          name: 'timestamp',
          type: 'date',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          options: ['success', 'error', 'no-new-posts', 'skipped'],
          required: true,
        },
        {
          name: 'message',
          type: 'text',
        },
        {
          name: 'postId',
          type: 'number',
        },
      ],
    },
  ],
  hooks: {},
  versions: {
    drafts: false,
  },
}
