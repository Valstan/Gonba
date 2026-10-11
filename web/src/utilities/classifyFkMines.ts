/**
 * Классификация FK-мин (G135) — чистая функция, покрыта тестами без БД.
 *
 * Мина = пара «NOT NULL + ON DELETE SET NULL» на relationship: жёсткое удаление
 * родителя падает PG 23502, как только у него есть дочерняя строка. Потребитель —
 * scripts/scan-fk-mines.ts (гейт) и tests/int/classify-fk-mines.int.spec.ts.
 */

export type FkMine = {
  /** `<table>.<column>` — стабильный ключ мины (Constraint name меняется, эта пара нет). */
  readonly id: string
  /** Таблица-источник (ребёнок). */
  readonly table: string
  readonly column: string
  /** Таблица-родитель. */
  readonly refTable: string
}

export type AllowEntry = {
  readonly id: string
  /** Если задан — допуск действует только на ссылку именно на эту таблицу. */
  readonly refTable?: string
  readonly note?: string
}

export type Verdict = {
  /** Известные мины: найдены в схеме и покрыты allowlist'ом. */
  readonly known: readonly FkMine[]
  /** Новые мины: в схеме есть, в allowlist'е нет — гейт краснеет. */
  readonly fresh: readonly FkMine[]
  /** Вылеченные: в allowlist'е есть, в схеме уже нет. */
  readonly healed: readonly AllowEntry[]
}

/**
 * Совпадение идёт по `<table>.<column>` + таблице-родителю, а не по имени
 * constraint: drizzle переименовывает ограничения между версиями схемы, пара
 * «колонка → родитель» — это и есть мина.
 */
export function classifyFkMines(found: readonly FkMine[], allowed: readonly AllowEntry[]): Verdict {
  const byId = new Map(allowed.map((a) => [a.id, a]))
  const foundIds = new Set(found.map((m) => m.id))

  const isAllowed = (m: FkMine): boolean => {
    const entry = byId.get(m.id)
    if (!entry) return false
    // Записанный родитель — часть допуска: колонка ссылается на другую таблицу
    // ⇒ это другая мина, пусть даже с тем же именем пары.
    if (entry.refTable && entry.refTable !== m.refTable) return false
    return true
  }

  const known = found.filter(isAllowed)
  const fresh = found.filter((m) => !isAllowed(m))
  const healed = allowed.filter((a) => !foundIds.has(a.id))
  return { known, fresh, healed }
}
