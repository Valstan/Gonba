import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { Plugin } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'

import { Page, Post } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { adminOrEditor } from '@/access/adminOrEditor'

const generateTitle: GenerateTitle<Post | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | Жемчужина Вятки` : 'Жемчужина Вятки'
}

const generateURL: GenerateURL<Post | Page> = ({ doc }) => {
  const url = getServerSideURL()

  return doc?.slug ? `${url}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts'],
    overrides: {
      labels: {
        singular: 'Редирект',
        plural: 'Редиректы',
      },
      // Плагин задаёт только `read: () => true`; остальные операции падали в дефолт ядра
      // `Boolean(user)` — то есть **любая** учётка `users` (включая роль `user`) могла
      // создать `from: /любой-путь → https://чужой-сайт` и получить открытый редирект с
      // нашего домена, а также править и удалять настоящие редиректы (аудит 2026-10-18).
      access: {
        create: adminOrEditor,
        update: adminOrEditor,
        delete: adminOrEditor,
      },
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'После изменения этого поля нужно пересобрать сайт.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      labels: {
        singular: 'Форма',
        plural: 'Формы',
      },
      // Коллекция `forms` хранит адресатов уведомлений (`emails`), и плагин не задаёт ей
      // права на запись — по дефолту ядра их получал любой аутентифицированный. Достаточно
      // было `PATCH /api/forms/:id` с подменённым `emailTo`, чтобы **все последующие**
      // заявки сайта уходили на чужой адрес (аудит 2026-10-18).
      access: {
        create: adminOrEditor,
        update: adminOrEditor,
        delete: adminOrEditor,
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
    formSubmissionOverrides: {
      labels: {
        singular: 'Отправка формы',
        plural: 'Отправки форм',
      },
      // Здесь ПДн обратившихся (имя, телефон, e-mail, текст сообщения). Дефолт плагина —
      // `read: req.user?.collection === config.admin.user`, а это **любая** учётка коллекции
      // `users` любой роли; `delete` вообще не был задан и падал в `Boolean(user)`.
      // Создание оставляем публичным: форму заполняет анонимный посетитель.
      access: {
        read: adminOrEditor,
        delete: adminOrEditor,
      },
    },
  }),
  searchPlugin({
    collections: ['posts', 'pages', 'projects'],
    beforeSync: beforeSyncWithSearch,
    searchOverrides: {
      labels: {
        singular: 'Результат поиска',
        plural: 'Результаты поиска',
      },
      // Индекс поиска: `create` плагин запрещает (`() => false`), `read` оставляет публичным,
      // а `update`/`delete` не задаёт — их получал любой аутентифицированный (порча/чистка
      // индекса). Права на запись — персоналу (аудит 2026-10-18).
      access: {
        update: adminOrEditor,
        delete: adminOrEditor,
      },
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
]
