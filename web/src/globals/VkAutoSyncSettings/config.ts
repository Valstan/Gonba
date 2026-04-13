import type { GlobalConfig } from 'payload'

import { adminOrEditor } from '../../access/adminOrEditor'

export const VkAutoSyncSettings: GlobalConfig = {
  slug: 'vkAutoSyncSettings',
  label: 'Настройки авто-импорта VK',
  access: {
    read: () => true,
    update: adminOrEditor,
  },
  fields: [
    {
      name: 'defaultSyncIntervalHours',
      type: 'number',
      defaultValue: 3,
      min: 1,
      max: 24,
      admin: {
        description: 'Интервал проверки по умолчанию для новых источников (часы).',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Глобальное включение/выключение авто-импорта.',
      },
    },
    {
      name: 'maxPostsPerSync',
      type: 'number',
      defaultValue: 1,
      min: 1,
      max: 10,
      admin: {
        description: 'Максимальное количество постов за одну синхронизацию (с каждого источника).',
      },
    },
    {
      name: 'downloadImages',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Скачивать ли изображения из VK в Media.',
      },
    },
    {
      name: 'autoPublish',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Автоматически публиковать посты (без черновика).',
      },
    },
  ],
}
