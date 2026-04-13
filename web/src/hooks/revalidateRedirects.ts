import type { CollectionAfterChangeHook } from 'payload'

import { safeRevalidateTag } from '@/utilities/safeRevalidate'

export const revalidateRedirects: CollectionAfterChangeHook = ({ doc, req: { payload } }) => {
  payload.logger.info(`Revalidating redirects`)

  safeRevalidateTag('redirects')

  return doc
}
