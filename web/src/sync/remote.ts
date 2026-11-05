import { parseCadence } from '../domain/cadence'
import type { GroceryItem } from '../domain/item'

/** Wire format of the Apps Script backend (unchanged from the iOS app). */
export interface RemoteItem {
  id: string
  name: string
  recommendedStore: string
  recommendedQuantity: string
  cadence: string
  customCadenceDays: number
  isChecked: boolean
  lastCheckedDate: string | null
  updatedAt: string
}

/** Parses ISO-8601 (what both apps write) or any other `Date.parse`-able string. */
export function parseRemoteDate(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

export function toRemote(item: GroceryItem): RemoteItem {
  return {
    id: item.id,
    name: item.name,
    recommendedStore: item.recommendedStore,
    recommendedQuantity: item.recommendedQuantity,
    cadence: item.cadence,
    customCadenceDays: item.customCadenceDays,
    isChecked: item.isChecked,
    lastCheckedDate: item.lastCheckedDate === null ? null : new Date(item.lastCheckedDate).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString(),
  }
}

export function fromRemote(remote: RemoteItem, now: number): GroceryItem {
  return {
    id: remote.id,
    name: remote.name,
    recommendedStore: remote.recommendedStore,
    recommendedQuantity: remote.recommendedQuantity,
    cadence: parseCadence(remote.cadence),
    customCadenceDays: remote.customCadenceDays,
    isChecked: remote.isChecked,
    lastCheckedDate: parseRemoteDate(remote.lastCheckedDate),
    updatedAt: parseRemoteDate(remote.updatedAt) ?? now,
    isSyncedToRemote: true,
  }
}

/** Coerces one row of the list response; `null` when it has no usable id. */
export function coerceRemoteItem(raw: unknown): RemoteItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.id === undefined || r.id === null || String(r.id) === '') return null
  const days = Number(r.customCadenceDays)
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    recommendedStore: String(r.recommendedStore ?? ''),
    recommendedQuantity: String(r.recommendedQuantity ?? '1'),
    cadence: String(r.cadence ?? ''),
    customCadenceDays: Number.isFinite(days) && days > 0 ? days : 1,
    isChecked: r.isChecked === true || r.isChecked === 'true' || r.isChecked === 'TRUE',
    lastCheckedDate: r.lastCheckedDate ? String(r.lastCheckedDate) : null,
    updatedAt: String(r.updatedAt ?? ''),
  }
}
