import { Banner } from '@payloadcms/ui/elements/Banner'
import Link from 'next/link'
import React from 'react'

import { SeedButton } from './SeedButton'
import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Добро пожаловать в админ‑панель!</h4>
      </Banner>
      Быстрые действия:
      <ul className={`${baseClass}__instructions`}>
        <li>
          <Link href="/admin/collections/media">Открыть медиа-базу Payload</Link>
        </li>
        <li>
          <Link href="/admin/yadisk">Открыть общую медиабиблиотеку (Яндекс.Облако)</Link>
        </li>
        <li>
          <Link href="/admin/collections/projects">Управление проектами (карусель на главной)</Link>
        </li>
        <li>
          <Link href="/admin/collections/pages">Быстро перейти к страницам</Link>
        </li>
        <li>
          <SeedButton />
          {' — заполнить базовый контент для примера.'}
        </li>
        <li>
          <Link href="/" target="_blank" rel="noreferrer">
            Открыть сайт
          </Link>
        </li>
      </ul>
    </div>
  )
}

export default BeforeDashboard
