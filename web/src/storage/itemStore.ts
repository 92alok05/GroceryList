import { parseCadence } from '../domain/cadence'
import type { GroceryItem } from '../domain/item'
import { createStore, type Store } from './store'

export const ITEMS_KEY = 'groceryList.items'
export const ITEMS_SCHEMA_VERSION = 1

interface Persisted {
  version: number
  items: unknown[]
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Returns a valid item or `null` when the persisted record is unusable. */
export function sanitizeItem(raw: unknown): GroceryItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  const name = str(r.name)
  const store = str(r.recommendedStore)
  const updatedAt = num(r.updatedAt)
  if (!id || name === null || store === null || updatedAt === null) return null
  return {
    id,
    name,
    recommendedStore: store,
    recommendedQuantity: str(r.recommendedQuantity) ?? '1',
    cadence: parseCadence(str(r.cadence) ?? ''),
    customCadenceDays: num(r.customCadenceDays) ?? 7,
    isChecked: r.isChecked === true,
    lastCheckedDate: num(r.lastCheckedDate),
    updatedAt,
    isSyncedToRemote: r.isSyncedToRemote === true,
  }
}

/**
 * Loads persisted items. If the payload is unreadable or from an unknown schema
 * version the local copy is reset instead of crashing (the web equivalent of the
 * iOS "self-healing store"); the shared sheet repopulates it on the next sync.
 */
export function loadItems(storage: Storage): GroceryItem[] {
  const raw = storage.getItem(ITEMS_KEY)
  if (raw === null) return []
  try {
    const parsed = JSON.parse(raw) as Persisted
    if (parsed?.version !== ITEMS_SCHEMA_VERSION || !Array.isArray(parsed.items)) {
      throw new Error('unsupported schema')
    }
    return parsed.items.map(sanitizeItem).filter((i): i is GroceryItem => i !== null)
  } catch (error) {
    console.warn('Could not load stored items, resetting local store:', error)
    storage.removeItem(ITEMS_KEY)
    return []
  }
}

export function createItemStore(storage: Storage): Store<GroceryItem[]> {
  return createStore(loadItems(storage), (items) => {
    try {
      storage.setItem(ITEMS_KEY, JSON.stringify({ version: ITEMS_SCHEMA_VERSION, items }))
    } catch (error) {
      console.error('Failed to persist items:', error)
    }
  })
}
