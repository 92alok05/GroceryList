import type { GroceryItem } from './item'

export const DEFAULT_STORES = ['Safeway', 'Target', "Trader Joe's", 'Indian Store']

/** Prepopulated defaults plus any store already used on an item, sorted. */
export function availableStores(items: GroceryItem[]): string[] {
  return [...new Set([...DEFAULT_STORES, ...items.map((i) => i.recommendedStore)])].sort()
}

/** Stores that currently have at least one item (Store Mode list). */
export function storesWithItems(items: GroceryItem[]): string[] {
  return [...new Set(items.map((i) => i.recommendedStore))].sort()
}
