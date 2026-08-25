import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

// Импортируем ИМЕННО тот файл, который поедет на бокс, а не его копию.
import { mergeEnvLines, writeEnvAtomically } from '../../../scripts/merge-env-from-vault.mjs'

const SCRIPT = join(__dirname, '..', '..', '..', 'scripts', 'merge-env-from-vault.mjs')

const ENV_FIXTURE = [
  '# конфиг прода',
  'DATABASE_URL=postgres://u:p@h/db',
  'PAYLOAD_SECRET=old-secret',
  '',
  '# аналитика',
  'YM_COUNTER_ID=111457955',
  'IP_HASH_SALT=deadbeef',
].join('\n')

let dir: string
let envPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gonba-env-'))
  envPath = join(dir, 'gonba.env')
  writeFileSync(envPath, ENV_FIXTURE + '\n', 'utf8')
})

describe('mergeEnvLines — слияние, а не перезапись', () => {
  const lines = () => readFileSync(envPath, 'utf8').split('\n')

  it('добавляет новый ключ, не трогая заведённые руками и комментарии', () => {
    const r = mergeEnvLines(lines(), { DEEPSEEK_API_KEY: 'sk-xxx' })

    expect(r.added).toEqual(['DEEPSEEK_API_KEY'])
    expect(r.updated).toEqual([])
    expect(r.lines).toContain('DEEPSEEK_API_KEY=sk-xxx')
    // Ради этого инварианта всё и затевалось: ключи, которых нет в комнате,
    // обязаны пережить доставку.
    expect(r.lines).toContain('IP_HASH_SALT=deadbeef')
    expect(r.lines).toContain('YM_COUNTER_ID=111457955')
    expect(r.lines).toContain('# аналитика')
  })

  it('обновляет существующий ключ на месте, без дубля', () => {
    const r = mergeEnvLines(lines(), { PAYLOAD_SECRET: 'new-secret' })

    expect(r.updated).toEqual(['PAYLOAD_SECRET'])
    expect(r.added).toEqual([])
    expect(r.lines.filter((l: string) => l.startsWith('PAYLOAD_SECRET='))).toEqual(['PAYLOAD_SECRET=new-secret'])
  })

  it('совпадающее значение не считается изменением', () => {
    const r = mergeEnvLines(lines(), { IP_HASH_SALT: 'deadbeef' })

    expect(r.changed).toBe(false)
    // Файл читается вместе с завершающим переводом строки, поэтому split даёт
    // хвостовой пустой элемент — сравниваем с тем же представлением.
    expect(r.lines).toEqual((ENV_FIXTURE + '\n').split('\n'))
  })

  it('пустая комната ничего не меняет', () => {
    expect(mergeEnvLines(lines(), {}).changed).toBe(false)
  })

  it('значение со знаком =, кавычками и решёткой пишется как есть', () => {
    const tricky = 'a=b c#d$e"f\'g'
    const r = mergeEnvLines(lines(), { DEEPSEEK_API_KEY: tricky })

    expect(r.lines).toContain(`DEEPSEEK_API_KEY=${tricky}`)
  })

  it('ключ, похожий на присваивание внутри комментария, не подменяется', () => {
    const r = mergeEnvLines(['# PAYLOAD_SECRET=подсказка', 'PAYLOAD_SECRET=real'], { PAYLOAD_SECRET: 'new' })

    expect(r.lines[0]).toBe('# PAYLOAD_SECRET=подсказка')
    expect(r.lines[1]).toBe('PAYLOAD_SECRET=new')
  })
})

describe('writeEnvAtomically', () => {
  it('сохраняет права файла', () => {
    chmodSync(envPath, 0o640)
    const before = statSync(envPath).mode & 0o777

    writeEnvAtomically(envPath, ['A=1'])

    expect(statSync(envPath).mode & 0o777).toBe(before)
    expect(readFileSync(envPath, 'utf8')).toBe('A=1\n')
  })

  /**
   * Регресс на боевую поломку 2026-08-25. Первая доставка сменила владельца
   * `/etc/gonba/gonba.env` с `root:valstan` на `root:root`: при переписывании
   * слияния с Python на Node сохранение ПРАВ переехало, а сохранение ВЛАДЕЛЬЦА
   * нет. Сервис не упал — systemd читает EnvironmentFile от root, — поэтому
   * поломка была безмолвной, а инвариант записан в deploy/systemd/gonba.service.
   */
  it.skipIf(process.platform === 'win32')('сохраняет владельца и группу файла', () => {
    const before = statSync(envPath)

    writeEnvAtomically(envPath, ['A=1'])

    const after = statSync(envPath)
    expect(after.uid).toBe(before.uid)
    expect(after.gid).toBe(before.gid)
  })
})

/**
 * Регресс на боевой отказ 2026-08-25: первая версия слияния была heredoc'ом
 * (`python3 - "$ENV_FILE" <<'PY'`), и JSON с секретами конкурировал со stdin,
 * из которого читалась сама программа. Прогон на фикстурах этого не поймал,
 * потому что извлекал код в отдельный файл — то есть проверял логику, но не
 * проводку. Этот кейс запускает РОВНО ту команду, что стоит в шелл-скрипте.
 */
describe('CLI — та самая команда, что зовёт pull-secrets-from-vault.sh', () => {
  it('читает JSON со stdin и вливает секреты в файл', () => {
    const stdout = execFileSync(process.execPath, [SCRIPT, envPath], {
      input: JSON.stringify({ secrets: { DEEPSEEK_API_KEY: 'sk-live' } }),
      encoding: 'utf8',
    })

    expect(readFileSync(envPath, 'utf8')).toContain('DEEPSEEK_API_KEY=sk-live')
    expect(readFileSync(envPath, 'utf8')).toContain('IP_HASH_SALT=deadbeef')
    expect(stdout).toContain('добавлено: DEEPSEEK_API_KEY')
  })

  it('не печатает значения секретов в вывод', () => {
    const stdout = execFileSync(process.execPath, [SCRIPT, envPath], {
      input: JSON.stringify({ secrets: { DEEPSEEK_API_KEY: 'СУПЕРСЕКРЕТ' } }),
      encoding: 'utf8',
    })

    expect(stdout).not.toContain('СУПЕРСЕКРЕТ')
    expect(stdout).toContain('DEEPSEEK_API_KEY')
  })

  it('на совпадающем содержимом сообщает, что файл не тронут', () => {
    const stdout = execFileSync(process.execPath, [SCRIPT, envPath], {
      input: JSON.stringify({ secrets: { IP_HASH_SALT: 'deadbeef' } }),
      encoding: 'utf8',
    })

    expect(stdout).toContain('файл не тронут')
    expect(readFileSync(envPath, 'utf8')).toBe(ENV_FIXTURE + '\n')
  })
})
