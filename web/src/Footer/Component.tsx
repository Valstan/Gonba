import Link from 'next/link'
import React from 'react'

type FooterColumn = {
  heading: string
  items: { label: string; href: string }[]
}

const COLUMNS: FooterColumn[] = [
  {
    heading: '· Разделы ·',
    items: [
      { label: 'Пожить', href: '/projects?group=stay' },
      { label: 'Делать', href: '/projects?group=do' },
      { label: 'Смотреть', href: '/projects?group=see' },
      { label: 'Лавка', href: '/projects?group=shop' },
      { label: 'О проекте', href: '/projects/about-project' },
    ],
  },
  {
    heading: '· Контакты ·',
    items: [
      { label: 'с. Гоньба, Малмыжский р-н', href: '/contact' },
      { label: '+7 (8332) 00-00-00', href: 'tel:+78332000000' },
      { label: 'hello@гоньба.рф', href: 'mailto:hello@гоньба.рф' },
    ],
  },
]

export async function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="ethno-footer">
      <div className="container">
        <div className="ethno-footer__grid">
          <div className="ethno-footer__brand">
            <h2>
              <Link href="/" aria-label="На главную">
                <span className="ethno-rhomb" aria-hidden="true" style={{ color: 'var(--ochre)', marginRight: '10px' }} />
                Гоньба
              </Link>
            </h2>
            <p>
              Жемчужина Вятки. Этно-усадьба, мастерские, экскурсии и магазин вятских
              сборов в селе на правом берегу.
            </p>
          </div>

          {COLUMNS.map((col, ci) => (
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
          <span>с. Гоньба, Малмыжский р-н, Кировская обл.</span>
        </div>
      </div>
    </footer>
  )
}
