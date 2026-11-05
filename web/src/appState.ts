import type { GroceryItem } from './domain/item'
import { newItem } from './domain/item'
import { refreshDueItems, snoozeItem, toggleItem } from './domain/status'
import { createItemStore } from './storage/itemStore'
import { createSettingsStore, createTutorialStore } from './storage/settings'
import { createHouseholdApi, createSheetClient, type HouseholdSession } from './sync/sheetClient'
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

function startSession(session: HouseholdSession) {
  settingsStore.set((s) => ({
    ...s,
    deviceToken: session.deviceToken,
    householdName: session.householdName,
    lastSyncedAt: null,
    lastSyncError: null,
  }))
  void sync.syncAll()
}

export const household = {
  /** Creating keeps this device's items and uploads them to the new household. */
  async create(name: string, passcode: string) {
    const session = await createHouseholdApi(settingsStore.get().webAppURL).create(name, passcode)
    itemStore.set((list) => list.map((i) => ({ ...i, isSyncedToRemote: false })))
    startSession(session)
  },

  /** Joining starts from the household's data, so leftover local items are discarded. */
  async join(name: string, passcode: string) {
    const session = await createHouseholdApi(settingsStore.get().webAppURL).join(name, passcode)
    itemStore.set([])
    startSession(session)
  },

  async leave() {
    try {
      await createSheetClient(settingsStore.get()).leave()
    } catch {
      // Offline: the token is still dropped locally; the server-side session can be revoked later.
    }
    itemStore.set([])
    settingsStore.set((s) => ({ ...s, deviceToken: '', householdName: '', lastSyncedAt: null, lastSyncError: null }))
  },
}

/** Runs on launch and whenever the app returns to the foreground (iOS `scenePhase == .active`). */
export function onForeground() {
  actions.refreshCadence()
  void sync.syncAll()
}
