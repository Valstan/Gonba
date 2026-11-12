#!/usr/bin/env node
/**
 * Peer-гейт: установленная версия `next` должна попадать в peer-диапазон,
 * объявленный `@payloadcms/next`.
 *
 * Зачем отдельный гейт (G592): «обновили next» и «peer-долг закрыт» — это два
 * разных факта. Патч внутри уязвимой ветки закрывает CVE, но peer-конфликт
 * закрывает ТОЛЬКО уход на совместимую ветку. Аудит по advisory остаётся
 * красным по peer-пункту, пока версия не попадает в объявленный диапазон —
 * и без машинной проверки это «осталось красным» видно только тому, кто знает,
 * куда смотреть.
 *
 * Раньше расхождение маскировалось двумя способами:
 *   1) `.npmrc` держит `legacy-peer-deps=true` — npm не проверяет peer вовсе,
 *      и `npm ls next` показывает «ok» даже на несовместимой комбинации;
 *   2) `npm ls` без флага не различает «нет в диапазоне» и «не установлено».
 *
 * Поэтому гейт читает peer-ДИАПАЗОН из node_modules и сверяет его с реально
 * установленной версией next — независимо от того, что думает npm.
 *
 * Диапазоны, которые встречаются в peer-диапазонах npm, — это подмножество
 * semver: сравнения (`>=`, `>`, `<=`, `<`, `=`) через пробел (И) и `||` (ИЛИ).
 * Разбираем их здесь сами, без зависимости на `semver`: пакет не должен
 * зависеть от транзитивного hoisting, чтобы гейт был зелёным.
 *
 * Fail-closed: нераспознанный comparitor — ошибка, а не «пропустить».
 * Гейт, который не может прочитать правило, не имеет права молчать.
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const fail = (message) => {
  console.error(`::error::${message}`)
  process.exit(1)
}

const readPackage = (relativePath) => {
  const absolutePath = path.join(webRoot, relativePath)
  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    fail(`не читается ${relativePath}: ${error.message}`)
  }
}

const parseVersion = (value) => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(value).trim())
  if (!match) {
    return null
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

const compare = (left, right) => left[0] - right[0] || left[1] - right[1] || left[2] - right[2]

/** Один comparitor: `>=16.3.3`, `<17.0.0`, `=16.3.3`. */
const satisfiesComparator = (version, comparator) => {
  const match = /^(>=|<=|>|<|=)?\s*v?(\d+(?:\.\d+){0,2})$/.exec(comparator.trim())

  if (!match) {
    throw new Error(`нераспознанный comparitor: "${comparator}"`)
  }

  const operator = match[1] ?? '='
  const parts = match[2].split('.').map(Number)

  while (parts.length < 3) {
    parts.push(0)
  }

  // Сравнивать можно только разобранные массивы: строка в compare() даёт
  // NaN (char - char), а NaN в любом сравнении — false, то есть гейт тихо
  // отвечает «не подходит» на ЛЮБУЮ версию. Ровно эта ошибка была в первой
  // редакции скрипта — гейт врал на живых данных.
  const parsedVersion = parseVersion(version)

  if (!parsedVersion) {
    throw new Error(`нераспознанная версия: "${version}"`)
  }

  const result = compare(parsedVersion, parts)

  switch (operator) {
    case '>=':
      return result >= 0
    case '>':
      return result > 0
    case '<=':
      return result <= 0
    case '<':
      return result < 0
    default:
      return result === 0
  }
}

/** Полный диапазон: `>=15.2.9 <15.3.0 || >=16.3.3 <17.0.0`. */
const satisfiesRange = (version, range) =>
  range
    .split('||')
    .some((alternative) =>
      alternative
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .every((comparator) => satisfiesComparator(version, comparator)),
    )

/**
 * Self-test гейта. Гейт, который всегда отвечает «подходит» или всегда
 * «не подходит», опаснее отсутствия гейта: он выглядит как проверка и при
 * этом ничего не проверяет. Поэтому перед реальной сверкой гейт проверяет
 * САМ СЕБЯ на эталонных случаях — включая тот, ради которого он написан
 * (next 15.5.28 вне диапазона).
 */
const PEER_RANGE_SAMPLE = '>=15.2.9 <15.3.0 || >=15.3.9 <15.4.0 || >=15.4.11 <15.5.0 || >=16.3.3 <17.0.0'

const SELF_TEST_CASES = [
  { version: '16.3.8', expected: true, why: 'текущая чистая ветка' },
  { version: '16.3.3', expected: true, why: 'нижняя граница включена' },
  { version: '17.0.0', expected: false, why: 'верхняя граница исключена' },
  { version: '15.5.28', expected: false, why: 'старая ветка вне диапазона — ради этого гейт и написан' },
  { version: '15.4.11', expected: true, why: 'старая совместимая ветка' },
  { version: '15.4.12', expected: true, why: 'внутри ветки >=15.4.11 <15.5.0' },
  { version: '15.4.10', expected: false, why: 'между двумя чистыми ветками' },
]

const selfTestFailures = SELF_TEST_CASES.filter((testCase) => {
  try {
    return satisfiesRange(testCase.version, PEER_RANGE_SAMPLE) !== testCase.expected
  } catch (error) {
    return true
  }
})

if (selfTestFailures.length > 0) {
  fail(
    'self-test гейта не пройден — сам гейт неисправен, результат проверки нельзя использовать. ' +
      `Отличающиеся случаи: ${selfTestFailures.map((testCase) => `${testCase.version} (${testCase.why})`).join('; ')}`,
  )
}

const nextPackage = readPackage(path.join('node_modules', 'next', 'package.json'))
const payloadNextPackage = readPackage(path.join('node_modules', '@payloadcms', 'next', 'package.json'))

const installedVersion = nextPackage.version
const peerRange = payloadNextPackage.peerDependencies?.next

if (!installedVersion) {
  fail('у next нет версии в node_modules/next/package.json')
}

if (!peerRange) {
  fail(
    `@payloadcms/next ${payloadNextPackage.version} не объявляет peerDependencies.next — нечего сверять. ` +
      'Peer-гейт молчать не может: печать отсутствия peer — это не «зелёный гейт».',
  )
}

let satisfied = false

try {
  satisfied = satisfiesRange(installedVersion, peerRange)
} catch (error) {
  fail(`peer-диапазон @payloadcms/next не разобран (${error.message}): "${peerRange}"`)
}

console.log(`next установлен: ${installedVersion}`)
console.log(`peer-диапазон @payloadcms/next ${payloadNextPackage.version}: ${peerRange}`)

if (!satisfied) {
  fail(
    `УСТАНОВЛЕННЫЙ next ${installedVersion} НЕ входит в peer-диапазон @payloadcms/next ${payloadNextPackage.version} ` +
      `("${peerRange}"). Peer-долг не закрыт. Нужна версия next, попадающая в диапазон ` +
      '(проверить: npm view @payloadcms/next@<v> peerDependencies.next).',
  )
}

console.log(`✅ next ${installedVersion} в peer-диапазоне @payloadcms/next ${payloadNextPackage.version}`)
