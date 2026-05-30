import { redirect } from 'next/navigation'

// Орбит-карусель вернулась на главную (ADR-0006). Старый /orbit редиректим на /,
// чтобы не ломать возможные закладки/внешние ссылки.
export default function OrbitRedirect() {
  redirect('/')
}
