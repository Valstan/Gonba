import type { Payload } from 'payload'

// Какие ключи объектов можно физически удалять из бакета.
//
// Зачем отдельный слой: `objectKey`/`posterKey`/`media[].objectKey` приходят от клиента
// (сервер проверяет только формат `media/lenta/...`), и до аудита 2026-10-18 в
// `/api/ugc/delete-submission` удалялся **любой** ключ из своей записи. Значит было достаточно
// создать публикацию, сославшись в ней на чужой файл, и удалить публикацию — файл чужой
// публикации исчезал из бакета, а строка оставалась со ссылкой в никуда. Проверка владения
// отвечала на вопрос «твоя ли запись», но не «твой ли файл»: запись своя, ключ — чужой.
//
// Правильный вопрос перед удалением: ссылается ли на этот ключ кто-то ещё? Если да —
// файл не наш, и удалять его нельзя (ни анониму, ни персоналу: иначе удаление спам-записи
// ломало бы чужую публикацию).

export type KeyReferenceLookup = (key: string) => Promise<boolean>

/**
 * Отбирает ключи, на которые не ссылается никто, кроме удаляемой записи.
 *
 * Дубли внутри одного документа схлопываются; пустые значения отбрасываются. Порядок
 * обхода детерминированный (порядок появления), ошибка поиска трактуется как «ссылка есть» —
 * отказ в удалении безопаснее удаления чужого файла.
 */
export async function selectDeletableKeys(
  keys: Iterable<string | null | undefined>,
  isReferencedByAnother: KeyReferenceLookup,
): Promise<{ deletable: string[]; kept: string[] }> {
  const unique = [...new Set([...keys].filter((key): key is string => Boolean(key)))]
  const deletable: string[] = []
  const kept: string[] = []

  for (const key of unique) {
    let referenced = true
    try {
      referenced = await isReferencedByAnother(key)
    } catch {
      referenced = true
    }
    if (referenced) kept.push(key)
    else deletable.push(key)
  }

  return { deletable, kept }
}

/**
 * Ссылается ли на ключ другая публикация — в любом из полей с ключами объекта.
 *
 * `not_equals` по id отсекает саму удаляемую запись: её собственные ключи удалять можно.
 * Поиск идёт с `overrideAccess`, потому что вопрос технический («есть ли где-то ещё такая
 * строка»), а не про права вызывающего.
 */
export async function isKeyReferencedByAnotherSubmission(
  payload: Payload,
  submissionId: number,
  key: string,
): Promise<boolean> {
  const refs = await payload.find({
    collection: 'submissions',
    where: {
      and: [
        { id: { not_equals: submissionId } },
        {
          or: [
            { objectKey: { equals: key } },
            { posterKey: { equals: key } },
            { 'media.objectKey': { equals: key } },
            { 'media.posterKey': { equals: key } },
          ],
        },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return refs.totalDocs > 0
}
