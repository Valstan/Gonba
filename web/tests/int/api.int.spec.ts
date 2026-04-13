import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

describe('API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  }, 30000)

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
    })
    expect(users).toBeDefined()
    expect(Array.isArray(users.docs)).toBe(true)
  })

  it('fetches published pages with access control', async () => {
    const pages = await payload.find({
      collection: 'pages',
      depth: 0,
      limit: 5,
      overrideAccess: false,
    })

    expect(pages).toBeDefined()
    expect(Array.isArray(pages.docs)).toBe(true)
  })

  it('fetches posts pagination metadata consistently', async () => {
    const posts = await payload.find({
      collection: 'posts',
      depth: 0,
      limit: 12,
      page: 1,
      overrideAccess: false,
    })

    expect(posts).toBeDefined()
    expect(typeof posts.totalDocs).toBe('number')
    expect(typeof posts.totalPages).toBe('number')
  })
})
