import { getPayload } from 'payload'
import configPromise from '../../web/src/payload.config.ts'

const config = await configPromise
const payload = await getPayload({ config })

const token = process.env.VK_TOKEN_229392127 || process.env.VK_TOKEN
if (!token) { console.error('No VK token'); process.exit(1) }

const existing = await payload.find({ collection: 'vkAutoSync', overrideAccess: true, limit: 1 })
if (existing.docs.length > 0) {
  console.log('Already seeded:', existing.docs[0].id)
  process.exit(0)
}

const source = await payload.create({
  collection: 'vkAutoSync',
  overrideAccess: true,
  data: {
    communityUrl: 'https://vk.com/club229392127',
    groupId: 229392127,
    accessToken: token,
    sectionSlug: 'vyatskaya-lepota-malmyzh',
    projectSlug: 'vyatskaya-lepota',
    syncIntervalHours: 3,
    isEnabled: true,
    postType: 'news',
    lastSyncStatus: 'pending',
  },
})

console.log('Created VK Auto-Sync source:', source.id)
console.log('Community:', source.communityUrl)
console.log('Section:', source.sectionSlug)
process.exit(0)
