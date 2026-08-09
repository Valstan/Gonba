import Link from 'next/link'
import React from 'react'

import type { Footer as FooterType } from '@/payload-types'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { FooterEditor, type FooterColumn } from './FooterEditor.client'

// Дефолты — fallback, пока глобал `footer` пуст. Как только подвал отредактируют
// через сайт, рендер идёт из глобала. Совпадают с прежним хардкодом.
const DEFAULT_DESCRIPTION =
  'Жемчужина Вятки. Этно-усадьба, мастерские, экскурсии и магазин вятских сборов в селе на правом берегу.'
const DEFAULT_LEGAL_ADDRESS = 'с. Гоньба, Малмыжский р-н, Кировская обл.'
const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    heading: '· Разделы ·',
    items: [
      { label: 'Все проекты', href: '/#projects' },
      { label: 'Усадьба', href: '/usadba' },
    ],
  },
  {
    heading: '· Контакты ·',
    items: [
      { label: 'с. Гоньба, Малмыжский р-н', href: '/contact' },
      { label: 'Написать команде', href: '/contact' },
    ],
  },
]

function deriveColumns(data: FooterType): FooterColumn[] {
  const cols = Array.isArray(data?.columns) ? data.columns : []
  const mapped = cols
    .map((c) => ({
      heading: c?.heading?.trim() || '',
      items: (Array.isArray(c?.items) ? c.items : [])
        .map((i) => ({ label: i?.label?.trim() || '', href: i?.href?.trim() || '' }))
        .filter((i) => i.label && i.href),
    }))
    .filter((c) => c.heading || c.items.length > 0)
  return mapped.length ? mapped : DEFAULT_COLUMNS
}

export async function Footer() {
  const data: FooterType = await getCachedGlobal('footer', 0)()

  const year = new Date().getFullYear()
  const description = data?.description?.trim() || DEFAULT_DESCRIPTION
  const legalAddress = data?.legalAddress?.trim() || DEFAULT_LEGAL_ADDRESS
  const columns = deriveColumns(data)

  return (
    <footer className="ethno-footer">
      <div className="container">
        <div className="ethno-footer__grid">
          <div className="ethno-footer__brand">
            <h2>
              <Link href="/" aria-label="На главную">
                <span
                  className="ethno-rhomb"
                  aria-hidden="true"
                  style={{ color: 'var(--ochre)', marginRight: '10px' }}
                />
                Гоньба
              </Link>
            </h2>
            <p>{description}</p>
          </div>

          {columns.map((col, ci) => (
            <div key={ci}>
              <h3>{col.heading}</h3>
              <ul>
                {col.items.map((item, ii) => (
                  <li key={ii}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="ethno-footer__legal">
          <span>© {year} Гоньба · все права сохранены</span>
          <span>{legalAddress}</span>
          <a
            href="https://xn--80adkmnnb2b.xn--80adkdyec4j.xn--p1ai/"
            rel="author"
            className="ethno-footer__author"
          >
            Сделано программистом Валентином Савиных
          </a>
        </div>

        <div
          id="li-counter-slot"
          className="analyticsLiSlot"
          aria-label="Счётчик посетителей сайта"
        />

        <FooterEditor description={description} columns={columns} legalAddress={legalAddress} />
      </div>
    </footer>
  )
}
