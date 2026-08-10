'use client'

import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Веб-аналитика: Яндекс.Метрика (директива brain 2026-07-26, закрывает отложенную
 * часть #051). LiveInternet убран 2026-08-10 по решению владельца — D-025, единственный
 * счётчик экосистемы — Метрика.
 *
 * Принципы (условия директивы, не стиль):
 *  - env-gated БЕЗ пересборки: конфиг берётся с `/api/analytics-config` (force-dynamic,
 *    читает env бокса на каждый запрос) — NEXT_PUBLIC не годится, он запекается в
 *    CI-бандл. Пустой env → эндпоинт отдаёт ноль → компонент ничего не рендерит.
 *    ISR/SSR не трогаем: компонент клиентский, на сервере — ноль разметки счётчиков.
 *  - consent-first (152-ФЗ): счётчик НЕ грузится, пока посетитель не нажал «Принять».
 *    Выбор в localStorage (`gonba:analytics-consent`: granted|denied) — баннер один раз.
 *    «Отказаться» — счётчик не грузится совсем, сайт работает как обычно.
 *  - отложенная загрузка: конфиг запрашивается только после гидратации; скрипт — через
 *    requestIdleCallback (fallback setTimeout), чтобы не конкурировать с гидратацией.
 *  - SPA-навигация: Метрика сама видит только первую загрузку — на смену pathname
 *    шлём `ym('hit')`.
 *
 * Видимый информер посещаемости (D-017) живёт отдельно, в подвале, и НЕ зависит от
 * согласия: он проксируется через свой origin и не делает запросов к третьей стороне
 * из браузера посетителя — см. `app/api/analytics-informer/route.ts`.
 */

const CONSENT_KEY = 'gonba:analytics-consent'
type Consent = 'granted' | 'denied' | null

type AnalyticsConfig = {
  ymCounterId: number
}

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void
  }
}

const loadMetrika = (id: number) => {
  if (window.ym) return
  const w = window as unknown as Record<string, unknown>
  const ym = function (...args: unknown[]) {
    const self = ym as unknown as { a?: unknown[][] }
    ;(self.a = self.a || []).push(args)
  }
  ;(ym as unknown as { l: number }).l = Date.now()
  w.ym = ym
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://mc.yandex.ru/metrika/tag.js'
  document.head.appendChild(s)
  window.ym!(id, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false, // приватность: записи сессий не ведём (в кабинете счётчика тоже выключено)
  })
}

const runDeferred = (fn: () => void) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout: 4000 })
  } else {
    setTimeout(fn, 1500)
  }
}

export const Analytics: React.FC = () => {
  const [config, setConfig] = useState<AnalyticsConfig | null>(null)
  const [consent, setConsent] = useState<Consent>(null)
  const loadedRef = useRef(false)
  const pathname = usePathname()
  const lastHitRef = useRef<string | null>(null)

  // Конфиг + сохранённый выбор — только на клиенте, после гидратации.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (stored === 'granted' || stored === 'denied') setConsent(stored)
    } catch {
      /* приватный режим без localStorage — покажем баннер, выбор не переживёт вкладку */
    }
    let cancelled = false
    fetch('/api/analytics-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AnalyticsConfig | null) => {
        if (!cancelled && data && data.ymCounterId > 0) setConfig(data)
      })
      .catch(() => {
        /* аналитика — необязательный слой; сбой конфига молча = выключено */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const activate = useCallback((cfg: AnalyticsConfig) => {
    if (loadedRef.current) return
    loadedRef.current = true
    runDeferred(() => {
      loadMetrika(cfg.ymCounterId)
      lastHitRef.current = window.location.pathname
    })
  }, [])

  // Загрузка после согласия (в т.ч. сохранённого с прошлого визита) и прихода конфига.
  useEffect(() => {
    if (consent === 'granted' && config) activate(config)
  }, [consent, config, activate])

  // SPA-навигация: hit в Метрику.
  useEffect(() => {
    if (!loadedRef.current || !pathname || lastHitRef.current === pathname) return
    lastHitRef.current = pathname
    const ymId = config?.ymCounterId ?? 0
    if (ymId > 0 && window.ym) window.ym(ymId, 'hit', window.location.href)
  }, [pathname, config])

  const decide = (value: Exclude<Consent, null>) => {
    setConsent(value)
    try {
      localStorage.setItem(CONSENT_KEY, value)
    } catch {
      /* ок — выбор проживёт до конца вкладки */
    }
  }

  // Ничего не включено (или конфиг ещё не пришёл) → ни баннера, ни счётчика.
  if (!config) return null

  return (
    <>
      {consent === null && (
        <div
          className="analyticsConsent"
          role="dialog"
          aria-live="polite"
          aria-label="Согласие на аналитику"
        >
          <p className="analyticsConsent__text">
            Мы используем счётчик посещаемости (Яндекс.Метрика), чтобы понимать, какие разделы
            сайта полезны. Данные обезличены. Можно отказаться — сайт будет работать как обычно.
          </p>
          <div className="analyticsConsent__actions">
            <button
              type="button"
              className="analyticsConsent__accept"
              onClick={() => decide('granted')}
            >
              Принять
            </button>
            <button
              type="button"
              className="analyticsConsent__decline"
              onClick={() => decide('denied')}
            >
              Отказаться
            </button>
          </div>
        </div>
      )}
    </>
  )
}
