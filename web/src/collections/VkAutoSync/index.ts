import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../../access/adminOrEditor'
import { anyone } from '../../access/anyone'
import {
  fetchVkGroupMeta,
  getEnvFallbackVkToken,
  parseVkCommunityIdentifier,
} from '../../server/integrations/vk-auto-sync-resolve'

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
    defaultColumns: ['communityUrl', 'communityName', 'isEnabled', 'syncIntervalHours', 'lastSyncStatus', 'updatedAt'],
    useAsTitle: 'communityName',
    description:
      'Достаточно ввести URL VK-сообщества — система сама подтянет название, описание, аватарку и ID группы. ' +
      'Токен можно вставить позже, без него синхронизация постов не запустится, но всё остальное сохранится.',
  },
  fields: [
    {
      name: 'communityUrl',
      label: 'URL VK-сообщества',
      type: 'text',
      required: true,
      admin: {
        description:
          'Полная ссылка на сообщество, например https://vk.com/club229392127 или https://vk.com/vyatskaya_lepota. ' +
          'После сохранения остальные поля заполнятся автоматически.',
      },
    },

    // ===== Автоматически подтягиваемые поля (можно отредактировать вручную) =====
    {
      name: 'communityName',
      label: 'Название сообщества',
      type: 'text',
      admin: {
        description: 'Заполняется автоматически из VK после сохранения. Можно отредактировать вручную.',
      },
    },
    {
      name: 'communityDescription',
      label: 'Описание сообщества',
      type: 'textarea',
      admin: {
        description: 'Берётся из VK. Используется как краткое описание источника в админке.',
      },
    },
    {
      name: 'communityAvatar',
      label: 'Аватарка сообщества (URL)',
      type: 'text',
      admin: {
        description: 'Прямая ссылка на аватарку группы VK. Подтягивается автоматически.',
      },
    },
    {
      name: 'groupId',
      label: 'ID группы VK',
      type: 'number',
      admin: {
        description:
          'Числовой ID группы (для club229392127 это 229392127). Извлекается из URL автоматически — заполнять руками не нужно.',
      },
    },
    {
      name: 'screenName',
      label: 'Короткое имя (screen_name)',
      type: 'text',
      admin: {
        description: 'Короткое имя сообщества из VK (если есть). Подтягивается автоматически.',
      },
    },

    // ===== Токен — можно отложить =====
    {
      name: 'accessToken',
      label: 'Токен доступа VK',
      type: 'text',
      admin: {
        description:
          'Сервисный токен VK для доступа к API сообщества. ' +
          'Можно оставить пустым на этапе создания и заполнить позже — без токена авто-импорт не пойдёт. ' +
          'Если оставить пустым, для получения публичных метаданных используется общий токен из переменных окружения.',
      },
    },

    // ===== Привязки к сайту =====
    // UX: пользователь выбирает проект/категорию из списка (dropdown), а текстовые
    // slug-поля заполняются автоматически из выбранной связи. Сами text-поля
    // оставлены для backwards compatibility с server-функцией syncVkSource.
    {
      name: 'project',
      label: 'Проект на сайте',
      type: 'relationship',
      relationTo: 'projects',
      required: true,
      admin: {
        description: 'Выберите проект из списка. Slug заполнится автоматически из его поля slug.',
      },
    },
    {
      name: 'category',
      label: 'Категория (раздел)',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      admin: {
        description:
          'Выберите категорию, в которую попадут импортированные посты. ' +
          'Если нужной категории нет — создайте её в коллекции Categories.',
      },
    },
    {
      name: 'sectionSlug',
      label: 'Slug категории (служебное)',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Заполняется автоматически из выбранной категории.',
      },
    },
    {
      name: 'projectSlug',
      label: 'Slug проекта (служебное)',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Заполняется автоматически из выбранного проекта.',
      },
    },

    // ===== Параметры синхронизации =====
    {
      name: 'syncIntervalHours',
      label: 'Интервал синхронизации (часы)',
      type: 'number',
      required: true,
      defaultValue: 3,
      min: 1,
      max: 24,
      admin: {
        description: 'Как часто проверять новые посты, в часах (1–24).',
      },
    },
    {
      name: 'isEnabled',
      label: 'Включено',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Если выключить — синхронизация для этого источника не выполняется.',
      },
    },
    {
      name: 'postType',
      label: 'Тип постов',
      type: 'select',
      required: true,
      defaultValue: 'news',
      options: [
        { label: 'Новости', value: 'news' },
        { label: 'Блог', value: 'blog' },
        { label: 'Анонсы', value: 'announcement' },
        { label: 'Истории', value: 'story' },
      ],
      admin: {
        description: 'Какой тип создаваемых постов на сайте.',
      },
    },

    // ===== Служебные поля (read-only) =====
    {
      name: 'lastSyncedPostId',
      label: 'ID последнего импортированного поста',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'ID последнего импортированного поста из VK (для отслеживания дубликатов).',
      },
    },
    {
      name: 'lastSyncStatus',
      label: 'Статус последней синхронизации',
      type: 'select',
      options: [
        { label: 'Успех', value: 'success' },
        { label: 'Ошибка', value: 'error' },
        { label: 'Ожидание', value: 'pending' },
        { label: 'Нет новых постов', value: 'no-new-posts' },
      ],
      defaultValue: 'pending',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'lastSyncAt',
      label: 'Последняя синхронизация',
      type: 'date',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'lastError',
      label: 'Последняя ошибка',
      type: 'textarea',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'totalImported',
      label: 'Всего импортировано',
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
      label: 'Журнал синхронизации',
      type: 'array',
      maxRows: 50,
      admin: {
        description: 'Последние 50 записей лога синхронизации.',
      },
      fields: [
        {
          name: 'timestamp',
          label: 'Время',
          type: 'date',
          required: true,
        },
        {
          name: 'status',
          label: 'Статус',
          type: 'select',
          options: [
            { label: 'Успех', value: 'success' },
            { label: 'Ошибка', value: 'error' },
            { label: 'Нет новых постов', value: 'no-new-posts' },
            { label: 'Пропущено', value: 'skipped' },
          ],
          required: true,
        },
        {
          name: 'message',
          label: 'Сообщение',
          type: 'text',
        },
        {
          name: 'postId',
          label: 'ID поста',
          type: 'number',
        },
      ],
    },
  ],
  hooks: {
    // Автозаполнение метаданных группы и slug'ов привязок при создании/правке.
    // Срабатывает на beforeValidate, чтобы required-проверки уже видели заполненный groupId.
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (!data) return data
        if (operation !== 'create' && operation !== 'update') return data

        // ---- Slug'и привязок: project → projectSlug, category → sectionSlug ----
        const projectRef = (data as { project?: unknown }).project
        if (projectRef != null) {
          const projectId = typeof projectRef === 'object' ? (projectRef as { id?: number | string }).id : projectRef
          if (projectId != null) {
            try {
              const proj = await req.payload.findByID({
                collection: 'projects',
                id: projectId as number | string,
                depth: 0,
                overrideAccess: true,
              })
              if (proj && typeof (proj as { slug?: string }).slug === 'string') {
                ;(data as Record<string, unknown>).projectSlug = (proj as { slug: string }).slug
              }
            } catch (e) {
              req.payload.logger.warn(`[vk-auto-sync] Не удалось получить slug проекта ${String(projectId)}: ${String(e)}`)
            }
          }
        }

        const categoryRef = (data as { category?: unknown }).category
        if (categoryRef != null) {
          const categoryId = typeof categoryRef === 'object' ? (categoryRef as { id?: number | string }).id : categoryRef
          if (categoryId != null) {
            try {
              const cat = await req.payload.findByID({
                collection: 'categories',
                id: categoryId as number | string,
                depth: 0,
                overrideAccess: true,
              })
              if (cat && typeof (cat as { slug?: string }).slug === 'string') {
                ;(data as Record<string, unknown>).sectionSlug = (cat as { slug: string }).slug
              }
            } catch (e) {
              req.payload.logger.warn(`[vk-auto-sync] Не удалось получить slug категории ${String(categoryId)}: ${String(e)}`)
            }
          }
        }

        // ---- VK метаданные (как раньше) ----
        const url = typeof data.communityUrl === 'string' ? data.communityUrl : ''
        if (!url.trim()) return data

        const ident = parseVkCommunityIdentifier(url)
        if (!ident) return data

        // 1) ID группы — заполняем из URL, если ещё не задан
        if (ident.groupId && !data.groupId) {
          data.groupId = ident.groupId
        }
        if (ident.screenName && !data.screenName) {
          data.screenName = ident.screenName
        }

        // 2) Метаданные — подтягиваем только если пользователь не заполнил их вручную
        const needsMeta = !data.communityName || !data.communityDescription || !data.communityAvatar
        if (!needsMeta) return data

        const token =
          (typeof data.accessToken === 'string' && data.accessToken.trim()) ||
          getEnvFallbackVkToken() ||
          null

        if (!token) {
          // без токена метаданные не получим — сохранение пройдёт, токен можно добавить позже
          req.payload.logger.info(
            `[vk-auto-sync] Источник ${url}: токен не задан, метаданные не загружены. ` +
              `Добавьте токен позже и сохраните источник снова.`,
          )
          return data
        }

        const meta = await fetchVkGroupMeta(
          { groupId: data.groupId as number | undefined, screenName: data.screenName as string | undefined },
          token,
        )
        if (!meta) {
          req.payload.logger.warn(
            `[vk-auto-sync] Не удалось получить метаданные группы ${url} (возможно, токен заблокирован или сообщество приватно).`,
          )
          return data
        }

        if (!data.communityName && meta.name) data.communityName = meta.name
        if (!data.communityDescription && meta.description) data.communityDescription = meta.description
        if (!data.communityAvatar && meta.avatarUrl) data.communityAvatar = meta.avatarUrl
        if (!data.groupId && meta.groupId) data.groupId = meta.groupId
        if (!data.screenName && meta.screenName) data.screenName = meta.screenName

        return data
      },
    ],
  },
}
