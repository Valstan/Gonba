import type { Server } from 'node:http'

/**
 * Таймауты HTTP-сервера и graceful shutdown (профилактика G234, письмо brain 2026-08-08).
 *
 * Две отдельные проблемы, обе решаются здесь:
 *
 * 1. **Гонка keep-alive.** У Node дефолтный `server.keepAliveTimeout` — 5 секунд.
 *    Если перед приложением стоит прокси с пулом keep-alive-соединений (у nginx это
 *    `upstream { keepalive N }`, idle 60 с), прокси штатно отправляет запрос в сокет,
 *    который приложение только что закрыло → `502` на случайной позиции серии POST
 *    при пустых логах приложения. Лечится тем, что таймаут приложения **длиннее**
 *    прокси-пула. У нас на сегодня пула нет (`proxy_pass` напрямую, без `upstream`),
 *    поэтому это профилактика: значение выставлено заранее, чтобы мина не взвелась
 *    в тот день, когда кто-то добавит `upstream ... { keepalive }` ради скорости.
 *
 *    `keepAliveTimeout` умеет сам standalone-`server.js` (env `KEEP_ALIVE_TIMEOUT`,
 *    выставлен в `deploy/systemd/gonba.service`), а вот `headersTimeout` Next не трогает
 *    — он остаётся дефолтным 60 000 мс и оказался бы **короче** keep-alive. Node требует
 *    обратного порядка, иначе первым срабатывает header-таймаут. Поэтому доставляем его
 *    здесь: `headersTimeout = keepAliveTimeout + 1000` (как у пионера — 65 000 / 66 000).
 *
 * 2. **SIGTERM без drain.** Next standalone не вешает обработчик SIGTERM, а дефолт Node —
 *    немедленный выход. Значит каждый `systemctl restart gonba` (то есть **каждый деплой**)
 *    рвёт запросы в полёте с той же сигнатурой 502. Ниже — обычный graceful drain:
 *    перестаём слушать, закрываем idle keep-alive-сокеты, ждём активные запросы,
 *    выходим сразу как дренаж закончился, но не дольше `SHUTDOWN_DRAIN_MS`.
 *
 * Почему через `process._getActiveHandles()`: Next не отдаёт ссылку на `http.Server`
 * ни в какое пользовательское API, а `instrumentation.register()` вызывается уже после
 * `server.listen()` — то есть сервер к этому моменту живёт среди активных хэндлов.
 * API недокументированное, поэтому всё обёрнуто защитно: не нашли сервер — модуль
 * тихо ничего не делает и приложение работает как раньше.
 */

const KEEP_ALIVE_MS = toPositiveInt(process.env.KEEP_ALIVE_TIMEOUT) ?? 65_000
const HEADERS_MS = KEEP_ALIVE_MS + 1_000
const DRAIN_MS = toPositiveInt(process.env.SHUTDOWN_DRAIN_MS) ?? 15_000

/** Сервер ищем не бесконечно: 10 попыток по 500 мс с запасом покрывают старт. */
const LOOKUP_ATTEMPTS = 10
const LOOKUP_DELAY_MS = 500

let installed = false

function toPositiveInt(raw: string | undefined): number | undefined {
  const value = Number.parseInt(raw ?? '', 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * Проверяем по форме, а не через `instanceof http.Server`: значение-импорт `node:http`
 * в этом модуле ломает edge-сборку `instrumentation.ts` (webpack тянет граф дин. импорта
 * в оба рантайма, `UnhandledSchemeError: node:`). Тип импортируется type-only — он стирается.
 * `closeIdleConnections` есть только у http/https-сервера (Node 18.2+), голый net.Server
 * под эту проверку не попадёт.
 */
function isHttpServer(handle: unknown): handle is Server {
  if (typeof handle !== 'object' || handle === null) return false
  const candidate = handle as Partial<Server>
  return (
    typeof candidate.close === 'function' &&
    typeof candidate.closeIdleConnections === 'function' &&
    typeof candidate.keepAliveTimeout === 'number'
  )
}

function findHttpServers(): Server[] {
  const getHandles = (process as NodeJS.Process & { _getActiveHandles?: () => unknown[] })
    ._getActiveHandles
  if (typeof getHandles !== 'function') return []
  try {
    return getHandles.call(process).filter(isHttpServer)
  } catch {
    return []
  }
}

function applyTimeouts(servers: Server[]): void {
  for (const server of servers) {
    server.keepAliveTimeout = KEEP_ALIVE_MS
    server.headersTimeout = HEADERS_MS
  }
}

function installShutdownHandlers(servers: Server[]): void {
  let shuttingDown = false

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`[http-lifecycle] ${signal}: drain до ${DRAIN_MS} мс`)

    const force = setTimeout(() => {
      console.warn('[http-lifecycle] drain не уложился в срок, выходим принудительно')
      process.exit(0)
    }, DRAIN_MS)

    let pending = servers.length
    for (const server of servers) {
      // Без этого close() висит на idle keep-alive-сокетах до самого таймаута.
      server.closeIdleConnections()
      server.close(() => {
        if (--pending > 0) return
        clearTimeout(force)
        process.exit(0)
      })
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

/**
 * Идемпотентно: повторный вызов (dev-перезапуск, второй `register()`) ничего не делает.
 */
export function installHttpLifecycle(attempt = 1): void {
  if (installed) return

  const servers = findHttpServers()
  if (servers.length === 0) {
    if (attempt >= LOOKUP_ATTEMPTS) {
      console.warn('[http-lifecycle] http.Server не найден — таймауты и drain не установлены')
      return
    }
    setTimeout(() => installHttpLifecycle(attempt + 1), LOOKUP_DELAY_MS).unref()
    return
  }

  installed = true
  applyTimeouts(servers)
  installShutdownHandlers(servers)
  console.info(
    `[http-lifecycle] keepAliveTimeout=${KEEP_ALIVE_MS}мс headersTimeout=${HEADERS_MS}мс drain=${DRAIN_MS}мс`,
  )
}
