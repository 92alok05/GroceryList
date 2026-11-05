import type { RepeatCadence } from './cadence'

/** Mirrors the SwiftData `GroceryItem` model. Timestamps are epoch milliseconds. */
export interface GroceryItem {
  id: string
  name: string
  recommendedStore: string
  recommendedQuantity: string
  cadence: RepeatCadence
  customCadenceDays: number
  isChecked: boolean
  lastCheckedDate: number | null
  updatedAt: number
  /** True once pushed to / pulled from the remote sheet at least once. */
  isSyncedToRemote: boolean
}

export function newItem(
  fields: Pick<GroceryItem, 'name' | 'recommendedStore'> &
    Partial<Omit<GroceryItem, 'name' | 'recommendedStore'>>,
  now: number,
): GroceryItem {
  return {
    id: crypto.randomUUID().toUpperCase(),
    recommendedQuantity: '1',
    cadence: 'One Time',
    customCadenceDays: 7,
    isChecked: false,
    lastCheckedDate: null,
    updatedAt: now,
    isSyncedToRemote: false,
    ...fields,
  }
}
