import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../access/adminOrEditor'
import { adminOrEditorField } from '../access/adminOrEditorField'
import { anyone } from '../access/anyone'
import { publicVisibleOrStaff } from '../access/publicVisibleOrStaff'
import { rateLimitComment } from '../server/ugc/hooks/rateLimitComment'
import { recountComments } from '../server/ugc/hooks/recount'
import { stampSubmissionMeta } from '../server/ugc/hooks/stampSubmissionMeta'

// Комментарии к публикациям «Народной ленты». Постмодерация (как submissions): виден
// сразу, персонал скрывает/удаляет в /admin, жалобы → авто-скрытие на пороге.
// create=anyone, read=publicVisibleOrStaff (аноним только status=visible),
// update/delete=adminOrEditor. Служебные поля закрыты field-access на запись анонимом;
// ipHash/userAgent/reportCount/hiddenReason — и на публичное чтение.
export const SubmissionComments: CollectionConfig<'submission-comments'> = {
  slug: 'submission-comments',
  labels: {
    singular: 'Комментарий',
    plural: 'Комментарии ленты',
  },
  access: {
    create: anyone,
    read: publicVisibleOrStaff,
    update: adminOrEditor,
    delete: adminOrEditor,
  },
  admin: {
    defaultColumns: ['authorName', 'body', 'submission', 'status', 'reportCount', 'createdAt'],
    useAsTitle: 'authorName',
    group: 'Народная лента',
    description: 'Комментарии к публикациям ленты. Постмодерация: видно сразу, скрывайте при жалобах.',
  },
  fields: [
    {
      name: 'submission',
      type: 'relationship',
      label: 'Публикация',
      relationTo: 'submissions',
      required: true,
    },
    { name: 'authorName', type: 'text', label: 'Имя автора', maxLength: 64 },
    { name: 'body', type: 'textarea', label: 'Текст', required: true, maxLength: 1000 },

    // --- служебные поля: пишет сервер/хуки/персонал ---
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      defaultValue: 'visible',
      access: {
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      options: [
        { label: 'Видно', value: 'visible' },
        { label: 'Скрыто', value: 'hidden' },
        { label: 'Удалено', value: 'removed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'hiddenReason',
      type: 'text',
      label: 'Причина скрытия',
      access: {
        read: adminOrEditorField,
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { position: 'sidebar' },
    },
    {
      name: 'reportCount',
      type: 'number',
      label: 'Жалоб',
      defaultValue: 0,
      access: {
        read: adminOrEditorField,
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'ipHash',
      type: 'text',
      label: 'IP-хеш',
      access: {
        read: adminOrEditorField,
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { hidden: true },
    },
    {
      name: 'ownerHash',
      type: 'text',
      label: 'Владелец (хеш токена браузера)',
      // Автор правит/удаляет «свой» коммент по совпадению хеша токена (/api/ugc/*).
      index: true,
      access: {
        read: adminOrEditorField,
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { hidden: true },
    },
    {
      name: 'ownerVisitor',
      type: 'number',
      label: 'Владелец (VK-аккаунт)',
      // Задел под этап 5 (VK-вход) — до него всегда пуст.
      index: true,
      access: {
        read: adminOrEditorField,
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { hidden: true },
    },
    {
      name: 'userAgent',
      type: 'text',
      label: 'User-Agent',
      access: {
        read: adminOrEditorField,
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { hidden: true },
    },
  ],
  hooks: {
    beforeValidate: [rateLimitComment],
    beforeChange: [stampSubmissionMeta],
    afterChange: [recountComments.afterChange],
    afterDelete: [recountComments.afterDelete],
  },
  timestamps: true,
}
