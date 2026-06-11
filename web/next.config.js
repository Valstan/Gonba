import path from 'path'
import { fileURLToPath } from 'url'

import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const NEXT_PUBLIC_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  process.env.__NEXT_PRIVATE_ORIGIN ||
  'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Сборка для прода едет в CI (mandate brain 2026-06-11, Бокс 1): на сервер кладётся
  // готовый standalone-артефакт, бокс — runtime-only. tracingRoot = web/, чтобы
  // server.js лёг в корень .next/standalone (репо-рут не утягивается в trace).
  //
  // ⚠️ G41: standalone-сборка (outputFileTracing) МУТИРУЕТ локальный node_modules
  // (удаляет next/dist/client/components/builtin/* → следующая локальная сборка
  // падает «Cannot find module»; CI не страдает — там свежий install и одна сборка).
  // Поэтому standalone включается ТОЛЬКО по флагу STANDALONE_BUILD=1 (его ставит
  // deploy-prod.yml). Локальный `next build` — обычный, node_modules не портит.
  output: process.env.STANDALONE_BUILD === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: dirname,
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
      {
        protocol: 'https',
        hostname: 'downloader.disk.yandex.ru',
      },
      {
        protocol: 'https',
        hostname: 'disk.yandex.ru',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
