import type { GlobalAfterChangeHook } from 'payload'

import { safeRevalidateTag } from '@/utilities/safeRevalidate'

export const revalidateFooter: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info(`Revalidating footer`)

    safeRevalidateTag('global_footer')
  }

  return doc
}
