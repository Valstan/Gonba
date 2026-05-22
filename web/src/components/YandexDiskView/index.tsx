import type { AdminViewServerProps } from 'payload'

import { DefaultTemplate } from '@payloadcms/next/templates'
import Link from 'next/link'
import React from 'react'

import { YandexDiskManager } from '@/components/YandexDiskManager'

/**
 * Custom Payload admin view — облако Яндекс.Диска.
 *
 * Регистрируется в `payload.config.ts` через `admin.components.views.yadisk`
 * с `path: '/yadisk'` → URL `/admin/yadisk`.
 *
 * View сам рендерит `DefaultTemplate`, поэтому пользователь видит обычный
 * sidebar + AppHeader Payload-админки (а не «отдельную» страницу как раньше,
 * когда был кастомный Next.js маршрут `(payload)/admin/yadisk/page.tsx`).
 *
 * Доступ проверяется по ролям `admin` / `manager` — при отсутствии прав
 * рендерится no-access сообщение внутри того же шаблона (с меню), чтобы
 * пользователь мог уйти куда-то в админке.
 */
const YandexDiskView: React.FC<AdminViewServerProps> = ({
  initPageResult,
  params,
  searchParams,
}) => {
  const {
    locale,
    permissions,
    req: { i18n, payload, user },
    visibleEntities,
  } = initPageResult

  const roles = user?.roles || []
  const canUseCloud = roles.includes('admin') || roles.includes('manager')

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user ?? undefined}
      visibleEntities={visibleEntities}
    >
      {!canUseCloud ? (
        <section className="yadisk yadisk__noaccess">
          <div className="yadisk__noaccess-card">
            <h1 className="yadisk__noaccess-title">Нет доступа к разделу «Облако»</h1>
            <p className="yadisk__noaccess-text">
              У вашей учетной записи сейчас нет прав для работы с Яндекс.Диском.
              Если доступ действительно нужен, обратитесь к администратору проекта.
            </p>
            <div className="yadisk__noaccess-actions">
              <Link href="/admin/account" className="yadisk__pill-link">
                Профиль
              </Link>
              <Link href="/admin" className="yadisk__pill-link">
                Вернуться в админ-панель
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <div className="yadisk">
          <section className="yadisk__hero">
            <div className="yadisk__hero-card">
              <div className="yadisk__hero-text">
                <h1 className="yadisk__hero-title">Общая медиабиблиотека</h1>
                <p className="yadisk__hero-subtitle">
                  Этот экран — единый маршрут для работы с файлами: яндекс-диск
                  синхронизируется с коллекцией <b>Media</b> и используется как
                  единый пул для контента.
                </p>
              </div>
              <div className="yadisk__hero-actions">
                <Link href="/admin/collections/media" className="yadisk__pill-link">
                  Media в CMS
                </Link>
                <Link
                  href="/admin/collections/media/create"
                  className="yadisk__pill-link"
                >
                  Добавить в Media
                </Link>
                <Link
                  href="/admin/globals/homeCarousel"
                  className="yadisk__pill-link"
                >
                  Редактировать карусель
                </Link>
              </div>
            </div>
          </section>
          <YandexDiskManager />
        </div>
      )}
    </DefaultTemplate>
  )
}

export default YandexDiskView
