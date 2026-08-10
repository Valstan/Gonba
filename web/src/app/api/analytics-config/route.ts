import { NextResponse } from 'next/server'

/**
 * Runtime-конфиг веб-аналитики (директива brain 2026-07-26, условие «выключаемо без деплоя»).
 *
 * Почему не NEXT_PUBLIC_*: с переходом сборки в CI (2026-06-11) NEXT_PUBLIC-переменные
 * запекаются в бандл на build-стадии из GH-secret `GONBA_BUILD_ENV` — переключение
 * потребовало бы пересборку+деплой. Этот роут читает env **процесса на боксе**
 * (`/etc/gonba/gonba.env`) на каждый запрос → toggle = правка env + `restart gonba`.
 *
 * force-dynamic: без кэша, иначе ISR заморозит значение. Ответ крошечный, дёргается
 * клиентом один раз за сессию страницы (см. Analytics.client.tsx).
 *
 * LiveInternet отсюда убран 2026-08-10 (D-025): единственный счётчик экосистемы —
 * Яндекс.Метрика, а видимая цифра посещаемости берётся из её штатного информера
 * (`/api/analytics-informer`), а не из бейджа LI.
 */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { ymCounterId: Number(process.env.YM_COUNTER_ID) || 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
