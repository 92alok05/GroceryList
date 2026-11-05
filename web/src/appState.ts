import type { GroceryItem } from './domain/item'
import { newItem } from './domain/item'
import { refreshDueItems, snoozeItem, toggleItem } from './domain/status'
import { createItemStore } from './storage/itemStore'
import { createSettingsStore, createTutorialStore } from './storage/settings'
import { createSyncService } from './sync/syncService'

export const itemStore = createItemStore(window.localStorage)
export const settingsStore = createSettingsStore(window.localStorage)
export const tutorialStore = createTutorialStore(window.localStorage)
export const sync = createSyncService({ items: itemStore, settings: settingsStore })

function mutate(id: string, fn: (item: GroceryItem) => GroceryItem) {
  const current = itemStore.get().find((i) => i.id === id)
  if (!current) return
  const next = fn(current)
  if (next === current) return
  itemStore.set((list) => list.map((i) => (i.id === id ? next : i)))
  sync.pushItemInBackground(next)
}

export const actions = {
  toggle: (id: string) => mutate(id, (i) => toggleItem(i, Date.now())),
  snooze: (id: string) => mutate(id, (i) => snoozeItem(i, Date.now())),

  remove(id: string) {
    sync.pushDeletionInBackground(id)
    itemStore.set((list) => list.filter((i) => i.id !== id))
  },

  /** Adds a new item, or edits an existing one when `id` is given. */
  save(
    fields: Pick<GroceryItem, 'name' | 'recommendedStore' | 'recommendedQuantity' | 'cadence' | 'customCadenceDays'>,
    id?: string,
  ) {
    if (id) {
      mutate(id, (i) => ({ ...i, ...fields, updatedAt: Date.now() }))
      return
    }
    const created = newItem(fields, Date.now())
    itemStore.set((list) => [...list, created])
    sync.pushItemInBackground(created)
  },

  refreshCadence() {
    itemStore.set((list) => refreshDueItems(list, Date.now()))
  },
}

/** Runs on launch and whenever the app returns to the foreground (iOS `scenePhase == .active`). */
export function onForeground() {
  actions.refreshCadence()
  void sync.syncAll()
}
