import React from 'react'

/**
 * Сериализация данных JSON-LD в безопасную для inline-`<script>` строку
 * (cross-project pool #051 — SEO/GEO).
 * `<`/`>`/`&` → \uXXXX (нельзя разорвать тег/HTML-сущность). U+2028/U+2029 матчим
 * через String.fromCharCode — литералы этих символов невидимы и портятся
 * редакторами/git, поэтому не встраиваем их в исходник.
 */
export function serializeJsonLd(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data)
    .replace(/[<>&]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    .split(String.fromCharCode(0x2028))
    .join('\\u2028')
    .split(String.fromCharCode(0x2029))
    .join('\\u2029')
}

/**
 * Серверный компонент JSON-LD: рендерит `<script type="application/ld+json">`
 * на сервере — НОЛЬ JS в браузер, ISR/SSR-совместимо.
 * `data` — один объект схемы или массив (несколько узлов графа).
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
  )
}
