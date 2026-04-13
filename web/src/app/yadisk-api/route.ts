import { handleYadiskGet, handleYadiskPost } from '@/server/endpoints/yadisk/list-actions'

export async function GET(request: Request) {
  return handleYadiskGet(request)
}

export async function POST(request: Request) {
  return handleYadiskPost(request)
}
