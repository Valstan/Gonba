#!/usr/bin/env node
//
// Влить секреты комнаты КАРМАНа в env-файл. Вызывается из
// scripts/pull-secrets-from-vault.sh НА БОКСЕ; JSON вида {"secrets":{...}} — на stdin.
//
// Почему отдельный файл, а не heredoc внутри шелл-скрипта: первая версия была
// встроенной (`python3 - "$ENV_FILE" <<'PY'`), и это сломалось на первом же
// боевом прогоне — `python3 -` читает ПРОГРАММУ из stdin, туда же лился JSON,
// и до данных дело не доходило. Два потребителя одного stdin.
//
// Побочная выгода, ради которой стоило переписать: отдельный файл на Node
// покрывается обычным юнит-тестом в CI. Прежняя проверка на фикстурах извлекала
// код регуляркой и запускала отдельно — то есть проверяла логику, но НЕ проводку,
// и ровно поэтому ошибку не поймала.

import { readFileSync, writeFileSync, statSync, chmodSync, renameSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Слияние, а не перезапись.
 *
 * Ключи, которых нет в комнате, остаются нетронутыми — иначе первый же прогон
 * стёр бы всё, что заводилось руками до переезда в комнату (соль хеша IP, номер
 * счётчика Метрики), и мы узнали бы об этом по упавшему проду, а не по логу.
 *
 * Комментарии и пустые строки сохраняются как есть: env-файл читают люди.
 */
export function mergeEnvLines(lines, secrets) {
  const seen = new Set()
  const updated = []
  const out = []

  for (const line of lines) {
    const stripped = line.replace(/^\s+/, '')
    if (!stripped || stripped.startsWith('#') || !stripped.includes('=')) {
      out.push(line)
      continue
    }
    const key = stripped.slice(0, stripped.indexOf('=')).trim()
    if (!Object.prototype.hasOwnProperty.call(secrets, key)) {
      out.push(line)
      continue
    }
    seen.add(key)
    const next = `${key}=${secrets[key]}`
    if (next !== line) updated.push(key)
    out.push(next)
  }

  const added = Object.keys(secrets).filter((key) => !seen.has(key))
  for (const key of added) out.push(`${key}=${secrets[key]}`)

  return { lines: out, added, updated, changed: added.length > 0 || updated.length > 0 }
}

/** Атомарная запись с сохранением прав: временный файл рядом → chmod → rename. */
export function writeEnvAtomically(envPath, lines) {
  const mode = statSync(envPath).mode & 0o777
  const tmp = join(dirname(envPath), `.${Date.now()}.env.tmp`)
  try {
    writeFileSync(tmp, lines.join('\n') + '\n', { encoding: 'utf8' })
    chmodSync(tmp, mode)
    // rename в пределах одной ФС атомарен: сервис прочитает либо старый целый
    // файл, либо новый целый, но никогда половину.
    renameSync(tmp, envPath)
  } catch (error) {
    if (existsSync(tmp)) unlinkSync(tmp)
    throw error
  }
}

async function main() {
  const envPath = process.argv[2]
  if (!envPath) {
    console.error('[vault] не передан путь к env-файлу')
    process.exit(2)
  }

  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  const secrets = JSON.parse(raw).secrets ?? {}

  const result = mergeEnvLines(readFileSync(envPath, 'utf8').split('\n'), secrets)

  if (!result.changed) {
    console.log('[vault] env уже совпадает с комнатой — файл не тронут')
    return
  }

  writeEnvAtomically(envPath, result.lines)

  // Только ИМЕНА ключей. Значения не печатаем ни при каких обстоятельствах:
  // вывод деплоя читаем не только мы.
  if (result.added.length) console.log(`[vault] добавлено: ${[...result.added].sort().join(', ')}`)
  if (result.updated.length) console.log(`[vault] обновлено: ${[...result.updated].sort().join(', ')}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[vault] слияние не удалось: ${error.message}`)
    process.exit(1)
  })
}
