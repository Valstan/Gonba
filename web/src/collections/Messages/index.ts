import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../../access/adminOrEditor'
import { adminOrEditorField } from '../../access/adminOrEditorField'
import { anyone } from '../../access/anyone'

export const Messages: CollectionConfig<'messages'> = {
  slug: 'messages',
  labels: {
    singular: 'Сообщение',
    plural: 'Сообщения',
  },
  access: {
    // Публичный read: посетители видят чат. Скрытые модерацией фильтруются на уровне endpoint.
    read: anyone,
    // Создание только через свой API-endpoint (с rate-limit и overrideAccess).
    create: adminOrEditor,
    update: adminOrEditor,
    delete: adminOrEditor,
  },
  admin: {
    defaultColumns: ['authorName', 'body', 'project', 'isModerated', 'createdAt'],
    useAsTitle: 'authorName',
    description: 'Сообщения чата проектов от посетителей.',
  },
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      index: true,
    },
    {
      name: 'authorName',
      type: 'text',
      required: true,
      maxLength: 64,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Заполняется автоматически, если посетитель авторизован.',
      },
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      maxLength: 2000,
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'messages',
      admin: {
        description: 'Родительское сообщение для ответа (треды).',
      },
    },
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      // admin.hidden прячет лишь из админ-UI; чтобы анти-абуз метаданные не
      // утекали через публичный GET /api/messages (read: anyone для чата) —
      // явный field-level read только для админа/редактора.
      access: { read: adminOrEditorField },
      admin: {
        hidden: true,
      },
    },
    {
      name: 'userAgent',
      type: 'text',
      access: { read: adminOrEditorField },
      admin: {
        hidden: true,
      },
    },
    {
      name: 'isModerated',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Если отмечено — сообщение скрыто на сайте.',
      },
    },
    {
      name: 'hiddenReason',
      type: 'text',
      // Причина скрытия — для админа, не для публичного чата.
      access: { read: adminOrEditorField },
      admin: {
        condition: (data) => Boolean(data?.isModerated),
        description: 'Причина скрытия (для админа).',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (typeof data?.body === 'string') {
          // Удаляем управляющие символы 0x00-0x1F кроме \n (0x0A) и \t (0x09), обрезаем
          data.body = data.body
            .replace(/[\x00-\x08\x0B-\x1F]/g, '')
            .slice(0, 2000)
            .trim()
        }
        if (typeof data?.authorName === 'string') {
          data.authorName = data.authorName.replace(/[\x00-\x1F]/g, '').slice(0, 64).trim()
        }
        return data
      },
    ],
  },
  timestamps: true,
}
