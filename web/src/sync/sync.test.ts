import { describe, expect, it, vi } from 'vitest'
import { newItem, type GroceryItem } from '../domain/item'
import { createItemStore, ITEMS_KEY, loadItems } from '../storage/itemStore'
import { createSettingsStore } from '../storage/settings'
import { planSync } from './merge'
import { toRemote, type RemoteItem } from './remote'
import { createSheetClient, type SheetClient } from './sheetClient'
import { createSyncService } from './syncService'

const T = Date.parse('2026-03-01T10:00:00.000Z')

const local = (o: Partial<GroceryItem> = {}): GroceryItem => ({
  ...newItem({ name: 'Milk', recommendedStore: 'Safeway' }, T),
  id: 'A',
  ...o,
})
const remote = (o: Partial<RemoteItem> = {}): RemoteItem => ({
  ...toRemote(local({ isSyncedToRemote: true })),
  ...o,
})
const iso = (ms: number) => new Date(ms).toISOString()

describe('planSync', () => {
  it('applies a newer remote copy', () => {
    const plan = planSync([local({ isSyncedToRemote: true })], [remote({ name: 'Oat milk', updatedAt: iso(T + 1000) })], T)
    expect(plan.items[0]).toMatchObject({ name: 'Oat milk', updatedAt: T + 1000, isSyncedToRemote: true })
    expect(plan.toPush).toEqual([])
  })

  it('pushes a newer local copy and does nothing when equal', () => {
    expect(planSync([local({ updatedAt: T + 5 })], [remote()], T).toPush).toEqual(['A'])
    const equal = planSync([local()], [remote()], T)
    expect(equal.toPush).toEqual([])
    expect(equal.items[0].isSyncedToRemote).toBe(true)
  })

  it('drops previously-synced items missing remotely, pushes never-synced ones', () => {
    const gone = local({ id: 'X', isSyncedToRemote: true })
    const fresh = local({ id: 'Y', isSyncedToRemote: false })
    const plan = planSync([gone, fresh], [], T)
    expect(plan.items.map((i) => i.id)).toEqual(['Y'])
    expect(plan.toPush).toEqual(['Y'])
  })

  it('inserts remote-only items as synced', () => {
    const plan = planSync([], [remote({ id: 'Z', cadence: 'Weekly' })], T)
    expect(plan.items[0]).toMatchObject({ id: 'Z', cadence: 'Weekly', isSyncedToRemote: true })
  })

  it('treats an unparsable remote timestamp as oldest (local wins and is pushed)', () => {
    expect(planSync([local()], [remote({ updatedAt: 'garbage' })], T).toPush).toEqual(['A'])
  })

  it('round-trips ISO timestamps', () => {
    const r = toRemote(local({ lastCheckedDate: T }))
    expect(r.updatedAt).toBe('2026-03-01T10:00:00.000Z')
    expect(r.lastCheckedDate).toBe('2026-03-01T10:00:00.000Z')
  })
})

function json(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body)))
}

describe('sheetClient', () => {
  const cfg = { webAppURL: 'https://script.google.com/macros/s/x/exec', sharedSecret: 's3cret' }

  it('lists via GET with action and token and coerces Sheets types', async () => {
    const fetchImpl = vi.fn(() =>
      json({ items: [{ id: 'A', name: 'Eggs', recommendedStore: 'S', recommendedQuantity: 18, cadence: 'Weekly', customCadenceDays: 1, isChecked: 'TRUE', lastCheckedDate: null, updatedAt: iso(T) }, null] }),
    )
    const items = await createSheetClient(cfg, fetchImpl as unknown as typeof fetch).fetchAll()
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0])
    expect(url).toContain('action=list')
    expect(url).toContain('token=s3cret')
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ recommendedQuantity: '18', isChecked: true })
  })

  it('posts as text/plain (no CORS preflight) with the token in the body', async () => {
    const fetchImpl = vi.fn((_u: unknown, _i?: RequestInit) => json({ success: true }))
    await createSheetClient(cfg, fetchImpl as unknown as typeof fetch).remove('A')
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Content-Type']).toMatch(/^text\/plain/)
    expect(JSON.parse(init.body as string)).toEqual({ action: 'delete', id: 'A', token: 's3cret' })
  })

  it('surfaces server errors and refuses non-https URLs', async () => {
    const bad = vi.fn(() => json({ error: 'unauthorized' }))
    await expect(createSheetClient(cfg, bad as unknown as typeof fetch).fetchAll()).rejects.toThrow('Server error: unauthorized')
    const never = vi.fn()
    await expect(
      createSheetClient({ ...cfg, webAppURL: 'http://example.com' }, never as unknown as typeof fetch).fetchAll(),
    ).rejects.toThrow('https')
    expect(never).not.toHaveBeenCalled()
  })
})

describe('syncService', () => {
  function setup(client: Partial<SheetClient>) {
    const items = createItemStore(new MemoryStorage())
    const settings = createSettingsStore(new MemoryStorage())
    settings.set((s) => ({ ...s, webAppURL: 'https://x', sharedSecret: 'k' }))
    const service = createSyncService({
      items,
      settings,
      clientFactory: () => client as SheetClient,
      now: () => T,
    })
    return { items, settings, service }
  }

  it('reports not configured', async () => {
    const items = createItemStore(new MemoryStorage())
    const settings = createSettingsStore(new MemoryStorage())
    await createSyncService({ items, settings }).syncAll()
    expect(settings.get().lastSyncError).toMatch(/isn't configured/)
  })

  it('pulls, pushes unsynced items and records lastSyncedAt', async () => {
    const upsert = vi.fn(async () => {})
    const { items, settings, service } = setup({ fetchAll: async () => [remote({ id: 'R' })], upsert })
    items.set([local({ id: 'L' })])
    await service.syncAll()
    expect(items.get().map((i) => i.id).sort()).toEqual(['L', 'R'])
    expect(items.get().every((i) => i.isSyncedToRemote)).toBe(true)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(settings.get()).toMatchObject({ lastSyncedAt: T, lastSyncError: null })
  })

  it('records transport errors without losing local data', async () => {
    const { items, settings, service } = setup({
      fetchAll: async () => {
        throw new Error('offline')
      },
    })
    items.set([local()])
    await service.syncAll()
    expect(settings.get().lastSyncError).toBe('offline')
    expect(items.get()).toHaveLength(1)
  })
})

class MemoryStorage implements Storage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.get(k) ?? null }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) { this.m.set(k, v) }
}

describe('item persistence', () => {
  it('round-trips items', () => {
    const storage = new MemoryStorage()
    const store = createItemStore(storage)
    store.set([local({ lastCheckedDate: T, cadence: 'Weekly' })])
    expect(loadItems(storage)).toEqual(store.get())
  })

  it('resets corrupt or unknown-version data instead of crashing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const s1 = new MemoryStorage()
    s1.setItem(ITEMS_KEY, '{not json')
    expect(loadItems(s1)).toEqual([])
    expect(s1.getItem(ITEMS_KEY)).toBeNull()
    const s2 = new MemoryStorage()
    s2.setItem(ITEMS_KEY, JSON.stringify({ version: 99, items: [] }))
    expect(loadItems(s2)).toEqual([])
    warn.mockRestore()
  })

  it('skips malformed records but keeps valid ones', () => {
    const s = new MemoryStorage()
    s.setItem(ITEMS_KEY, JSON.stringify({ version: 1, items: [{ id: 1 }, { ...local(), cadence: 'bogus' }] }))
    const items = loadItems(s)
    expect(items).toHaveLength(1)
    expect(items[0].cadence).toBe('One Time')
  })
})
