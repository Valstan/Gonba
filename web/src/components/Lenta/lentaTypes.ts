// Одно медиа поста (фото/видео). URL уже указывает на Object Storage — браузер грузит
// напрямую. Пост-в-стиле-ВК: одна подпись — несколько таких медиа (мозаика + галерея).
export type LentaMedia = {
  kind: 'photo' | 'video'
  mediaUrl: string
  posterUrl: string | null
  width: number | null
  height: number | null
}

// Карточка «Народной ленты» — данные, подготовленные сервером (страница /lenta), либо
// собранные на клиенте после загрузки (LentaUpload) для оптимистичного показа.
// `media` — все файлы поста (media[0] = обложка). Верхнеуровневые kind/mediaUrl/…
// дублируют обложку (media[0]) для удобства — карточка/лайтбокс итерируют `media`.
export type LentaItem = {
  id: number
  kind: 'photo' | 'video'
  mediaUrl: string
  posterUrl: string | null
  media: LentaMedia[]
  authorName: string | null
  caption: string | null
  likeCount: number
  commentCount: number
  viewCount: number
  width: number | null
  height: number | null
}
