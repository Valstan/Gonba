export type SectionStatus = 'ready' | 'planned'

export type SectionCTA = {
  label: string
  href: string
}

export type SectionDefinition = {
  slug: string
  title: string
  shortLabel: string
  description: string
  status: SectionStatus
  imageKeywords: string[]
  ctas: SectionCTA[]
  accentColor: string
  icon: string
  gradient: string
  projectSlug: string
  enabledSections: string[]
}

export const sections: SectionDefinition[] = [
  {
    slug: 'about-project',
    title: 'О проекте',
    shortLabel: 'О проекте',
    description: 'Команда, история создания, планы, идеи и контакты.',
    status: 'ready',
    imageKeywords: ['команда', 'проект', 'гоньба'],
    ctas: [
      { label: 'Записи', href: '/sections/about-project#posts' },
      { label: 'Проекты', href: '/projects' },
      { label: 'Контакты', href: '/contact' },
    ],
    accentColor: '#6366f1',
    icon: '🏠',
    gradient: 'from-indigo-500 to-violet-500',
    projectSlug: 'gonba',
    enabledSections: ['posts', 'contacts'],
  },
  {
    slug: 'village-and-temple',
    title: 'О селе и храме',
    shortLabel: 'Село и храм',
    description: 'История села и храма, фото и сбор на храм.',
    status: 'planned',
    imageKeywords: ['храм', 'село', 'история'],
    ctas: [{ label: 'Раздел в разработке', href: '/coming-soon/village-and-temple' }],
    accentColor: '#f59e0b',
    icon: '⛪',
    gradient: 'from-amber-500 to-orange-500',
    projectSlug: 'gonba',
    enabledSections: [],
  },
  {
    slug: 'sadovaya-feya-gulfiya-kharisovna',
    title: 'Садовая фея Гульфия Харисовна',
    shortLabel: 'Садовая фея',
    description: 'Проект с авторским подходом к ландшафту, цветению и сезонному уходу за садом.',
    status: 'ready',
    imageKeywords: ['сад', 'ландшафт', 'растения', 'Гульфия', 'коклюш'],
    ctas: [
      { label: 'Записи', href: '/sections/sadovaya-feya-gulfiya-kharisovna#posts' },
      { label: 'Подробнее', href: '/projects/vyatskaya-lepota' },
    ],
    accentColor: '#10b981',
    icon: '🌿',
    gradient: 'from-emerald-500 to-green-500',
    projectSlug: 'vyatskaya-lepota',
    enabledSections: ['posts', 'events', 'gallery'],
  },
  {
    slug: 'vyatskaya-lepota-malmyzh',
    title: 'Вятская лепота Малмыж',
    shortLabel: 'Вятская лепота',
    description: 'Проект о традициях, ремесле и местной культуре.',
    status: 'ready',
    imageKeywords: ['вятская лепота', 'ремесло', 'мастерская'],
    ctas: [
      { label: 'Записи', href: '/sections/vyatskaya-lepota-malmyzh#posts' },
      { label: 'Страница проекта', href: '/projects/vyatskaya-lepota' },
      { label: 'Все проекты', href: '/projects' },
    ],
    accentColor: '#ef4444',
    icon: '🎨',
    gradient: 'from-red-500 to-rose-500',
    projectSlug: 'vyatskaya-lepota',
    enabledSections: ['posts', 'events', 'services', 'gallery'],
  },
  {
    slug: 'craft-workshops-gonba',
    title: 'Ремесленные мастерские в Гоньбе',
    shortLabel: 'Мастерские',
    description: 'Мастер-классы, творчество и семейные форматы.',
    status: 'ready',
    imageKeywords: ['мастерская', 'ремесло', 'керамика'],
    ctas: [
      { label: 'Записи', href: '/sections/craft-workshops-gonba#posts' },
      { label: 'Сервисы', href: '/services' },
      { label: 'События', href: '/events' },
    ],
    accentColor: '#8b5cf6',
    icon: '🔨',
    gradient: 'from-violet-500 to-purple-500',
    projectSlug: 'gonba',
    enabledSections: ['posts', 'events', 'services'],
  },
  {
    slug: 'district-excursions',
    title: 'Экскурсии по району',
    shortLabel: 'Экскурсии',
    description: 'Бронь, запись, календарь, описание маршрутов и фото.',
    status: 'ready',
    imageKeywords: ['экскурсия', 'маршрут', 'путешествие'],
    ctas: [
      { label: 'Записи', href: '/sections/district-excursions#posts' },
      { label: 'События', href: '/events' },
      { label: 'Сервисы', href: '/services' },
    ],
    accentColor: '#0ea5e9',
    icon: '🗺️',
    gradient: 'from-sky-500 to-blue-500',
    projectSlug: 'travel-club-malmyzh',
    enabledSections: ['posts', 'events', 'services'],
  },
  {
    slug: 'eco-hotel-booking',
    title: 'ЭКО-отель',
    shortLabel: 'ЭКО-отель',
    description: 'Бронь, фото, календарь проживания и программ отдыха.',
    status: 'ready',
    imageKeywords: ['эко', 'отель', 'домик', 'баня'],
    ctas: [
      { label: 'Записи', href: '/sections/eco-hotel-booking#posts' },
      { label: 'Страница проекта', href: '/projects/eco-hotel-vyatka' },
      { label: 'Сервисы', href: '/services' },
    ],
    accentColor: '#22c55e',
    icon: '🏡',
    gradient: 'from-green-500 to-lime-500',
    projectSlug: 'eco-hotel-vyatka',
    enabledSections: ['posts', 'services', 'gallery', 'contacts'],
  },
  {
    slug: 'konnyy-klub-gmalyzh',
    title: 'Конный клуб г.Малмыж',
    shortLabel: 'Конный клуб',
    description: 'Тренировки, прогулки, маршруты и семейные программы с лошадьми для гостей.',
    status: 'ready',
    imageKeywords: ['конный', 'клуб', 'лошадь', 'Малмыж', 'петля'],
    ctas: [
      { label: 'Записи', href: '/sections/konnyy-klub-gmalyzh#posts' },
      { label: 'События', href: '/events' },
      { label: 'Проекты', href: '/projects/travel-club-malmyzh' },
    ],
    accentColor: '#d97706',
    icon: '🐴',
    gradient: 'from-amber-600 to-yellow-500',
    projectSlug: 'travel-club-malmyzh',
    enabledSections: ['posts', 'events', 'gallery'],
  },
  {
    slug: 'vyatskiy-sbor',
    title: 'Вятский сбор',
    shortLabel: 'Вятский сбор',
    description: 'Лавка: травы, мед и другие локальные продукты.',
    status: 'ready',
    imageKeywords: ['сбор', 'мед', 'травы', 'лавка'],
    ctas: [
      { label: 'Записи', href: '/sections/vyatskiy-sbor#posts' },
      { label: 'Магазин', href: '/shop' },
      { label: 'Страница проекта', href: '/projects/vyatskiy-sbor' },
    ],
    accentColor: '#84cc16',
    icon: '🍯',
    gradient: 'from-lime-500 to-green-500',
    projectSlug: 'vyatskiy-sbor',
    enabledSections: ['posts', 'shop'],
  },
  {
    slug: 'village-events',
    title: 'Мероприятия и события села',
    shortLabel: 'События села',
    description: 'Фото, видео, планы и отчеты о событиях.',
    status: 'ready',
    imageKeywords: ['событие', 'праздник', 'мероприятие'],
    ctas: [
      { label: 'Записи', href: '/sections/village-events#posts' },
      { label: 'Афиша событий', href: '/events' },
      { label: 'Новости', href: '/posts' },
    ],
    accentColor: '#ec4899',
    icon: '🎉',
    gradient: 'from-pink-500 to-rose-500',
    projectSlug: 'gonba',
    enabledSections: ['posts', 'events', 'gallery'],
  },
]

export const getSectionBySlug = (slug: string) => sections.find((section) => section.slug === slug)
