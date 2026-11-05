import { describe, expect, it } from 'vitest'
import { addDays, cadenceDays, parseCadence } from './cadence'
import { newItem, type GroceryItem } from './item'
import {
  filterItems,
  isDueForRefresh,
  itemStatus,
  nextDueDate,
  refreshDueItems,
  snoozeItem,
  sortByStatus,
  toggleItem,
} from './status'
import { availableStores, storesWithItems } from './stores'

const DAY = 86_400_000
const HOUR = 3_600_000
const T0 = new Date(2026, 0, 10, 12, 0, 0).getTime()

function item(overrides: Partial<GroceryItem> = {}): GroceryItem {
  return { ...newItem({ name: 'Milk', recommendedStore: 'Safeway' }, T0), ...overrides }
}

describe('cadence', () => {
  it('maps cadences to days', () => {
    expect(cadenceDays('One Time', 7)).toBeNull()
    expect(cadenceDays('Daily', 7)).toBe(1)
    expect(cadenceDays('Weekly', 7)).toBe(7)
    expect(cadenceDays('Every 2 Weeks', 7)).toBe(14)
    expect(cadenceDays('Monthly', 7)).toBe(30)
    expect(cadenceDays('Custom', 3)).toBe(3)
    expect(cadenceDays('Custom', 0)).toBe(1)
  })

  it('falls back to One Time for unknown raw values', () => {
    expect(parseCadence('Hourly')).toBe('One Time')
    expect(parseCadence('Weekly')).toBe('Weekly')
  })

  it('adds calendar days in local time across DST', () => {
    const before = new Date(2026, 2, 7, 12, 0).getTime()
    const after = new Date(addDays(before, 2))
    expect([after.getDate(), after.getHours()]).toEqual([9, 12])
  })
})

describe('itemStatus', () => {
  const weekly = (checkedAgoMs: number) =>
    item({ cadence: 'Weekly', isChecked: true, lastCheckedDate: T0 - checkedAgoMs })

  it('is needed when unchecked', () => {
    expect(itemStatus(item(), T0)).toBe('needed')
  })

  it('is bought for checked One Time items forever', () => {
    expect(itemStatus(item({ isChecked: true, lastCheckedDate: T0 - 400 * DAY }), T0)).toBe('bought')
  })

  it('is bought for a checked item with no check date', () => {
    expect(itemStatus(item({ cadence: 'Weekly', isChecked: true }), T0)).toBe('bought')
  })

  it('is bought early, dueSoon in the last 25% (weekly = 42h), needed once elapsed', () => {
    expect(itemStatus(weekly(1 * DAY), T0)).toBe('bought')
    // due in 43h -> still bought; due in 42h -> due soon
    expect(itemStatus(weekly(7 * DAY - 43 * HOUR), T0)).toBe('bought')
    expect(itemStatus(weekly(7 * DAY - 42 * HOUR), T0)).toBe('dueSoon')
    expect(itemStatus(weekly(7 * DAY - 1 * HOUR), T0)).toBe('dueSoon')
    expect(itemStatus(weekly(7 * DAY), T0)).toBe('needed')
  })

  it('uses a 6 hour window for daily items (0.25 day minimum buffer)', () => {
    const daily = (ago: number) => item({ cadence: 'Daily', isChecked: true, lastCheckedDate: T0 - ago })
    expect(itemStatus(daily(17 * HOUR), T0)).toBe('bought')
    expect(itemStatus(daily(18 * HOUR), T0)).toBe('dueSoon')
  })

  it('computes nextDueDate only for repeating, checked-once items', () => {
    expect(nextDueDate(item())).toBeNull()
    expect(nextDueDate(item({ cadence: 'Weekly' }))).toBeNull()
    expect(nextDueDate(item({ cadence: 'Daily', lastCheckedDate: T0 }))).toBe(addDays(T0, 1))
  })
})

