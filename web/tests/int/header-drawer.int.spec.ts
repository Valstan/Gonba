import { describe, it, expect } from 'vitest'

import type { Header } from '@/payload-types'
import {
  deriveDrawerData,
  DEFAULT_DRAWER_GROUPS,
  DEFAULT_DRAWER_EXTRA_LINKS,
  DEFAULT_DRAWER_CONTACTS,
} from '@/Header/nav-data'

// Чистый вывод данных бокового меню из глобала header. Без Payload/БД:
//   corepack pnpm exec vitest run tests/int/header-drawer.int.spec.ts
const asHeader = (partial: Partial<Header>): Header => partial as unknown as Header

const customItem = (section: string, url: string, label: string, subtitle?: string) => ({
  section,
  link: { type: 'custom' as const, url, label, newTab: false },
  subtitle,
})

describe('deriveDrawerData', () => {
  it('пустой глобал → встроенные по умолчанию (groups+extra+contacts)', () => {
    const d = deriveDrawerData(asHeader({}))
    expect(d.groups).toEqual(DEFAULT_DRAWER_GROUPS)
    expect(d.extraLinks).toEqual(DEFAULT_DRAWER_EXTRA_LINKS)
    expect(d.contacts).toEqual(DEFAULT_DRAWER_CONTACTS)
  })

  it('drawerItems раскладываются по фиксированному порядку секций', () => {
    const d = deriveDrawerData(
      asHeader({
        drawerItems: [
          // намеренно не по порядку — вывод должен идти stay → do → see → shop
          customItem('shop', '/projects/lavka', 'Лавка-пункт'),
          customItem('stay', '/projects/hotel', 'Отель', 'над рекой'),
          customItem('do', '/projects/master', 'Мастерская'),
          customItem('extra', '/usadba', 'Усадьба', 'история'),
        ] as Header['drawerItems'],
      }),
    )
    expect(d.groups.map((g) => g.heading)).toEqual(['· Пожить ·', '· Делать ·', '· Лавка ·'])
    expect(d.groups[0]).toMatchObject({
      modifier: 'stay',
      items: [{ href: '/projects/hotel', title: 'Отель', subtitle: 'над рекой' }],
    })
    // 'do' без модификатора
    expect(d.groups[1].modifier).toBeUndefined()
    // extra → отдельный список, не в groups
    expect(d.extraLinks).toEqual([{ href: '/usadba', title: 'Усадьба', subtitle: 'история' }])
  })

  it('несколько пунктов одной секции сохраняют порядок', () => {
    const d = deriveDrawerData(
      asHeader({
        drawerItems: [
          customItem('see', '/a', 'A'),
          customItem('see', '/b', 'B'),
          customItem('see', '/c', 'C'),
        ] as Header['drawerItems'],
      }),
    )
    expect(d.groups).toHaveLength(1)
    expect(d.groups[0].items.map((i) => i.title)).toEqual(['A', 'B', 'C'])
    expect(d.groups[0].modifier).toBe('see')
  })

  it('пункты без label или без валидного href отбрасываются', () => {
    const d = deriveDrawerData(
      asHeader({
        drawerItems: [
          customItem('do', '/ok', 'Норм'),
          { section: 'do', link: { type: 'custom', url: '', label: 'Без URL', newTab: false } },
          { section: 'do', link: { type: 'custom', url: '/x', label: '', newTab: false } },
        ] as Header['drawerItems'],
      }),
    )
    expect(d.groups).toHaveLength(1)
    expect(d.groups[0].items.map((i) => i.title)).toEqual(['Норм'])
  })

  it('reference-ссылка резолвится: pages → /slug, projects → /projects/slug', () => {
    const d = deriveDrawerData(
      asHeader({
        drawerItems: [
          {
            section: 'see',
            link: {
              type: 'reference',
              reference: { relationTo: 'projects', value: { slug: 'hram' } },
              label: 'Храм',
            },
          },
          {
            section: 'extra',
            link: {
              type: 'reference',
              reference: { relationTo: 'pages', value: { slug: 'about' } },
              label: 'О нас',
            },
          },
        ] as unknown as Header['drawerItems'],
      }),
    )
    expect(d.groups[0].items[0].href).toBe('/projects/hram')
    expect(d.extraLinks[0].href).toBe('/about')
  })

  it('только группы без extra → extra пустой (не fallback), раз что-то настроено', () => {
    const d = deriveDrawerData(
      asHeader({ drawerItems: [customItem('stay', '/h', 'Отель')] as Header['drawerItems'] }),
    )
    expect(d.groups).toHaveLength(1)
    expect(d.extraLinks).toEqual([])
  })

  it('contacts: полный override', () => {
    const d = deriveDrawerData(
      asHeader({ drawerContacts: { heading: 'Связь', body: 'строка1\nстрока2' } }),
    )
    expect(d.contacts).toEqual({ heading: 'Связь', body: 'строка1\nстрока2' })
  })

  it('contacts: частичный (только body) → heading из дефолта', () => {
    const d = deriveDrawerData(asHeader({ drawerContacts: { body: 'только тело' } }))
    expect(d.contacts.heading).toBe(DEFAULT_DRAWER_CONTACTS.heading)
    expect(d.contacts.body).toBe('только тело')
  })

  it('contacts: пустые строки → дефолт целиком', () => {
    const d = deriveDrawerData(asHeader({ drawerContacts: { heading: '  ', body: '' } }))
    expect(d.contacts).toEqual(DEFAULT_DRAWER_CONTACTS)
  })
})
