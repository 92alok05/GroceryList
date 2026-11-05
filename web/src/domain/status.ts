import { addDays, addHours, cadenceDays } from './cadence'
import type { GroceryItem } from './item'

/** At-a-glance status that drives the icon and tap behaviour. */
export type ItemStatus = 'needed' | 'dueSoon' | 'bought'

/** When the item next needs repurchasing; `null` for One Time or never-checked items. */
export function nextDueDate(item: GroceryItem): number | null {
  if (item.lastCheckedDate === null) return null
  const days = cadenceDays(item.cadence, item.customCadenceDays)
  if (days === null) return null
  return addDays(item.lastCheckedDate, days)
}

export function isDueForRefresh(item: GroceryItem, now: number): boolean {
  if (!item.isChecked || item.lastCheckedDate === null) return false
  const due = nextDueDate(item)
  return due !== null && now >= due
}

export function itemStatus(item: GroceryItem, now: number): ItemStatus {
  if (!item.isChecked) return 'needed'
  const days = cadenceDays(item.cadence, item.customCadenceDays)
  const due = nextDueDate(item)
  if (days === null || due === null) return 'bought'
  if (now >= due) return 'needed'
  // "Due Soon" = the last 25% of the cadence length (minimum 0.25 day) before it is due.
  const bufferDays = Math.max(days * 0.25, 0.25)
  const dueSoonStart = addHours(due, -Math.trunc(bufferDays * 24))
  return now >= dueSoonStart ? 'dueSoon' : 'bought'
}

/** Tap on the status icon: Needed/Due Soon → Bought (clock reset); Bought → Needed. */
export function toggleItem(item: GroceryItem, now: number): GroceryItem {
  const checking = itemStatus(item, now) !== 'bought'
  return {
    ...item,
    isChecked: checking,
    lastCheckedDate: checking ? now : null,
    updatedAt: now,
  }
}

/** "Extend": push the next due date out by one more cadence length without re-buying. */
export function snoozeItem(item: GroceryItem, now: number): GroceryItem {
  const days = cadenceDays(item.cadence, item.customCadenceDays)
  if (days === null || item.lastCheckedDate === null) return item
  return { ...item, lastCheckedDate: addDays(item.lastCheckedDate, days), updatedAt: now }
}

/**
 * Auto-uncheck items whose cadence has fully elapsed. Like the iOS service this
 * deliberately does not bump `updatedAt` (local-only change).
 */
export function refreshDueItems(items: GroceryItem[], now: number): GroceryItem[] {
  let changed = false
  const result = items.map((item) => {
    if (!isDueForRefresh(item, now)) return item
    changed = true
    return { ...item, isChecked: false, lastCheckedDate: null }
  })
  return changed ? result : items
}

const RANK: Record<ItemStatus, number> = { needed: 0, dueSoon: 1, bought: 2 }

const nameCollator = new Intl.Collator(undefined, { sensitivity: 'accent' })

export function compareNames(a: string, b: string): number {
  return nameCollator.compare(a, b)
}

/** Needed, then Due Soon, then Bought; alphabetical within each group. */
export function sortByStatus(items: GroceryItem[], now: number): GroceryItem[] {
  return items
    .map((item) => ({ item, rank: RANK[itemStatus(item, now)] }))
    .sort((a, b) => a.rank - b.rank || compareNames(a.item.name, b.item.name))
    .map((entry) => entry.item)
}

/** Case-insensitive match on name or store (blank queries match everything). */
export function filterItems(items: GroceryItem[], query: string): GroceryItem[] {
  if (query.trim() === '') return items
  const needle = query.toLocaleLowerCase()
  return items.filter(
    (item) =>
      item.name.toLocaleLowerCase().includes(needle) ||
      item.recommendedStore.toLocaleLowerCase().includes(needle),
  )
}
