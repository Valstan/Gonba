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

export const post3: (args: PostArgs) => RequiredDataFromCollectionSlug<'posts'> = ({
  heroImage,
  author,
}) => {
  return {
    slug: 'master-klassy-remesla',
    _status: 'published',
    authors: [author],
    content: richText(
      headingNode('Мастер‑классы и ремёсла', 'h2'),
      paragraphNode(
        'Творческие занятия для детей и взрослых: керамика, роспись, народные техники и уютная атмосфера мастерской.',
      ),
    ),
    heroImage: heroImage.id,
    meta: {
      description: 'Мастер‑классы и ремёсла в Гоньбе: керамика, роспись и творческие занятия.',
      image: heroImage.id,
      title: 'Мастер‑классы и ремёсла',
    },
    relatedPosts: [],
    title: 'Мастер‑классы и ремёсла',
  }
}
