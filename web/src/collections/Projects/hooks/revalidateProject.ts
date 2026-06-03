import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import type { Project } from '../../../payload-types'
import { safeRevalidatePath } from '@/utilities/safeRevalidate'

// Пути проекта, которые надо обновить при сохранении. Деталь-страница
// (/projects/{slug}) рендерится динамически (draftMode в queryProjectBySlug),
// поэтому для неё revalidate — почти no-op; ключевой адресат — /gallery, она
// force-static + revalidate=600 и без явного revalidate не обновится до 10 мин.
const projectPaths = (slug?: string | null): string[] => {
  if (!slug) return []
  const base = `/projects/${slug}`
  return [base, `${base}/gallery`]
}

export const revalidateProject: CollectionAfterChangeHook<Project> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    if (doc._status === 'published') {
      for (const path of projectPaths(doc.slug)) {
        payload.logger.info(`Revalidating project at path: ${path}`)
        safeRevalidatePath(path)
      }
    }

    // Если slug менялся — обновляем и старые пути, чтобы не залипал кэш.
    if (previousDoc?.slug && previousDoc.slug !== doc.slug) {
      for (const path of projectPaths(previousDoc.slug)) {
        safeRevalidatePath(path)
      }
    }
  }
  return doc
}

export const revalidateProjectDelete: CollectionAfterDeleteHook<Project> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    for (const path of projectPaths(doc?.slug)) {
      safeRevalidatePath(path)
    }
  }
  return doc
}
