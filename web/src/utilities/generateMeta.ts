import type { Metadata } from 'next'

import type { Media, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'
import { SITE } from '@/seo/site'

/**
 * Документ, из которого собирается `<title>`/`description`. Структурный тип, а
 * не объединение моделей Payload: SEO-группа `meta` есть у `pages`/`posts`, а у
 * `events`/`services`/`products` роль описания играет `summary`. Требование к
 * результату одно и то же, поэтому и форма входа одна.
 */
type MetaDoc = {
  title?: string | null
  slug?: string | null
  summary?: string | null
  meta?: {
    title?: string | null
    description?: string | null
    image?: Media | Config['db']['defaultIDType'] | null
  } | null
}

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  let url = serverUrl + '/website-template-OG.webp'

  // Производных размеров (og и прочих) у media нет — imageSizes не задан,
  // поэтому OG-картинка — сам оригинал.
  if (image && typeof image === 'object' && 'url' in image && image.url) {
    url = serverUrl + image.url
  }

  return url
}

const clean = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '')

/** Длина заголовка без суффикса сайта: в выдаче он всё равно обрезается. */
const TITLE_MAX = 60

/**
 * Мягкое усечение по границе слова. Применяется только к заголовку документа
 * (у VK-импорта это целая строка поста — 190 знаков в `<title>`), а не к
 * `meta.title`: там текст задан руками и обрезать его — значит спорить с
 * автором.
 */
const shorten = (value: string, max: number): string => {
  if (value.length <= max) return value

  const cut = value.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const head = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut

  return `${head.trimEnd()}…`
}

export const generateMeta = async (args: { doc: MetaDoc | null }): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL(doc?.meta?.image)

  const docTitle = clean(doc?.title)

  // `meta.title` из админки приходит без суффикса сайта, `doc.title` — заголовок
  // документа. Суффикс дописываем только если его там ещё нет: иначе страница
  // остаётся с голым названием проекта («Жемчужина Вятки») и в выдаче не
  // отличается от остальных — рекомендация Вебмастера 22.10.
  const titleBase = clean(doc?.meta?.title) || shorten(docTitle, TITLE_MAX)
  const title = !titleBase
    ? SITE.name
    : titleBase.includes(SITE.name)
      ? titleBase
      : `${titleBase} | ${SITE.name}`

  // Пустой `description` — вторая половина той же рекомендации: без него
  // страница отдаётся без сниппета. Порядок: SEO-поле → summary документа →
  // описание сайта вместе с заголовком страницы (тогда текст уникален).
  const description =
    clean(doc?.meta?.description) ||
    clean(doc?.summary) ||
    (docTitle ? `${docTitle}: ${SITE.description}` : SITE.description)

  return {
    description,
    openGraph: mergeOpenGraph({
      description,
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
}
