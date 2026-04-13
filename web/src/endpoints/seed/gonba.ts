type ProjectSeed = {
  title: string
  shortLabel: string
  slug: string
  projectType: 'deerFarm' | 'ecoHotel' | 'craftStudio' | 'travelClub' | 'productLine' | 'other'
  summary: string
  contacts: {
    phone: string
  }
}

export const gonbaProjects: ProjectSeed[] = [
  {
    title: 'Гоньба — жемчужина Вятки',
    shortLabel: 'Гоньба',
    slug: 'gonba',
    projectType: 'deerFarm',
    summary: 'Эко‑туризм, оленья ферма и культурные события на берегу Вятки.',
    contacts: {
      phone: '8 999 914 22 27',
    },
  },
  {
    title: 'ЭКО‑отель «Жемчужина Вятки»',
    shortLabel: 'ЭКО-отель',
    slug: 'eco-hotel-vyatka',
    projectType: 'ecoHotel',
    summary: 'Домики, баня, ретриты и бронирование размещений.',
    contacts: {
      phone: '8 999 914 22 27',
    },
  },
  {
    title: 'Студия «Вятская Лепота»',
    shortLabel: 'Лепота',
    slug: 'vyatskaya-lepota',
    projectType: 'craftStudio',
    summary: 'Ремесла, мастер‑классы и творческие занятия для детей и взрослых.',
    contacts: {
      phone: '8 982 390 85 56',
    },
  },
  {
    title: 'Клуб малмыжских путешественников',
    shortLabel: 'Путешествия',
    slug: 'travel-club-malmyzh',
    projectType: 'travelClub',
    summary: 'Экскурсии, поездки и культурные выезды.',
    contacts: {
      phone: '8 919 503 09 79',
    },
  },
  {
    title: 'Вятскiй сборъ',
    shortLabel: 'Вятский сбор',
    slug: 'vyatskiy-sbor',
    projectType: 'productLine',
    summary: 'Чаи, мёд и травы, собранные на Вятке.',
    contacts: {
      phone: '8 919 503 09 79',
    },
  },
]

type ServiceSeed = {
  title: string
  slug: string
  summary: string
  price: number
  currency: 'RUB' | 'USD' | 'EUR'
  duration: string
}

export const gonbaServices: ServiceSeed[] = [
  {
    title: 'Экскурсия на оленью ферму',
    slug: 'deer-farm-tour',
    summary: 'Посещение фермы и прогулка по территории.',
    price: 500,
    currency: 'RUB',
    duration: '1 час',
  },
  {
    title: 'Аренда бани и чана',
    slug: 'banya-rental',
    summary: 'Баня с купелью для компании до 10 человек.',
    price: 10000,
    currency: 'RUB',
    duration: 'сутки',
  },
]

type EventSeed = {
  title: string
  slug: string
  summary: string
  startDate: string
  price: number
  currency: 'RUB' | 'USD' | 'EUR'
  eventStatus: 'active' | 'cancelled' | 'soldOut' | 'completed'
}

export const gonbaEvents: EventSeed[] = [
  {
    title: 'Мастер‑класс по керамике',
    slug: 'ceramics-workshop',
    summary: 'Лепка и роспись изделий из глины.',
    startDate: new Date().toISOString(),
    price: 500,
    currency: 'RUB',
    eventStatus: 'active',
  },
]

type ProductSeed = {
  title: string
  slug: string
  summary: string
  price: number
  currency: 'RUB' | 'USD' | 'EUR'
  inStock: boolean
}

export const gonbaProducts: ProductSeed[] = [
  {
    title: 'Иван‑чай',
    slug: 'ivan-tea',
    summary: 'Травяной чай ручного сбора.',
    price: 350,
    currency: 'RUB',
    inStock: true,
  },
  {
    title: 'Мёд Вятский',
    slug: 'vyatka-honey',
    summary: 'Натуральный мёд с пасеки.',
    price: 600,
    currency: 'RUB',
    inStock: true,
  },
]
