import { createRequire } from 'node:module'

type NextCacheModule = {
  revalidatePath?: (path: string) => void
  revalidateTag?: (tag: string) => void
}

const require = createRequire(import.meta.url)
let cachedModule: NextCacheModule | null | undefined

const getNextCacheModule = (): NextCacheModule | null => {
  if (cachedModule !== undefined) return cachedModule
  try {
    cachedModule = require('next/cache') as NextCacheModule
  } catch {
    cachedModule = null
  }
  return cachedModule
}

export const safeRevalidatePath = (path: string) => {
  const mod = getNextCacheModule()
  if (!mod?.revalidatePath) return
  try {
    mod.revalidatePath(path)
  } catch {
    // Ignore in non-Next runtimes (tests, scripts)
  }
}

export const safeRevalidateTag = (tag: string) => {
  const mod = getNextCacheModule()
  if (!mod?.revalidateTag) return
  try {
    mod.revalidateTag(tag)
  } catch {
    // Ignore in non-Next runtimes (tests, scripts)
  }
}
