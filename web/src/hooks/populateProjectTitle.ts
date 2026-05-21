import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Auto-fill Projects.title from shortLabel if title is empty.
 *
 * Why:
 *   - title is required (used by slugField as the slug source by default)
 *   - shortLabel is also required and has defaultValue 'Проект'
 *   - without this hook, editors who skip title get a Payload validation error
 *     and often work around it by pasting the slug into title — producing rows
 *     where title === slug (e.g. legacy projects eco-hotel-booking, about-project,
 *     vyatskiy-sbor). Cleaner UX is to fall back to shortLabel.
 *
 * Behaviour:
 *   - Only fills when title is empty / blank — never overwrites user input.
 *   - Trims shortLabel before copying so accidental whitespace is removed.
 *   - Returns the same data object on every code path so Payload's hook chain
 *     stays consistent.
 */
export const populateProjectTitle: CollectionBeforeValidateHook = ({ data, operation }) => {
  if (!data) return data
  if (operation !== 'create' && operation !== 'update') return data

  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (title) return data

  const shortLabel = typeof data.shortLabel === 'string' ? data.shortLabel.trim() : ''
  if (!shortLabel) return data

  return {
    ...data,
    title: shortLabel,
  }
}
