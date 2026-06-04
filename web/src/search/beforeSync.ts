import { BeforeSync, DocToSync } from '@payloadcms/plugin-search/types'

export const beforeSyncWithSearch: BeforeSync = async ({ req, originalDoc, searchDoc }) => {
  const {
    doc: { relationTo: collection },
  } = searchDoc

  // Posts/Pages несут SEO-группу `meta`; Projects её не имеют — деривируем
  // заголовок/описание/превью из собственных полей проекта.
  const { slug, id, categories, title, meta, excerpt, summary, heroImage } = originalDoc

  const metaImage = meta?.image?.id ?? meta?.image
  const heroImageId = heroImage?.id ?? heroImage

  const modifiedDoc: DocToSync = {
    ...searchDoc,
    slug,
    meta: {
      ...meta,
      title: meta?.title || title,
      // Превью: SEO-картинка → обложка (heroImage). Заполняем всегда, чтобы
      // страница поиска бралась за meta.image единообразно для всех коллекций.
      image: metaImage ?? heroImageId,
      description: meta?.description || excerpt || summary || undefined,
    },
    categories: [],
  }

  if (categories && Array.isArray(categories) && categories.length > 0) {
    const populatedCategories: { id: string | number; title: string }[] = []
    for (const category of categories) {
      if (!category) {
        continue
      }

      if (typeof category === 'object') {
        populatedCategories.push(category)
        continue
      }

      const doc = await req.payload.findByID({
        collection: 'categories',
        id: category,
        disableErrors: true,
        depth: 0,
        select: { title: true },
        req,
      })

      if (doc !== null) {
        populatedCategories.push(doc)
      } else {
        console.error(
          `Failed. Category not found when syncing collection '${collection}' with id: '${id}' to search.`,
        )
      }
    }

    modifiedDoc.categories = populatedCategories.map((each) => ({
      relationTo: 'categories',
      categoryID: String(each.id),
      title: each.title,
    }))
  }

  return modifiedDoc
}
