import { RequiredDataFromCollectionSlug } from 'payload'
import type { PostArgs } from './post-1'

const textNode = (text: string) => ({
  type: 'text',
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})

const headingNode = (text: string, tag: 'h2' | 'h3') => ({
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

export const post2: (args: PostArgs) => RequiredDataFromCollectionSlug<'posts'> = ({
  heroImage,
  author,
}) => {
  return {
    slug: 'eco-hotel-aframe',
    _status: 'published',
    authors: [author],
    content: richText(
      headingNode('ЭКО-отель: наш первый А-фрейм', 'h2'),
      paragraphNode(
        'Представляем наш первый дом-шалаш. Он построен по авторскому проекту, светлый, теплый и очень уютный. Внутри полноценная кухня, климат-контроль и чистая вода из-под крана.',
      ),
      paragraphNode(
        'Дом рассчитан на семейный отдых: 6 спальных мест, панорамные окна и спокойствие природы вокруг. Баня и чан доступны по отдельной записи. Бронь открыта — приезжайте за тишиной и перезагрузкой.',
      ),
    ),
    heroImage: heroImage.id,
    meta: {
      description: 'ЭКО-отель в Гоньбе: первый А-фрейм, уютный отдых, баня и бронирование.',
      image: heroImage.id,
      title: 'ЭКО-отель: наш первый А-фрейм',
    },
    relatedPosts: [],
    title: 'ЭКО-отель: наш первый А-фрейм',
  }
}
