import type { CollectionConfig } from 'payload'

import { adminOrEditor } from '../access/adminOrEditor'
import { adminOrEditorField } from '../access/adminOrEditorField'
import { anyone } from '../access/anyone'
import { publicVisibleOrStaff } from '../access/publicVisibleOrStaff'
import { rateLimitSubmission } from '../server/ugc/hooks/rateLimitSubmission'
import { stampSubmissionMeta } from '../server/ugc/hooks/stampSubmissionMeta'
import { UGC_MAX_AUTHOR, UGC_MAX_CAPTION, UGC_MAX_FILES } from '../server/ugc/ugc'

// «Народная лента» (UGC): фото/видео, снятые посетителями и выложенные прямо на сайте.
// Портировано из Sabantuy (docs/plans/sabantuy-borrowings.md, этап 1; фазы фестиваля
// убраны). Одна строка = одна публикация. Медиа НЕ хранится здесь и НЕ идёт через наш
// бокс — в записи лежит только ключ объекта в Object Storage (objectKey), браузер
// тянет файл напрямую с S3. Основная Media/Я.Диск (ADR-0001) — отдельный контур.
//
// Модель доступа (server write-authz vs UI edit-gate):
//   create = публичный (посетитель выкладывает с сайта)
//   read   = публично ТОЛЬКО status='visible' (постмодерация; скрытое/удалённое в
//            публичный API не утекает), персонал видит всё
//   update/delete = ТОЛЬКО персонал (admin||editor)
//   Служебные поля (status/счётчики/ipHash/userAgent/hiddenReason) закрыты field-access
//   на запись анонимом (анти-подмена) — их ставит сервер/хуки.
//
// 152-ФЗ: обязательная галка consent (валидируется в true) — посетитель подтверждает
//   согласие и что контент его/приемлем. Личные данные минимизированы: имя автора —
//   опционально и свободной формой; IP не храним, только необратимый хеш (дедуп абьюза).
//
// Постмодерация (контент виден сразу): предохранители — rate-limit + стоп-фильтр мата
// (хук), «пожаловаться» → авто-скрытие на пороге, мгновенное скрытие/удаление в /admin.
// НЕ versioned (нет drafts) → нет `_v`-таблиц.
export const Submissions: CollectionConfig<'submissions'> = {
  slug: 'submissions',
  labels: {
    singular: 'Публикация (лента)',
    plural: 'Народная лента',
  },
  access: {
    create: anyone,
    read: publicVisibleOrStaff,
    update: adminOrEditor,
    delete: adminOrEditor,
  },
  admin: {
    defaultColumns: ['kind', 'status', 'authorName', 'likeCount', 'reportCount', 'createdAt'],
    useAsTitle: 'authorName',
    group: 'Народная лента',
    description:
      'Фото/видео от посетителей. Постмодерация: видно сразу, скрывайте/удаляйте здесь при жалобах. Медиа хранится в Object Storage (objectKey), не на боксе.',
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      label: 'Тип',
      required: true,
      options: [
        { label: 'Фото', value: 'photo' },
        { label: 'Видео', value: 'video' },
      ],
    },
    {
      name: 'objectKey',
      type: 'text',
      label: 'Ключ объекта (S3)',
      required: true,
      unique: true,
      admin: { description: 'media/lenta/<yyyymm>/<uuid>.<ext> — путь файла в бакете.' },
    },
    {
      name: 'posterKey',
      type: 'text',
      label: 'Ключ постера видео (S3)',
      admin: { description: 'Опц. кадр-обложка для видео.' },
    },
    { name: 'mime', type: 'text', label: 'MIME-тип', required: true },
    { name: 'bytes', type: 'number', label: 'Размер (байт)', min: 0 },
    { name: 'width', type: 'number', label: 'Ширина (px)', min: 0 },
    { name: 'height', type: 'number', label: 'Высота (px)', min: 0 },
    { name: 'durationSec', type: 'number', label: 'Длительность видео (с)', min: 0 },
    // Дополнительные файлы поста (в стиле ВК: одна подпись — несколько медиа). Поля
    // выше (kind/objectKey/…) — ОБЛОЖКА (файл №1); этот массив — файлы №2…№20. Всего
    // в посте ≤ UGC_MAX_FILES; здесь ≤ UGC_MAX_FILES-1. Серверная валидация формата
    // ключа/mime/размера каждого элемента — в rateLimitSubmission (анти-подмена пути).
    {
      name: 'media',
      type: 'array',
      label: 'Доп. файлы поста',
      maxRows: UGC_MAX_FILES - 1,
      admin: {
        description: `Файлы №2…№${UGC_MAX_FILES} поста (обложка — поля выше). Лента показывает их мозаикой, клик открывает галерею.`,
      },
      fields: [
        {
          name: 'kind',
          type: 'select',
          label: 'Тип',
          required: true,
          options: [
            { label: 'Фото', value: 'photo' },
            { label: 'Видео', value: 'video' },
          ],
        },
        { name: 'objectKey', type: 'text', label: 'Ключ объекта (S3)', required: true },
        { name: 'posterKey', type: 'text', label: 'Ключ постера видео (S3)' },
        { name: 'mime', type: 'text', label: 'MIME-тип', required: true },
        { name: 'bytes', type: 'number', label: 'Размер (байт)', min: 0 },
        { name: 'width', type: 'number', label: 'Ширина (px)', min: 0 },
        { name: 'height', type: 'number', label: 'Высота (px)', min: 0 },
        { name: 'durationSec', type: 'number', label: 'Длительность видео (с)', min: 0 },
      ],
    },
    { name: 'authorName', type: 'text', label: 'Имя автора', maxLength: UGC_MAX_AUTHOR },
    { name: 'caption', type: 'textarea', label: 'Подпись', maxLength: UGC_MAX_CAPTION },
    {
      name: 'consent',
      type: 'checkbox',
      label: 'Согласие (152-ФЗ + контент мой/приемлемый)',
      required: true,
      validate: (value: unknown) => value === true || 'Без согласия опубликовать нельзя.',
      admin: { description: 'Обязательно. Посетитель подтверждает при загрузке.' },
    },

    // --- служебные поля: пишет сервер/хуки, аноним их задать не может ---
    {
      name: 'status',
      type: 'select',
      label: 'Статус',
      defaultValue: 'visible',
      // Постмодерация: по умолчанию видно. Меняет только персонал (или авто-скрытие
      // хуком жалоб через overrideAccess).
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
      name: 'likeCount',
      type: 'number',
      label: 'Лайков',
      defaultValue: 0,
      // Публично читаемо (лента показывает счётчик), но пишет только сервер (хуки recount).
      access: {
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'commentCount',
      type: 'number',
      label: 'Комментариев',
      defaultValue: 0,
      access: {
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'viewCount',
      type: 'number',
      label: 'Просмотров',
      defaultValue: 0,
      access: {
        create: adminOrEditorField,
        update: adminOrEditorField,
      },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'reportCount',
      type: 'number',
      label: 'Жалоб',
      defaultValue: 0,
      // Не раскрываем публично число жалоб (read закрыт на персонал).
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
      // Не PII (необратимый хеш), но публично не отдаём — служебное поле дедупа/абьюза.
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
      // Хеш браузерного ownerToken — по нему автор удаляет/правит «своё» (/api/ugc/*).
      // Не PII, публично не отдаём; ставит хук на создании (анонимом не задаётся).
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
      // Задел под этап 5 (VK-вход): id строки visitors — управление «своим» с любого
      // устройства. Ставит хук из сессии-cookie на создании; до этапа 5 всегда пуст.
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
    // rateLimit/санитайз/валидация первым; затем проставление ipHash/userAgent.
    beforeValidate: [rateLimitSubmission],
    beforeChange: [stampSubmissionMeta],
  },
  timestamps: true,
}
