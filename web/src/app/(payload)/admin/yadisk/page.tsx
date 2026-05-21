import React from 'react'
import Link from 'next/link'

import { YandexDiskManager } from '@/components/YandexDiskManager'
import { getMeUser } from '@/utilities/getMeUser'

export default async function YandexDiskPage() {
  const targetPath = '/admin/yadisk'
  const loginPath = `/admin/login?redirect=${encodeURIComponent(targetPath)}`
  const { user } = await getMeUser({ nullUserRedirect: loginPath })
  const roles = user?.roles || []
  const canUseCloud = roles.includes('admin') || roles.includes('manager')

  if (!canUseCloud) {
    return (
      <section className="yadisk yadisk__noaccess">
        <div className="yadisk__noaccess-card">
          <h1 className="yadisk__noaccess-title">Нет доступа к разделу «Облако»</h1>
          <p className="yadisk__noaccess-text">
            У вашей учетной записи сейчас нет прав для работы с Яндекс.Диском. Если доступ
            действительно нужен, обратитесь к администратору проекта.
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
    )
  }

  return (
    <div className="yadisk">
      <section className="yadisk__hero">
        <div className="yadisk__hero-card">
          <div className="yadisk__hero-text">
            <h1 className="yadisk__hero-title">Общая медиабиблиотека</h1>
            <p className="yadisk__hero-subtitle">
              Этот экран — единый маршрут для работы с файлами: яндекс-диск синхронизируется
              с коллекцией <b>Media</b> и используется как единый пул для контента.
            </p>
          </div>
          <div className="yadisk__hero-actions">
            <Link href="/admin/collections/media" className="yadisk__pill-link">
              Media в CMS
            </Link>
            <Link href="/admin/collections/media/create" className="yadisk__pill-link">
              Добавить в Media
            </Link>
            <Link href="/admin/globals/homeCarousel" className="yadisk__pill-link">
              Редактировать карусель
            </Link>
          </div>
        </div>
      </section>
      <YandexDiskManager />
    </div>
  )
}
