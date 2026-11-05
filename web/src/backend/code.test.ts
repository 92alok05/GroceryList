import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import { beforeEach, describe, expect, it } from 'vitest'

type Cell = string | number | boolean
type Json = Record<string, unknown>

class FakeSheet {
  rows: Cell[][] = []
  constructor(header: string[] = []) {
    if (header.length) this.rows.push(header)
  }
  getLastRow = () => this.rows.length
  getLastColumn = () => Math.max(0, ...this.rows.map((r) => r.length))
  getMaxRows = () => this.rows.length + 100
  getDataRange = () => ({ getValues: () => this.rows.map((r) => [...r]) })
  appendRow = (row: Cell[]) => void this.rows.push([...row])
  deleteRow = (n: number) => void this.rows.splice(n - 1, 1)
  getRange = (row: number, col: number, nrows = 1, ncols = 1) => ({
    getValues: () =>
      Array.from({ length: nrows }, (_, r) =>
        Array.from({ length: ncols }, (_, c) => this.rows[row - 1 + r]?.[col - 1 + c] ?? ''),
      ),
    setValues: (vals: Cell[][]) =>
      vals.forEach((vr, r) =>
        vr.forEach((v, c) => {
          this.rows[row - 1 + r] ??= []
          this.rows[row - 1 + r][col - 1 + c] = v
        }),
      ),
    setValue: (v: Cell) => {
      this.rows[row - 1] ??= []
      this.rows[row - 1][col - 1] = v
    },
    setNumberFormat: () => undefined,
  })
}

const ITEM_HEADER = ['id', 'name', 'recommendedStore', 'recommendedQuantity', 'cadence', 'customCadenceDays', 'isChecked', 'lastCheckedDate', 'updatedAt']

function loadBackend(source: string) {
  const sheets = new Map<string, FakeSheet>([['GroceryItems', new FakeSheet(ITEM_HEADER)]])
  const cache = new Map<string, string>()
  const props = new Map<string, string>()
  const bytesOf = (input: string | number[]) =>
    typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input.map((b) => b & 0xff))
  const ctx = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n: string) => sheets.get(n) ?? null,
        insertSheet: (n: string) => {
          const s = new FakeSheet()
          sheets.set(n, s)
          return s
        },
      }),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_a: string, input: string | number[]) =>
        Array.from(createHash('sha256').update(bytesOf(input)).digest()).map((b) => (b > 127 ? b - 256 : b)),
      newBlob: (s: string) => ({ getBytes: () => Array.from(Buffer.from(s, 'utf8')).map((b) => (b > 127 ? b - 256 : b)) }),
      getUuid: () => randomUUID(),
    },
    CacheService: {
      getScriptCache: () => ({ get: (k: string) => cache.get(k) ?? null, put: (k: string, v: string) => void cache.set(k, v) }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => void props.set(k, v) }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: (text: string) => ({ setMimeType: () => ({ getContent: () => text }) }),
    },
    Logger: { log: () => undefined },
  })
  vm.runInContext(source, ctx)
  const post = (body: Json): Json =>
    JSON.parse((ctx.doPost({ postData: { contents: JSON.stringify(body) } }) as { getContent(): string }).getContent())
  const get = (parameter: Json): Json =>
    JSON.parse((ctx.doGet({ parameter }) as { getContent(): string }).getContent())
  return { ctx, sheets, cache, post, get }
}

const SOURCE = readFileSync(resolve(process.cwd(), '../AppsScript/Code.gs'), 'utf8')
const PASS = 'Fresh&Milk42'

const item = (id: string, over: Json = {}) => ({
  id,
  name: 'Milk',
  recommendedStore: 'Safeway',
  recommendedQuantity: '1',
  cadence: 'Weekly',
  customCadenceDays: 7,
  isChecked: false,
  lastCheckedDate: null,
  updatedAt: '2026-03-01T10:00:00.000Z',
  ...over,
})

let backend: ReturnType<typeof loadBackend>
const create = (name = 'The Joshis', passcode = PASS) => backend.post({ action: 'createHousehold', name, passcode })
const join = (name: string, passcode: string) => backend.post({ action: 'joinHousehold', name, passcode })

beforeEach(() => {
  backend = loadBackend(SOURCE)
  backend.ctx.setupSheets()
})

