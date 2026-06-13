import type { Header } from '@/payload-types'

// Чистые хелперы вывода данных шапки/бокового меню из глобала `header`.
// Вынесены из клиентских компонентов, чтобы тестировать без рендера (паттерн
// decideVkSyncAlert / summarizeVkSyncHealth). Если глобал пуст — отдаём
// встроенные по умолчанию (как navItems → DEFAULT_NAV_ITEMS).

export type DrawerLink = { href: string; title: string; subtitle?: string }
export type DrawerGroup = { modifier?: 'stay' | 'see' | 'shop'; heading: string; items: DrawerLink[] }
export type DrawerContacts = { heading: string; body: string }
export type DrawerData = { groups: DrawerGroup[]; extraLinks: DrawerLink[]; contacts: DrawerContacts }

// Структурный тип ссылки из field-хелпера link() (group: type/reference/url/label).
// Описан вручную, чтобы хелпер не зависел от конкретного места в payload-types.
type LinkValue =
  | {
      type?: ('reference' | 'custom') | null
      reference?: { relationTo?: string; value?: unknown } | null
      url?: string | null
      label?: string | null
    }
  | null
  | undefined

export function resolveHref(link: LinkValue): string {
  if (!link) return '#'
  if (link.type === 'custom') return link.url || '#'
  const ref = link.reference
  if (ref && typeof ref.value === 'object' && ref.value) {
    const value = ref.value as { slug?: string }
    const slug = value.slug || ''
    return ref.relationTo === 'pages' ? `/${slug}` : `/${ref.relationTo}/${slug}`
  }
  return '#'
}

// ---- Верхнее меню ----

export type NavItem = { label: string; href: string }

// Дефолтные пункты — fallback, пока глобал header.navItems пуст.
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: 'Пожить', href: '/projects?group=stay' },
  { label: 'Делать', href: '/projects?group=do' },
  { label: 'Смотреть', href: '/projects?group=see' },
  { label: 'Лавка', href: '/projects?group=shop' },
  { label: 'Усадьба', href: '/usadba' },
  { label: 'О проекте', href: '/projects/about-project' },
]

export function deriveNavItems(data: Header): NavItem[] {
  const items = Array.isArray(data?.navItems) ? data.navItems : []
  const mapped = items
    .map((item) => ({ label: item?.link?.label || '', href: resolveHref(item?.link) }))
    .filter((i) => i.label && i.href && i.href !== '#')
  return mapped.length ? mapped : DEFAULT_NAV_ITEMS
}

// ---- Боковое меню (бургер-drawer) ----

// Порядок и заголовки секций — бренд-фиксированные, в коде (редактор лишь
// раскладывает пункты по секциям). `extra` рендерится отдельным блоком без
// заголовка, поэтому в этот порядок не входит.
const DRAWER_SECTION_ORDER = ['stay', 'do', 'see', 'shop'] as const
const DRAWER_SECTION_META: Record<string, { heading: string; modifier?: 'stay' | 'see' | 'shop' }> = {
  stay: { heading: '· Пожить ·', modifier: 'stay' },
  do: { heading: '· Делать ·' },
  see: { heading: '· Смотреть ·', modifier: 'see' },
  shop: { heading: '· Лавка ·', modifier: 'shop' },
}

// Встроенные по умолчанию — текущая хардкод-структура (до переноса в Payload).
// Слаги соответствуют реальным проектам в БД (исправлено 2026-05-30).
export const DEFAULT_DRAWER_GROUPS: DrawerGroup[] = [
  {
    modifier: 'stay',
    heading: '· Пожить ·',
    items: [{ href: '/projects/eco-hotel-vyatka', title: 'ЭКО-отель', subtitle: 'над рекой, 6 номеров' }],
  },
  {
    heading: '· Делать ·',
    items: [
      { href: '/projects/craft-workshops-gonba', title: 'Ремесленные мастерские', subtitle: 'гончарка, ткачество, валяние' },
      { href: '/projects/district-excursions', title: 'Экскурсии по району', subtitle: 'Малмыж · Гоньба · Вятка' },
      { href: '/projects/konnyy-klub-gmalyzh', title: 'Конный клуб', subtitle: 'г. Малмыж' },
    ],
  },
  {
    modifier: 'see',
    heading: '· Смотреть ·',
    items: [
      { href: '/projects/village-and-temple', title: 'Село и храм', subtitle: 'Покровская церковь, 1808' },
      { href: '/projects/sadovaya-feya-gulfiya-kharisovna', title: 'Садовая фея', subtitle: 'Гульфия Харисовна' },
      { href: '/projects/vyatskaya-lepota', title: 'Вятская лепота', subtitle: 'студия керамики' },
      { href: '/projects/village-events', title: 'События села', subtitle: 'ярмарки, праздники' },
    ],
  },
  {
    modifier: 'shop',
    heading: '· Лавка ·',
    items: [{ href: '/projects/vyatskiy-sbor', title: 'Вятскiй сборъ', subtitle: 'травы, иван-чай, мёд' }],
  },
]

export const DEFAULT_DRAWER_EXTRA_LINKS: DrawerLink[] = [
  { href: '/usadba', title: 'Усадьба', subtitle: 'история, главы, цитаты' },
  { href: '/projects', title: 'Все проекты', subtitle: 'полный каталог' },
]

export const DEFAULT_DRAWER_CONTACTS: DrawerContacts = {
  heading: 'контакты',
  body: 'с. Гоньба, Малмыжский р-н\n+7 (8332) 00-00-00\nhello@гоньба.рф',
}

type DrawerItemDoc = NonNullable<Header['drawerItems']>[number]

function deriveDrawerContacts(c: Header['drawerContacts'] | undefined): DrawerContacts {
  const heading = c?.heading?.trim()
  const body = c?.body?.trim()
  if (heading || body) {
    return {
      heading: heading || DEFAULT_DRAWER_CONTACTS.heading,
      body: body || DEFAULT_DRAWER_CONTACTS.body,
    }
  }
  return DEFAULT_DRAWER_CONTACTS
}

export function deriveDrawerData(data: Header): DrawerData {
  const items: DrawerItemDoc[] = Array.isArray(data?.drawerItems) ? data.drawerItems : []
  const mapped = items
    .map((it) => ({
      section: it?.section || '',
      link: {
        href: resolveHref(it?.link),
        title: it?.link?.label || '',
        subtitle: it?.subtitle || undefined,
      } as DrawerLink,
    }))
    .filter((m) => m.link.title && m.link.href && m.link.href !== '#')

  const groups: DrawerGroup[] = []
  for (const section of DRAWER_SECTION_ORDER) {
    const groupItems = mapped.filter((m) => m.section === section).map((m) => m.link)
    if (groupItems.length) {
      const meta = DRAWER_SECTION_META[section]
      groups.push({ modifier: meta.modifier, heading: meta.heading, items: groupItems })
    }
  }
  const extraLinks = mapped.filter((m) => m.section === 'extra').map((m) => m.link)

  // Fallback только когда в Payload вообще ничего валидного нет — иначе уважаем
  // выбор редактора (в т.ч. «только группы без extra»).
  const hasAny = groups.length > 0 || extraLinks.length > 0
  return {
    groups: hasAny ? groups : DEFAULT_DRAWER_GROUPS,
    extraLinks: hasAny ? extraLinks : DEFAULT_DRAWER_EXTRA_LINKS,
    contacts: deriveDrawerContacts(data?.drawerContacts),
  }
}
