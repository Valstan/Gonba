import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../access/adminOrEditor'
import { adminOrEditorField } from '../access/adminOrEditorField'
import { anyone } from '../access/anyone'
import { applyContentReport } from '../server/ugc/hooks/applyContentReport'
import { rateLimitReport } from '../server/ugc/hooks/rateLimitReport'
import { stampIpHash } from '../server/ugc/hooks/stampIpHash'

// Жалобы на контент ленты (предохранитель постмодерации). Цель — публикация или
// комментарий (targetType + targetId, полиморфно, не Payload-relationship). afterChange
// считает жалобы и авто-скрывает цель на пороге UGC_REPORT_HIDE_THRESHOLD до разбора.
// create=anyone (посетитель жалуется), read/update/delete=adminOrEditor (жалобы
// содержат ipHash и не должны перечисляться публично). Дедуп (цель+IP) — хук.
export const ContentReports: CollectionConfig<'content-reports'> = {
  slug: 'content-reports',
  labels: {
    singular: 'Жалоба',
    plural: 'Жалобы на контент',
  },
  access: {
    create: anyone,
    read: adminOrEditor,
    update: adminOrEditor,
    delete: adminOrEditor,
  },
  admin: {
    defaultColumns: ['targetType', 'targetId', 'reason', 'createdAt'],
    group: 'Народная лента',
    description: 'Жалобы посетителей на публикации/комментарии. На пороге цель скрывается авто.',
  },
  fields: [
    {
      name: 'targetType',
      type: 'select',
      label: 'Тип цели',
      required: true,
      options: [
        { label: 'Публикация', value: 'submission' },
        { label: 'Комментарий', value: 'comment' },
      ],
    },
    { name: 'targetId', type: 'number', label: 'ID цели', required: true, min: 1 },
    { name: 'reason', type: 'textarea', label: 'Причина', maxLength: 500 },
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
  ],
  hooks: {
    beforeValidate: [rateLimitReport],
    beforeChange: [stampIpHash],
    afterChange: [applyContentReport],
  },
  timestamps: true,
}
