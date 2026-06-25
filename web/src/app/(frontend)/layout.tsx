import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { JetBrains_Mono, Manrope, PT_Serif } from 'next/font/google'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { SiteDecor } from '@/components/SiteDecor.client'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { JsonLd } from '@/components/seo/JsonLd'
import { organizationJsonLd, websiteJsonLd } from '@/seo/jsonld'

const ptSerif = PT_Serif({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-pt-serif',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['cyrillic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html
      className={cn(
        GeistSans.variable,
        GeistMono.variable,
        ptSerif.variable,
        manrope.variable,
        jetbrainsMono.variable,
      )}
      lang="ru"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
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
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
  },
}
