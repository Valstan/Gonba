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
      <section className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <h1 className="text-2xl font-semibold">Нет доступа к разделу «Облако»</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            У вашей учетной записи сейчас нет прав для работы с Яндекс.Диском. Если доступ действительно нужен,
            обратитесь к администратору проекта.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/account"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/20"
            >
              Профиль
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/20"
            >
              Вернуться в админ-панель
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:px-6 lg:py-10">
        <div className="rounded-2xl border border-border bg-card/90 p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Общая медиабиблиотека</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Этот экран — единый маршрут для работы с файлами: яндекс-диск синхронизируется с коллекцией
                <b> Media</b> и используется как единый пул для контента.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/collections/media"
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/20"
              >
                Media в CMS
              </Link>
              <Link
                href="/admin/collections/media/create"
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/20"
              >
                Добавить в Media
              </Link>
              <Link
                href="/admin/globals/homeCarousel"
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/20"
              >
                Редактировать карусель
              </Link>
            </div>
          </div>
        </div>
      </section>
      <YandexDiskManager />
    </>
  )
}
