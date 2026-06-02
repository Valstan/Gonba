import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../../access/adminOrEditor'
import {
  fetchVkGroupMeta,
  fetchVkUserMeta,
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
    // Конфиг источников содержит accessToken VK — НЕ публичный. read сужен до
    // adminOrEditor (раньше anyone → токен утекал через GET /api/vk-auto-sync).
    // Серверный код (syncAllVkSources, trigger-route) ходит через Local API с
    // overrideAccess:true и этим сужением не затрагивается.
    create: adminOrEditor,
    delete: adminOrEditor,
    read: adminOrEditor,
    update: adminOrEditor,
  },
  admin: {
    defaultColumns: ['communityUrl', 'communityName', 'isEnabled', 'syncIntervalHours', 'lastSyncStatus', 'updatedAt'],
    useAsTitle: 'communityName',
    description:
      'Заполняйте по шагам: «Источник VK» (только URL обязателен — остальное подтянется) → ' +
      '«Привязка к сайту» → «Параметры импорта». Журнал синхронизации — на последней вкладке.',
  },
  fields: [
    // Wizard-style: поля разнесены по табам, чтобы редактор шёл шаг за шагом
    // вместо длинной полотна-формы. Это улучшает онбординг новых редакторов:
    // первый шаг — только URL, метаданные подтягиваются hook'ом beforeValidate.
    {
      type: 'tabs',
      tabs: [
        {
          label: '1. Источник VK',
          description:
            'Введите URL сообщества — название, описание, аватар и ID группы заполнятся автоматически. ' +
            'Если что-то подтянулось не так — поправьте вручную.',
          fields: [
            {
              name: 'communityUrl',
              label: 'URL VK-сообщества',
              type: 'text',
              required: true,
              admin: {
                description:
                  'Полная ссылка, например https://vk.com/club229392127 или https://vk.com/vyatskaya_lepota.',
              },
            },
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
                  'Числовой ID группы (для club229392127 это 229392127). Извлекается из URL — заполнять руками не нужно.',
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
          ],
        },
        {
          label: '2. Привязка к сайту',
          description: 'Куда импортировать посты? Выберите проект и категорию из списка.',
          fields: [
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
                description: 'Выберите проект из списка. Slug заполнится автоматически.',
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
                  'Категория, в которую попадут импортированные посты. ' +
                  'Если нужной нет — создайте её в коллекции Categories.',
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
            {
              name: 'sectionSlug',
              label: 'Slug категории (служебное)',
              type: 'text',
              admin: {
                readOnly: true,
                description: 'Заполняется автоматически из выбранной категории.',
              },
            },
          ],
        },
        {
          label: '3. Параметры импорта',
          description:
            'Токен и расписание. Без токена импорт постов не запустится, но всё остальное сохранится — ' +
            'можно добавить токен позже.',
          fields: [
            {
              name: 'accessToken',
              label: 'Токен доступа VK',
              type: 'text',
              admin: {
                description:
                  'Сервисный токен VK для доступа к API сообщества. Можно оставить пустым на этапе создания ' +
                  'и заполнить позже. Без токена авто-импорт постов не пойдёт. Если оставить пустым, ' +
                  'для публичных метаданных используется общий токен из env (VK_TOKEN_VALSTAN/VITA/SERVICE/TOKEN).',
              },
            },
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
          ],
        },
        {
          label: '4. Журнал и статус',
          description: 'Здесь только для чтения — что и когда импортировалось, последняя ошибка.',
          fields: [
            {
              name: 'lastSyncedPostId',
              label: 'ID последнего импортированного поста',
              type: 'number',
              admin: {
                readOnly: true,
                description: 'Для отслеживания дубликатов.',
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
        },
      ],
    },

    // Sidebar — статус и счётчик. Видны на любом табе, чтобы редактор сразу
    // понимал «работает ли синхронизация» не переключаясь между шагами.
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

        // 1) Числовой id источника — заполняем из URL, если ещё не задан.
        //    Сообщество (groupId) и личная страница (userId) хранятся в одном
        //    поле `groupId`; тип (знак owner_id для wall.get) выводится из URL
        //    при синхронизации — отдельное поле/миграция не нужны.
        const identNumericId = ident.groupId ?? ident.userId
        if (identNumericId && !data.groupId) {
          data.groupId = identNumericId
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

        // Личная страница → users.get, сообщество/короткое имя → groups.getById
        const meta =
          ident.kind === 'user'
            ? await fetchVkUserMeta((ident.userId ?? (data.groupId as number | undefined)) ?? null, token)
            : await fetchVkGroupMeta(
                { groupId: data.groupId as number | undefined, screenName: data.screenName as string | undefined },
                token,
              )
        if (!meta) {
          req.payload.logger.warn(
            `[vk-auto-sync] Не удалось получить метаданные источника ${url} ` +
              `(возможно, токен заблокирован, страница приватна или тип источника не распознан).`,
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
