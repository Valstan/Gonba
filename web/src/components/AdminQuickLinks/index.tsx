import React from 'react'

import './index.scss'

type QuickLink = {
  /** Видимое название ссылки */
  label: string
  /** Куда ведёт */
  href: string
  /** Эмодзи/символ-иконка слева. Оставить пустым если не нужна */
  icon?: string
  /** `_blank` — открыть в новой вкладке (по умолчанию), `_self` — в текущей */
  target?: '_blank' | '_self'
  /** Подсказка при наведении */
  title?: string
}

/**
 * Список быстрых ссылок в верхнем меню админки.
 * Добавляем сюда новые ссылки по мере появления потребностей —
 * например `/admin/yadisk`, `/api/health` для диагностики и т.д.
 */
const QUICK_LINKS: QuickLink[] = [
  {
    label: 'На главную сайта',
    href: '/',
    icon: '🏠',
    target: '_blank',
    title: 'Открыть главную страницу сайта в новой вкладке',
  },
]

/**
 * Компонент рендерится в `admin.components.actions` —
 * виден в верхней правой области шапки Payload-админки на всех маршрутах.
 *
 * Использует нативный `<details>` для dropdown — без JS-зависимостей,
 * доступно с клавиатуры из коробки.
 */
export default function AdminQuickLinks() {
  return (
    <details className="admin-quick-links">
      <summary
        className="admin-quick-links__trigger"
        aria-label="Быстрые ссылки"
        title="Быстрые ссылки"
      >
        <span className="admin-quick-links__trigger-icon" aria-hidden>
          ≡
        </span>
        <span className="admin-quick-links__trigger-label">Меню</span>
      </summary>
      <div className="admin-quick-links__menu" role="menu">
        {QUICK_LINKS.map((link) => (
          <a
            key={link.href + link.label}
            href={link.href}
            target={link.target ?? '_blank'}
            rel={link.target === '_self' ? undefined : 'noopener noreferrer'}
            title={link.title}
            role="menuitem"
            className="admin-quick-links__item"
          >
            {link.icon ? (
              <span className="admin-quick-links__item-icon" aria-hidden>
                {link.icon}
              </span>
            ) : null}
            <span className="admin-quick-links__item-label">{link.label}</span>
          </a>
        ))}
      </div>
    </details>
  )
}
