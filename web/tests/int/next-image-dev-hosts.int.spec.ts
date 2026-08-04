import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'

describe('Next image development hosts', () => {
  it('keeps both local browser origins in the checked-in config', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(resolve(process.cwd(), 'next.config.js'), 'utf8'),
    )

    expect(source).toContain("hostname: 'localhost'")
    expect(source).toContain("hostname: '127.0.0.1'")
    expect(source).toContain("process.env.NODE_ENV === 'development'")
  })
})
