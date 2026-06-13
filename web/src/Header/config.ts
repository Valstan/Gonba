import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { adminOrEditor } from '@/access/adminOrEditor'
import { revalidateHeader } from './hooks/revalidateHeader'

// Секции бокового меню (бургер-drawer). Заголовки и CSS-модификатор групп —
// бренд-фиксированные, живут в коде (web/src/Header/nav-data.ts → DRAWER_SECTION_META);
// здесь редактор лишь раскладывает пункты по секциям. `extra` — нижний блок без
// заголовка (Усадьба, Все проекты и т.п.).
const DRAWER_SECTION_OPTIONS = [
  { label: 'Пожить', value: 'stay' },
  { label: 'Делать', value: 'do' },
  { label: 'Смотреть', value: 'see' },
  { label: 'Лавка', value: 'shop' },
  { label: 'Доп. ссылки (без заголовка)', value: 'extra' },
]

export const Header: GlobalConfig = {
  slug: 'header',
  label: 'Шапка',
  access: {
    read: () => true,
    update: adminOrEditor,
  },
  fields: [
    {
      name: 'navItems',
      label: 'Верхнее меню',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Header/RowLabel#RowLabel',
        },
      },
    },
    {
      name: 'drawerItems',
      label: 'Боковое меню (бургер)',
      type: 'array',
      admin: {
        initCollapsed: true,
        description:
          'Пункты выезжающего бокового меню, сгруппированные по секциям. ' +
          'Пусто → показываются встроенные пункты по умолчанию.',
        components: {
          RowLabel: '@/Header/DrawerRowLabel#DrawerRowLabel',
        },
      },
      fields: [
        {
          name: 'section',
          label: 'Секция',
          type: 'select',
          required: true,
          defaultValue: 'do',
          options: DRAWER_SECTION_OPTIONS,
        },
        link({
          appearances: false,
        }),
        {
          name: 'subtitle',
          label: 'Подпись (вторая строка)',
          type: 'text',
          admin: {
            description: 'Например: «над рекой, 6 номеров». Необязательно.',
          },
        },
      ],
    },
    {
      name: 'drawerContacts',
      label: 'Контакты в боковом меню',
      type: 'group',
      admin: {
        description: 'Блок «контакты» внизу бокового меню. Пусто → встроенные по умолчанию.',
      },
      fields: [
        {
          name: 'heading',
          label: 'Заголовок',
          type: 'text',
          admin: {
            placeholder: 'контакты',
          },
        },
        {
          name: 'body',
          label: 'Текст (каждая строка — с новой строки)',
          type: 'textarea',
          admin: {
            description: 'Адрес, телефон, e-mail — каждый с новой строки.',
          },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
