import type { GroceryItem } from '../domain/item'
import { fromRemote, parseRemoteDate, type RemoteItem } from './remote'

export interface SyncPlan {
  /** New local list after pulling remote changes. */
  items: GroceryItem[]
  /** Ids of local items that must be pushed to the sheet. */
  toPush: string[]
}

/**
 * Two-way merge identical to `SheetSyncService.syncAll`:
 * - remote newer  → remote wins; local newer → push; equal → nothing
 * - previously synced but missing remotely → deleted elsewhere, drop locally
 * - never synced → push
 * - remote-only → insert
 */
export function planSync(local: GroceryItem[], remote: RemoteItem[], now: number): SyncPlan {
  const remoteById = new Map(remote.map((r) => [r.id, r]))
  const localIds = new Set(local.map((i) => i.id))
  const items: GroceryItem[] = []
  const toPush: string[] = []

  for (const item of local) {
    const r = remoteById.get(item.id)
    if (r) {
      const remoteUpdatedAt = parseRemoteDate(r.updatedAt) ?? Number.NEGATIVE_INFINITY
      if (remoteUpdatedAt > item.updatedAt) {
        items.push({ ...fromRemote(r, now), isSyncedToRemote: true })
      } else {
        if (item.updatedAt > remoteUpdatedAt) toPush.push(item.id)
        items.push(item.isSyncedToRemote ? item : { ...item, isSyncedToRemote: true })
      }
    } else if (item.isSyncedToRemote) {
      continue
    } else {
      toPush.push(item.id)
      items.push(item)
    }
  }

  for (const r of remote) {
    if (!localIds.has(r.id)) items.push(fromRemote(r, now))
  }
  return { items, toPush }
}
