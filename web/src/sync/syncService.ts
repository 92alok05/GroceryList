import type { GroceryItem } from '../domain/item'
import { isConfigured, type SyncSettings } from '../storage/settings'
import type { Store } from '../storage/store'
import { planSync } from './merge'
import { createSheetClient, NOT_CONFIGURED_MESSAGE, SyncError, type SheetClient } from './sheetClient'

export interface SyncDeps {
  items: Store<GroceryItem[]>
  settings: Store<SyncSettings>
  clientFactory?: (config: SyncSettings) => SheetClient
  now?: () => number
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createSyncService(deps: SyncDeps) {
  const { items, settings } = deps
  const makeClient = deps.clientFactory ?? ((c: SyncSettings) => createSheetClient(c))
  const now = deps.now ?? Date.now
  const setError = (lastSyncError: string | null) => settings.set((s) => ({ ...s, lastSyncError }))

  /** Records a failure; a rejected token means this device was removed, so drop the session. */
  const fail = (error: unknown, prefix = '') => {
    if (error instanceof SyncError && error.kind === 'unauthorized') {
      settings.set((s) => ({ ...s, deviceToken: '', householdName: '', lastSyncError: error.message }))
      return
    }
    setError(prefix + messageOf(error))
  }

  const markSynced = (id: string) =>
    items.set((list) => list.map((i) => (i.id === id && !i.isSyncedToRemote ? { ...i, isSyncedToRemote: true } : i)))

  /** Full two-way sync. Errors are recorded in settings, never thrown. */
  async function syncAll(): Promise<void> {
    if (!isConfigured(settings.get())) {
      setError(NOT_CONFIGURED_MESSAGE)
      return
    }
    try {
      const client = makeClient(settings.get())
      const remote = await client.fetchAll()
      // Plan against the list as it is *after* the network call so edits made meanwhile are kept.
      const plan = planSync(items.get(), remote, now())
      items.set(plan.items)
      for (const id of plan.toPush) {
        const item = items.get().find((i) => i.id === id)
        if (!item) continue
        await client.upsert(item)
        markSynced(id)
      }
      settings.set((s) => ({ ...s, lastSyncedAt: now(), lastSyncError: null }))
    } catch (error) {
      fail(error)
    }
  }

  /** Fire-and-forget push after a local edit; failures are only recorded. */
  function pushItemInBackground(item: GroceryItem): void {
    if (!isConfigured(settings.get())) return
    void (async () => {
      try {
        await makeClient(settings.get()).upsert(item)
        markSynced(item.id)
      } catch (error) {
        fail(error, `Failed to sync item ${item.id}: `)
      }
    })()
  }

  function pushDeletionInBackground(id: string): void {
    if (!isConfigured(settings.get())) return
    void (async () => {
      try {
        await makeClient(settings.get()).remove(id)
      } catch (error) {
        fail(error, 'Failed to sync deletion: ')
      }
    })()
  }

  return { syncAll, pushItemInBackground, pushDeletionInBackground }
}

export type SyncService = ReturnType<typeof createSyncService>
