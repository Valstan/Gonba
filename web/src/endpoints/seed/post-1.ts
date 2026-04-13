import type { Media, User } from '@/payload-types'
import { RequiredDataFromCollectionSlug } from 'payload'

export type PostArgs = {
  heroImage: Media
  blockImage: Media
  author: User
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

export const post1: (args: PostArgs) => RequiredDataFromCollectionSlug<'posts'> = ({
  heroImage,
  author,
}) => {
  return {
    slug: 'gonba-itogi-i-plany',
    _status: 'published',
    authors: [author],
    content: richText(
      headingNode('Гоньба — жемчужина Вятки: итоги и планы', 'h2'),
      paragraphNode(
        'За три года на ферме появилось 5 взрослых оленей и родились новые малыши. Мы достроили конюшню, запустили сувенирную лавку и вместе с жителями улучшили дорогу в селе.',
      ),
      paragraphNode(
        'Сейчас развиваем творческое пространство «Вятская Лепота», готовим запуск эко-отеля и расширяем туристические маршруты. В планах — ремесленные мастерские, развитие сельского туризма и новые события для гостей.',
      ),
    ),
    heroImage: heroImage.id,
    meta: {
      description:
        'ГОНЬБА — жемчужина Вятки: итоги за три года и планы по развитию проектов.',
      image: heroImage.id,
      title: 'Гоньба — жемчужина Вятки: итоги и планы',
    },
    relatedPosts: [],
    title: 'Гоньба — жемчужина Вятки: итоги и планы',
  }
}
