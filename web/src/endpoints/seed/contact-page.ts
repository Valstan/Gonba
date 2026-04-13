import type { Form } from '@/payload-types'
import { RequiredDataFromCollectionSlug } from 'payload'

type ContactArgs = {
  contactForm: Form
}

export const contact: (args: ContactArgs) => RequiredDataFromCollectionSlug<'pages'> = ({
  contactForm,
}) => {
  const vkCommunities = [
    {
      title: 'Гоньба — жемчужина Вятки',
      description: 'Основное сообщество и новости проекта.',
      url: 'https://vk.com/club218688001',
    },
    {
      title: 'ЭКО-отель «Жемчужина Вятки»',
      description: 'Бронирование и информация о проживании.',
      url: 'https://vk.com/club235385532',
    },
    {
      title: 'Клуб малмыжских путешественников',
      description: 'Экскурсии, маршруты и события.',
      url: 'https://vk.com/club226176537',
    },
    {
      title: 'Студия ремесел «Вятская Лепота»',
      description: 'Мастер-классы и творческие встречи.',
      url: 'https://vk.com/club229392127',
    },
    {
      title: 'Вятскiй сборъ',
      description: 'Локальные продукты и сборы.',
      url: 'https://vk.com/club229001043',
    },
  ]

  return {
    slug: 'contact',
    _status: 'published',
    hero: {
      type: 'none',
    },
    layout: [
      {
        blockType: 'content',
        blockName: 'Мы в VK',
        columns: vkCommunities.map((community) => ({
          size: 'half',
          richText: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'heading',
                  children: [
                    {
                      type: 'text',
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: community.title,
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  tag: 'h3',
                  version: 1,
                },
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'text',
                      detail: 0,
                      format: 0,
                      mode: 'normal',
                      style: '',
                      text: community.description,
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  textFormat: 0,
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              version: 1,
            },
          },
          enableLink: true,
          link: {
            type: 'custom' as const,
            label: 'Открыть в VK',
            url: community.url,
            newTab: true,
            appearance: 'outline' as const,
          },
        })),
      },
      {
        blockType: 'formBlock',
        enableIntro: true,
        form: contactForm,
        introContent: {
          root: {
            type: 'root',
            children: [
              {
                type: 'heading',
                children: [
                  {
                    type: 'text',
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Свяжитесь с нами через форму:',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                tag: 'h3',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
    ],
    title: 'Контакты',
  }
}
