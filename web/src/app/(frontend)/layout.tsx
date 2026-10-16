import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Analytics } from '@/components/analytics/Analytics.client'
import { SiteDecor } from '@/components/SiteDecor.client'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './fonts.css'
import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { JsonLd } from '@/components/seo/JsonLd'
import { organizationJsonLd, websiteJsonLd } from '@/seo/jsonld'

// PT Serif, Manrope и JetBrains Mono приходят из `./fonts.css` — это наши файлы
// в `public/fonts`, а не сборка `next/font/google`: тот ходил за шрифтами в
// Google прямо во время сборки, и 16.10.2026 из-за этого дважды покраснел
// пайплайн (второй раз — обязательный чек CI, то есть PR нельзя было смёржить).
// Переменные `--font-*` теперь объявлены в fonts.css на `:root`, а `globals.css`
// пользуется ими через `var(...)`, так что классы на <html> больше не нужны.

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html
      className={cn(GeistSans.variable, GeistMono.variable)}
      lang="ru"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        {/* Предзагрузка — только те лица, что нужны первому экрану (заголовки
            PT Serif 400 и текст Manrope): раньше `next/font/google` грузил так
            все 12 лиц кириллицы и латиницы, включая те, что в первом экране не
            встречаются. Курсив и 700 подтянутся по мере надобности. */}
        <link
          as="font"
          crossOrigin="anonymous"
          href="/fonts/pt-serif-400-normal-cyrillic.woff2"
          rel="preload"
          type="font/woff2"
        />
        <link
          as="font"
          crossOrigin="anonymous"
          href="/fonts/pt-serif-400-normal-latin.woff2"
          rel="preload"
          type="font/woff2"
        />
        <link
          as="font"
          crossOrigin="anonymous"
          href="/fonts/manrope-wght-cyrillic.woff2"
          rel="preload"
          type="font/woff2"
        />
        <link
          as="font"
          crossOrigin="anonymous"
          href="/fonts/manrope-wght-latin.woff2"
          rel="preload"
          type="font/woff2"
        />
        <link href="/favicon.ico" rel="icon" sizes="any" />
        <link href="/favicon-32.png" rel="icon" type="image/png" sizes="32x32" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" sizes="180x180" />
        {/* pool #051 (GEO): WebSite + Organization — серверно, ноль JS в браузер. */}
        <JsonLd data={[websiteJsonLd(), organizationJsonLd()]} />
      </head>
      <body>
        <Providers>
          <SiteDecor />
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <Header />
          {children}
          <Footer />
          {/* Счётчики (Метрика+LI): env-gated, consent-first — см. Analytics.client.tsx */}
          <Analytics />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  // Канонический адрес каждой страницы (п.7 чек-листа D-088): './'
  // резолвится относительно metadataBase в путь текущей страницы,
  // без поисковых параметров. Страницы не переопределяют alternates,
  // поэтому правило действует на всё (frontend)-дерево сразу.
  alternates: {
    canonical: './',
  },
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
  },
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' }],
    apple: '/apple-touch-icon.png',
  },
}