describe('toggleItem', () => {
  it('needed -> bought resets the clock and bumps updatedAt', () => {
    const r = toggleItem(item({ cadence: 'Weekly' }), T0 + 5)
    expect(r).toMatchObject({ isChecked: true, lastCheckedDate: T0 + 5, updatedAt: T0 + 5 })
  })

  it('dueSoon -> bought re-checks with a fresh clock', () => {
    const due = item({ cadence: 'Weekly', isChecked: true, lastCheckedDate: T0 - 6 * DAY })
    expect(itemStatus(due, T0)).toBe('dueSoon')
    expect(toggleItem(due, T0).lastCheckedDate).toBe(T0)
  })

  it('bought -> needed clears the check', () => {
    const bought = item({ cadence: 'Weekly', isChecked: true, lastCheckedDate: T0 })
    expect(toggleItem(bought, T0 + 1)).toMatchObject({ isChecked: false, lastCheckedDate: null })
  })
})

describe('snoozeItem', () => {
  it('pushes the due date out by one cadence length', () => {
    const due = item({ cadence: 'Weekly', isChecked: true, lastCheckedDate: T0 - 6 * DAY })
    const r = snoozeItem(due, T0)
    expect(nextDueDate(r)).toBe(addDays(nextDueDate(due)!, 7))
    expect(r.updatedAt).toBe(T0)
    expect(r.isChecked).toBe(true)
    expect(itemStatus(r, T0)).toBe('bought')
  })

  it('is a no-op for One Time or never-checked items', () => {
    const once = item({ isChecked: true, lastCheckedDate: T0 })
    expect(snoozeItem(once, T0 + 1)).toBe(once)
    const never = item({ cadence: 'Weekly' })
    expect(snoozeItem(never, T0 + 1)).toBe(never)
  })
})

describe('refreshDueItems', () => {
  it('unchecks elapsed items without touching updatedAt', () => {
    const elapsed = item({ cadence: 'Weekly', isChecked: true, lastCheckedDate: T0 - 8 * DAY, updatedAt: 99 })
    const fresh = item({ id: 'b', cadence: 'Weekly', isChecked: true, lastCheckedDate: T0 - DAY })
    const oneTime = item({ id: 'c', isChecked: true, lastCheckedDate: T0 - 999 * DAY })
    const [a, b, c] = refreshDueItems([elapsed, fresh, oneTime], T0)
    expect(a).toMatchObject({ isChecked: false, lastCheckedDate: null, updatedAt: 99 })
    expect(b).toBe(fresh)
    expect(c).toBe(oneTime)
  })

  it('returns the same array when nothing changed', () => {
    const items = [item()]
    expect(refreshDueItems(items, T0)).toBe(items)
    expect(isDueForRefresh(items[0], T0)).toBe(false)
  })
})

describe('sorting, filtering and stores', () => {
  const needed = item({ id: '1', name: 'banana' })
  const needed2 = item({ id: '2', name: 'Apple' })
  const soon = item({ id: '3', name: 'Aaa', cadence: 'Weekly', isChecked: true, lastCheckedDate: T0 - 6 * DAY })
  const bought = item({ id: '4', name: 'Aab', isChecked: true, lastCheckedDate: T0 })

  it('orders Needed, Due Soon, Bought, alphabetical (case-insensitive) within groups', () => {
    expect(sortByStatus([bought, soon, needed, needed2], T0).map((i) => i.id)).toEqual(['2', '1', '3', '4'])
  })

  it('filters by name or store, ignoring case and blank queries', () => {
    const t = item({ id: '5', name: 'Rice', recommendedStore: 'Indian Store' })
    expect(filterItems([needed, t], '  ')).toHaveLength(2)
    expect(filterItems([needed, t], 'INDIAN').map((i) => i.id)).toEqual(['5'])
    expect(filterItems([needed, t], 'ban').map((i) => i.id)).toEqual(['1'])
  })

  it('merges default stores with used stores', () => {
    const x = item({ recommendedStore: 'Costco' })
    expect(availableStores([x])).toEqual(['Costco', 'Indian Store', 'Safeway', 'Target', "Trader Joe's"])
    expect(storesWithItems([x, needed])).toEqual(['Costco', 'Safeway'])
    expect(storesWithItems([])).toEqual([])
  })
})
