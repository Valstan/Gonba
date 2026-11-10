#!/usr/bin/env node
//
// Клиент раздела промтов Гоньбы: забрать живой раздел и отправить выполненное в архив.
//
// Контракт (мандат Мозга 08.11, D-190, + erratum 09.11):
//   GET  {PROMPTS_API_URL}/api/prompts/section?project=GONBA[&archived=1]
//   POST {PROMPTS_API_URL}/api/prompts/section   {"project":"GONBA","id":<number>,"archived":true}
//
// Токен — из env (PROMPTS_TOKEN_GONBA): он живёт в нашей комнате КАРМАНА и
// доезжает на бокс шагом доставки при деплое. Адрес — тоже из env
// (PROMPTS_API_URL): хостнейм соседнего сервиса в отслеживаемых файлах не
// лежит (D-038), конфиг живёт на боксу, как и остальной прод-конфиг.
//
// ПРАВИЛО МАНДАТА: «не выполнил — не архивируй». Клиент не решает, выполнено ли
// задание, — он только исполняет команду. Решение остаётся за агентом.
//
// Использование:
//   node scripts/karman-prompts.mjs list
//   node scripts/karman-prompts.mjs list --archived
//   node scripts/karman-prompts.mjs archive <id>
//   node scripts/karman-prompts.mjs archive <id> --undo
//
// Коды возврата: 0 — ок; 1 — канал не настроен / адрес не задан / ошибка API.

import process from 'node:process'

const PROJECT = process.env.PROMPTS_PROJECT || 'GONBA'
const TOKEN = process.env.PROMPTS_TOKEN_GONBA
const BASE = (process.env.PROMPTS_API_URL || '').replace(/\/+$/, '')

const argv = process.argv.slice(2)
const command = argv[0] || 'list'

function fail(message, hint) {
  console.error(`[prompts] ОШИБКА: ${message}`)
  if (hint) console.error(`[prompts] ${hint}`)
  process.exit(1)
}

if (!BASE) {
  fail(
    'не задан PROMPTS_API_URL',
    'Адрес раздела живёт в env на боксу (например в /etc/gonba/gonba.env). В репозитории его нет намеренно.',
  )
}

if (!TOKEN) {
  fail(
    'не задан PROMPTS_TOKEN_GONBA',
    'Токен доезжает на бокс шагом доставки из комнаты КАРМАНА при деплое. Если его нет — канал ещё не выпущен (см. .github/workflows/karman-prompts-provision.yml).',
  )
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  })

  const body = await response.text()
  let parsed
  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    parsed = null
  }

  if (!response.ok) {
    const detail = parsed?.error || body?.slice(0, 200) || '(пустой ответ)'
    fail(
      `${options.method || 'GET'} ${path} → HTTP ${response.status}: ${detail}`,
      response.status === 503
        ? '503 = «канал промтов раздела не настроен»: токен есть не в той комнате, которую читает сервис. Проверь адресата по GET /api/secrets/self на боксе, отдающем /api/prompts/section.'
        : undefined,
    )
  }

  return parsed
}

// Ответ — массив промтов (возможно, под ключом `prompts`). Форма не зафиксирована
// контрактом, поэтому читаем терпимо: первый массив, который найдём.
function pickItems(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['prompts', 'items', 'data', 'section']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  return []
}

function isPlan(item) {
  const title = String(item?.title ?? item?.name ?? item?.subject ?? '')
  return title.trim().toLowerCase().startsWith('план:') || title.trim().toLowerCase().startsWith('план ')
}

function printItems(items) {
  if (items.length === 0) {
    console.log('[prompts] раздел пуст')
    return
  }
  for (const item of items) {
    const id = item?.id ?? '?'
    const title = String(item?.title ?? item?.name ?? item?.subject ?? '(без названия)')
    const archived = item?.archived === true || item?.archived_at != null
    const kind = isPlan(item) ? 'ПЛАН ' : 'ПРОМТ'
    console.log(`${kind} #${id}${archived ? ' [в архиве]' : ''} — ${title}`)
  }
}

if (command === 'list') {
  const withArchived = argv.includes('--archived')
  const query = withArchived ? `?project=${PROJECT}&archived=1` : `?project=${PROJECT}`
  const payload = await api(`/api/prompts/section${query}`)
  printItems(pickItems(payload))
} else if (command === 'archive') {
  const id = Number(argv[1])
  if (!Number.isInteger(id)) fail('нужен числовой id промта: archive <id>')
  const undo = argv.includes('--undo')
  const payload = await api('/api/prompts/section', {
    method: 'POST',
    body: JSON.stringify({ project: PROJECT, id, archived: !undo }),
  })
  console.log(
    payload?.ok === false
      ? `[prompts] отказ: ${payload?.error || 'без описания'}`
      : `[prompts] промт #${id} ${undo ? 'возвращён из архива' : 'отправлен в архив'}`,
  )
} else {
  fail(`неизвестная команда: ${command}`, 'доступно: list | archive <id> [--archived | --undo]')
}