describe('household creation', () => {
  it('returns a device token and never stores the passcode or token in plaintext', () => {
    const res = create()
    expect(res.deviceToken).toMatch(/^[0-9a-f]{128}$/)
    const dump = JSON.stringify([...backend.sheets.values()].map((s) => s.rows))
    expect(dump).not.toContain(PASS)
    expect(dump).not.toContain(res.deviceToken as string)
  })

  it.each([
    ['too short', 'Ab1!'],
    ['no number', 'Fresh&Milk!!'],
    ['no special character', 'FreshMilk42'],
    ['no letter', '12345678!!'],
  ])('rejects a passcode that is %s', (_label, passcode) => {
    expect(create('Home', passcode).error).toMatch(/passcode must be/)
  })

  it('rejects duplicate names case-insensitively', () => {
    create('The Joshis')
    expect(create('  the   JOSHIS ').error).toMatch(/already taken/)
  })
})

describe('joining', () => {
  it('lets a second device join by name and passcode, ignoring name case', () => {
    create()
    const res = join('the joshis', PASS)
    expect(res).toMatchObject({ householdName: 'The Joshis' })
    expect(res.deviceToken).toBeTruthy()
  })

  it('gives the same error for a wrong passcode and an unknown household', () => {
    create()
    expect(join('The Joshis', 'Wrong&Pass1').error).toBe('invalid household name or passcode')
    expect(join('Nobody Home', PASS).error).toBe('invalid household name or passcode')
  })

  it('locks the household after 5 wrong passcodes, even for the right one', () => {
    create()
    for (let i = 0; i < 5; i++) join('The Joshis', 'Wrong&Pass1')
    expect(join('The Joshis', PASS).error).toMatch(/too many attempts/)
  })
})

describe('data isolation', () => {
  it('keeps items private to a household and blocks cross-household overwrites and deletes', () => {
    const a = create('Alpha Home').deviceToken
    const b = create('Beta Home', 'Other&Pass99').deviceToken
    expect(backend.post({ action: 'upsert', token: a, item: item('X1') })).toEqual({ success: true })

    expect((backend.post({ action: 'list', token: b }).items as unknown[]).length).toBe(0)
    expect(backend.post({ action: 'upsert', token: b, item: item('X1', { name: 'Hijack' }) }).error).toBe('conflict')
    backend.post({ action: 'delete', token: b, id: 'X1' })

    const listed = backend.post({ action: 'list', token: a }).items as Json[]
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ id: 'X1', name: 'Milk', isChecked: false })
  })

  it('updates an existing item in place and deletes it', () => {
    const t = create().deviceToken
    backend.post({ action: 'upsert', token: t, item: item('X1') })
    backend.post({ action: 'upsert', token: t, item: item('X1', { name: 'Oat milk', isChecked: true }) })
    let listed = backend.post({ action: 'list', token: t }).items as Json[]
    expect(listed).toMatchObject([{ name: 'Oat milk', isChecked: true }])
    backend.post({ action: 'delete', token: t, id: 'X1' })
    listed = backend.post({ action: 'list', token: t }).items as Json[]
    expect(listed).toHaveLength(0)
  })

  it('rejects missing and bogus tokens', () => {
    expect(backend.post({ action: 'list' }).error).toBe('unauthorized')
    expect(backend.post({ action: 'list', token: 'x'.repeat(64) }).error).toBe('unauthorized')
  })
})

describe('leaving', () => {
  it('revokes the device token', () => {
    const t = create().deviceToken
    expect(backend.post({ action: 'leave', token: t })).toEqual({ success: true })
    expect(backend.post({ action: 'list', token: t }).error).toBe('unauthorized')
  })
})

describe('legacy migration', () => {
  it('stamps unowned rows and keeps the legacy secret working for the chosen household', () => {
    const legacy = loadBackend(SOURCE.replace("const LEGACY_SECRET = ''", "const LEGACY_SECRET = 'old-shared-secret'"))
    legacy.ctx.setupSheets()
    legacy.sheets.get('GroceryItems')!.rows.push(['L1', 'Eggs', 'Costco', '1', 'Weekly', 7, false, '', '2026-03-01T10:00:00.000Z'])
    expect(legacy.get({ action: 'list', token: 'old-shared-secret' }).error).toBe('unauthorized')

    const token = legacy.post({ action: 'createHousehold', name: 'Family', passcode: PASS }).deviceToken
    legacy.ctx.adoptLegacyRows('family')

    expect(legacy.post({ action: 'list', token }).items).toMatchObject([{ id: 'L1', name: 'Eggs' }])
    expect(legacy.get({ action: 'list', token: 'old-shared-secret' }).items).toMatchObject([{ id: 'L1' }])
    expect(legacy.post({ action: 'upsert', token: 'old-shared-secret', item: item('L2') })).toEqual({ success: true })
    expect((legacy.post({ action: 'list', token }).items as unknown[]).length).toBe(2)
  })

  it('is disabled when LEGACY_SECRET is empty', () => {
    expect(backend.get({ action: 'list', token: '' })).toEqual({ ok: true })
  })
})
