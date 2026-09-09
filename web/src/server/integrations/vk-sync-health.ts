/**
 * VK auto-sync health — DB-based сводка для `/api/health`.
 *
 * Майский инцидент: VK-токены протухли 27 мая, auto-sync молча падал 2.5 дня
 * (`last_sync_status=error` писался в БД, но никто не смотрел). Громкий
 * `VK_SYNC_ALERT` в journalctl (см. `decideVkSyncAlert`) — реактивный лог-маркер;
 * здесь — **наблюдаемый снаружи** флаг в health-endpoint, который может опрашивать
 * внешний мониторинг. DB-based → переживает рестарт сервиса (in-memory счётчик
 * `vkConsecutiveAllFailRuns` сбрасывается на рестарте, этот — нет).
 *
 * Чистая функция (состояние/БД — у вызывающего), чтобы тестировать без Payload.
 */

export type VkSyncSourceSnapshot = {
  lastSyncStatus?: string | null
  lastSyncAt?: string | null
  syncIntervalHours?: number | null
}

export type VkSyncHealth = {
  /** false ⟺ серьёзный сбой: все опрошенные в ошибке ИЛИ есть просроченные источники. */
  healthy: boolean
  enabledSources: number
  erroredSources: number
  /** Источники, чей последний sync старше порога простоя (+буфер) — таймер не идёт. */
  staleSources: number
  /** Самый свежий lastSyncAt среди включённых источников (ISO) или null. */
  lastSyncAt: string | null
  /** Человекочитаемая причина, когда `healthy=false`. */
  details?: string
}

const DEFAULT_INTERVAL_HOURS = 3
const HOUR_MS = 60 * 60 * 1000
// Грейс поверх порога: один пропущенный прогон таймера не должен поднимать
// тревогу (всплеск нагрузки / разовый сетевой сбой), два подряд — уже сигнал.
const STALE_BUFFER_MS = HOUR_MS

/**
 * Самый широкий промежуток РАСПИСАНИЯ таймера, а не производная от интервала.
 *
 * Слоты в `deploy/systemd/gonba-vk-sync.timer` — 06/10/13/18/23 MSK, и ночной
 * промежуток 23:00 → 06:00 длиннее любого дневного. Без этой величины порог
 * считался как «2 × интервал + час» = ровно 7 часов при интервале 3 ч, то есть
 * **совпадал с ночным промежутком секунда в секунду**: любое опоздание утреннего
 * прогона поднимало бы тревогу каждое утро. Индикатор, который регулярно
 * краснеет без повода, перестают читать.
 *
 * Правишь слоты в юните — пересчитай это число: связь между расписанием и
 * порогом здоровья из самого юнита не видна.
 */
const LARGEST_SCHEDULED_GAP_MS = 7 * HOUR_MS

// «Опрошенные» = источники с определённым исходом последнего прогона. pending
// (никогда не синканный) и null не считаем — они не пытались (зеркало
// `attempted` в decideVkSyncAlert).
const ATTEMPTED_STATUSES = new Set(['success', 'error', 'no-new-posts'])

export function summarizeVkSyncHealth(
  sources: VkSyncSourceSnapshot[],
  nowMs: number,
): VkSyncHealth {
  const enabledSources = sources.length
  let erroredSources = 0
  let staleSources = 0
  let attempted = 0
  let mostRecentSyncAt: number | null = null

  for (const s of sources) {
    const status = s.lastSyncStatus ?? null
    if (status === 'error') erroredSources++
    if (status && ATTEMPTED_STATUSES.has(status)) attempted++

    const ts = s.lastSyncAt ? Date.parse(s.lastSyncAt) : NaN
    if (!Number.isNaN(ts)) {
      if (mostRecentSyncAt == null || ts > mostRecentSyncAt) mostRecentSyncAt = ts
      const intervalMs = (Number(s.syncIntervalHours) || DEFAULT_INTERVAL_HOURS) * HOUR_MS
      // Порог берём по тому, что реально задаёт ритм: у частых источников это
      // их собственный интервал, у всех наших — ночной промежуток расписания.
      const staleAfterMs = Math.max(intervalMs * 2, LARGEST_SCHEDULED_GAP_MS) + STALE_BUFFER_MS
      if (nowMs - ts > staleAfterMs) staleSources++
    }
  }

  // «Все опрошенные в ошибке» зеркалит VK_SYNC_ALERT — главный сигнал майского
  // инцидента (протухшие токены валят все источники разом).
  const allErrored = attempted > 0 && erroredSources >= attempted
  const healthy = enabledSources === 0 ? true : !allErrored && staleSources === 0

  const reasons: string[] = []
  if (allErrored) {
    reasons.push(
      `все ${attempted} опрошенных VK-источников в ошибке (вероятно протухли VK-токены)`,
    )
  }
  if (staleSources > 0) {
    reasons.push(`${staleSources} источник(ов) просрочены: sync молчит дольше порога простоя (таймер?)`)
  }

  return {
    healthy,
    enabledSources,
    erroredSources,
    staleSources,
    lastSyncAt: mostRecentSyncAt != null ? new Date(mostRecentSyncAt).toISOString() : null,
    ...(reasons.length ? { details: reasons.join('; ') } : {}),
  }
}
