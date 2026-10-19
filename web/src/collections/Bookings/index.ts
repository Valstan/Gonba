import type { CollectionConfig } from 'payload'

import { APIError } from 'payload'

import { adminOrManager } from '../../access/adminOrManager'
import { anyone } from '../../access/anyone'
import { rateLimit } from '@/server/ugc/rateLimit'
import { clientIp, isContentStaff } from '@/server/ugc/ugc'

export const Bookings: CollectionConfig<'bookings'> = {
  slug: 'bookings',
  labels: {
    singular: 'Бронирование',
    plural: 'Бронирования',
  },
  access: {
    // Публичное создание оставляем: заявку отправляет анонимный посетитель с сайта.
    // Предохранители — ниже, в хуке (лимит по IP + серверный статус), потому что
    // ограничения только в маршруте `/api/bookings` обходились прямым
    // `POST /api/bookings` в REST/GraphQL (аудит 2026-10-18).
    create: anyone,
    delete: adminOrManager,
    read: adminOrManager,
    update: adminOrManager,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data
        if (isContentStaff(req.user)) return data

        // 1) Статус назначает сервер: клиент не выбирает «обработано/оплачено».
        data.status = 'new'

        // 2) Лимит по IP на уровне коллекции. Ключ отдельный от лимита маршрута
        //    (`bookings:` против `bookings-collection:`), поэтому честный путь через
        //    `/api/bookings` не расходует счётчик дважды.
        const rl = rateLimit(`bookings-collection:${clientIp(req.headers)}`, 20, 10 * 60 * 1000)
        if (!rl.ok) {
          throw new APIError('Слишком много заявок с этого адреса. Попробуйте позже.', 429)
        }

        return data
      },
    ],
  },
  admin: {
    defaultColumns: ['customerName', 'type', 'status', 'createdAt'],
    useAsTitle: 'customerName',
  },
  fields: [
    {
      name: 'customerName',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: ['stay', 'event', 'tour', 'service', 'other'],
    },
    {
      name: 'project',
      type: 'relationship',
      relationTo: 'projects',
    },
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
    },
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
    },
    {
      name: 'guests',
      type: 'number',
    },
    {
      name: 'startDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: ['new', 'confirmed', 'cancelled', 'done'],
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'website',
      options: ['website', 'phone', 'vk', 'telegram', 'other'],
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
