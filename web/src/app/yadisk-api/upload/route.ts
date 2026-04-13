import { handleYadiskUploadPost } from '@/server/endpoints/yadisk/upload'

export async function POST(request: Request) {
  return handleYadiskUploadPost(request)
}
