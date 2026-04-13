#!/usr/bin/env node

import { spawn } from 'node:child_process'

const args = process.argv.slice(2)

const parseNumberArg = (name, fallback) => {
  const prefix = `${name}=`
  const found = args.find((arg) => arg.startsWith(prefix))
  if (!found) return fallback
  const value = Number(found.slice(prefix.length))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const splitIndex = args.indexOf('--')
if (splitIndex === -1 || splitIndex === args.length - 1) {
  console.error(
    'Usage: node scripts/run-with-watchdog.mjs [--idle-ms=N] [--stagnation-ms=N] [--max-ms=N] -- <command> [args...]',
  )
  process.exit(2)
}

const commandArgs = args.slice(splitIndex + 1)
const idleMs = parseNumberArg('--idle-ms', 120000)
const stagnationMs = parseNumberArg('--stagnation-ms', 180000)
const maxMs = parseNumberArg('--max-ms', 900000)

let lastOutputAt = Date.now()
let lastProgressAt = Date.now()
let lastNormalizedLine = ''
const startedAt = Date.now()
let finished = false

const stripAnsi = (value) => value.replace(/\x1b\[[0-9;]*m/g, '')

const normalizeLine = (line) => {
  const withoutAnsi = stripAnsi(line)
  return withoutAnsi
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/[⣷⣯⣟⡿⢿⣻⣽✓]/g, '')
    .trim()
}

const child = spawn(commandArgs[0], commandArgs.slice(1), {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
})

const handleChunk = (chunk, write) => {
  const text = chunk.toString()
  write(text)
  lastOutputAt = Date.now()
  const lines = text.split(/\r?\n/)
  for (const line of lines) {
    const normalized = normalizeLine(line)
    if (!normalized) continue
    if (normalized !== lastNormalizedLine) {
      lastNormalizedLine = normalized
      lastProgressAt = Date.now()
    }
  }
}

child.stdout.on('data', (chunk) => handleChunk(chunk, (text) => process.stdout.write(text)))
child.stderr.on('data', (chunk) => handleChunk(chunk, (text) => process.stderr.write(text)))

const stop = (reason, code = 124) => {
  if (finished) return
  finished = true
  console.error(`\n[watchdog] ${reason}`)
  child.kill('SIGTERM')
  setTimeout(() => child.kill('SIGKILL'), 5000).unref()
  process.exit(code)
}

const timer = setInterval(() => {
  const now = Date.now()
  if (now - startedAt > maxMs) {
    stop(`max execution time exceeded (${maxMs}ms)`)
    return
  }
  if (now - lastOutputAt > idleMs) {
    stop(`no output for ${idleMs}ms`)
    return
  }
  if (now - lastProgressAt > stagnationMs) {
    stop(`stagnation detected for ${stagnationMs}ms (same output pattern)`)
  }
}, 5000)

child.on('exit', (code, signal) => {
  clearInterval(timer)
  if (finished) return
  finished = true
  if (signal) {
    process.exit(1)
  }
  process.exit(code ?? 1)
})
