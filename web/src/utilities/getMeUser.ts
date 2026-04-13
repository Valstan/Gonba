import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '../payload-types'
import { getClientSideURL } from './getURL'

const getMeUserBaseUrls = () => {
  const candidates: string[] = []

  const configuredBase = getClientSideURL()
  if (configuredBase && configuredBase.startsWith('http')) {
    candidates.push(configuredBase)
  }

  const port = Number(process.env.PORT) || 3000
  candidates.push(`http://127.0.0.1:${port}`)

  return Array.from(new Set(candidates))
}

const requestMeUser = async (baseUrl: string, token: string | undefined) => {
  return fetch(`${baseUrl}/api/users/me`, {
    headers: {
      Authorization: `JWT ${token || ''}`,
    },
  })
}

const parseMeUserResponse = async (response: Response): Promise<{ user: User | null } | null> => {
  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.toLowerCase().includes('application/json')
  if (!isJson) return null

  const text = await response.text()
  if (!text) return { user: null }

  try {
    const parsed = JSON.parse(text) as { user?: User | null }
    return { user: parsed.user || null }
  } catch {
    return null
  }
}

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  token: string
  user: User
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value

  const baseUrls = getMeUserBaseUrls()
  let meUserReq: Response | null = null
  let meUser: User | null = null
  let meUserError: unknown = null

  for (const baseUrl of baseUrls) {
    try {
      const response = await requestMeUser(baseUrl, token)
      const parsed = await parseMeUserResponse(response)
      if (!parsed) continue

      meUserReq = response
      meUser = parsed.user
      break
    } catch (error) {
      meUserError = error
      meUserReq = null
    }
  }

  if (!meUserReq) {
    throw meUserError instanceof Error ? meUserError : new Error('Cannot reach /api/users/me')
  }

  if (validUserRedirect && meUserReq.ok && meUser) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && (!meUserReq.ok || !meUser)) {
    redirect(nullUserRedirect)
  }

  if (!meUser) {
    throw new Error('Cannot parse /api/users/me response')
  }

  // Token will exist here because if it doesn't the user will be redirected
  return {
    token: token!,
    user: meUser,
  }
}
