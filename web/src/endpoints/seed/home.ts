import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Media } from '@/payload-types'

type HomeArgs = {
  heroImage: Media
  metaImage: Media
  galleryImages: Media[]
}

const textNode = (text: string) => ({
  type: 'text',
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})

const headingNode = (text: string, tag: 'h1' | 'h2' | 'h3') => ({
  type: 'heading',
  children: [textNode(text)],
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0,
  tag,
  version: 1,
})

const paragraphNode = (text: string) => ({
  type: 'paragraph',
  children: [textNode(text)],
  direction: 'ltr' as const,
  format: '' as const,
  indent: 0,
  textFormat: 0,
  version: 1,
})

const richText = (...children: Array<ReturnType<typeof headingNode> | ReturnType<typeof paragraphNode>>) => ({
  root: {
    type: 'root',
    children,
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

export const home: (args: HomeArgs) => RequiredDataFromCollectionSlug<'pages'> = ({
  heroImage,
  metaImage,
  galleryImages,
}) => {
  const vkCommunities = [
    {
      title: 'Гоньба — жемчужина Вятки',
      description: 'Главные новости, жизнь оленьей фермы и наши планы.',
      url: 'https://vk.com/club218688001',
    },
    {
      title: 'ЭКО-отель «Жемчужина Вятки»',
      description: 'Домики, баня и бронирование отдыха на природе.',
      url: 'https://vk.com/club235385532',
    },
    {
      title: 'Клуб малмыжских путешественников',
      description: 'Экскурсии, маршруты и события для любителей путешествий.',
      url: 'https://vk.com/club226176537',
    },
    {
      title: 'Студия ремесел «Вятская Лепота»',
      description: 'Мастер-классы, творческие встречи и ремесленные проекты.',
      url: 'https://vk.com/club229392127',
    },
    {
      title: 'Вятскiй сборъ',
      description: 'Локальные продукты и натуральные сборы.',
      url: 'https://vk.com/club229001043',
    },
  ]

  return {
    slug: 'home',
    _status: 'published',
    title: 'Главная',
    hero: {
      type: 'highImpact',
      links: [
        {
          link: {
            type: 'custom',
            appearance: 'default',
            label: 'Проекты',
            url: '/projects',
          },
        },
        {
          link: {
            type: 'custom',
            appearance: 'outline',
            label: 'Контакты',
            url: '/contact',
          },
        },
      ],
      media: heroImage.id,
      richText: richText(
        headingNode('ГОНЬБА — экосистема проектов Вятки', 'h1'),
        paragraphNode('Оленья ферма, эко‑отель, путешествия, ремёсла и локальные продукты.'),
      ),
    },
    layout: [
      {
        blockName: 'О проекте',
        blockType: 'content',
        columns: [
          {
            richText: richText(
              headingNode('Что такое ГОНЬБА', 'h2'),
              paragraphNode(
                'Мы объединяем природный отдых, событийный туризм и творческие мастерские. Здесь можно отдохнуть, поучаствовать в экскурсиях и приобрести местные продукты.',
              ),
            ),
            size: 'full',
          },
          {
            enableLink: false,
            richText: richText(
              headingNode('Чем заняться', 'h3'),
              paragraphNode('Экскурсии, проживание, мастер‑классы, гастро‑продукты и тематические события.'),
            ),
            size: 'half',
          },
          {
            enableLink: false,
            richText: richText(
              headingNode('Как добраться', 'h3'),
              paragraphNode('Село Гоньба, Кировская область. Подробности и маршруты — в разделе контактов.'),
            ),
            size: 'half',
          },
        ],
      },
      {
        blockName: 'Моменты из Гоньбы',
        blockType: 'gallery',
        title: 'Моменты из Гоньбы',
        items: [
          {
            image: galleryImages[0]?.id,
            caption: 'Оленья ферма и прогулки по Вятке',
          },
          {
            image: galleryImages[1]?.id,
            caption: 'Эко-отель, домики и баня',
          },
          {
            image: galleryImages[2]?.id,
            caption: 'Ремесла, мастер-классы и творчество',
          },
        ].filter((item) => item.image),
      },
      {
        blockName: 'Мы в VK',
        blockType: 'content',
        columns: vkCommunities.map((community) => ({
          size: 'oneThird',
          richText: richText(headingNode(community.title, 'h3'), paragraphNode(community.description)),
          enableLink: true,
          link: {
            type: 'custom' as const,
            label: 'Перейти в VK',
            url: community.url,
            newTab: true,
            appearance: 'outline' as const,
          },
        })),
      },
    ],
    meta: {
      description:
        'ГОНЬБА — экосистема проектов Вятки: оленья ферма, эко‑отель, путешествия, ремёсла и локальные продукты.',
      image: metaImage.id,
      title: 'ГОНЬБА — экосистема проектов Вятки',
    },
  }
}
