import { useState } from 'react'
import { actions, itemStore, sync } from '../appState'
import { EmptyState } from '../components/EmptyState'
import { Icon, StatusIcon } from '../components/icons'
import { PullToRefresh } from '../components/PullToRefresh'
import { SwipeRow } from '../components/SwipeRow'
import { filterItems, itemStatus, sortByStatus } from '../domain/status'
import type { GroceryItem } from '../domain/item'
import { useNow } from '../hooks'
import { useStore } from '../storage/store'
import { AddEditItemSheet } from './AddEditItemSheet'

export function cadenceDescription(item: GroceryItem): string {
  return item.cadence === 'Custom' ? `Every ${item.customCadenceDays} day(s)` : item.cadence
}

export function ItemListScreen() {
  const items = useStore(itemStore)
  const now = useNow()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<GroceryItem | null>(null)

  const visible = sortByStatus(filterItems(items, query), now)

  return (
    <section className="screen">
      <header className="nav-bar large">
        <div className="nav-actions">
          <button className="icon-button" aria-label="Add Item" onClick={() => setAdding(true)}>
            <Icon name="plus" size={26} />
          </button>
        </div>
        <h1>Grocery List</h1>
        <label className="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Search items or stores" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </header>

      <PullToRefresh onRefresh={() => sync.syncAll()}>
        {items.length === 0 ? (
          <EmptyState icon="cartPlus" title="No Items Yet" description="Tap + to add your first grocery item." />
        ) : visible.length === 0 ? (
          <EmptyState icon="search" title={`No Results for “${query}”`} description="Check the spelling or try a new search." />
        ) : (
          <ul className="list">
            {visible.map((item) => {
              const status = itemStatus(item, now)
              return (
                <li key={item.id}>
                  <SwipeRow
                    leading={status === 'dueSoon' ? { label: 'Extend', color: 'orange', icon: <Icon name="extend" size={22} />, onAction: () => actions.snooze(item.id) } : undefined}
                    trailing={{ label: 'Delete', color: 'red', fullSwipe: true, onAction: () => actions.remove(item.id) }}
                  >
                    <div className="row">
                      <button className="status-button" onClick={() => actions.toggle(item.id)} aria-label={`Mark ${item.name} ${status === 'bought' ? 'needed' : 'bought'}`}>
                        <StatusIcon status={status} />
                      </button>
                      <button className="row-text" onClick={() => setEditing(item)}>
                        <span className={item.isChecked ? 'title struck' : 'title'}>{item.name}</span>
                        <span className="subtitle">{`${item.recommendedStore} • Qty: ${item.recommendedQuantity} • ${cadenceDescription(item)}`}</span>
                      </button>
                    </div>
                  </SwipeRow>
                </li>
              )
            })}
          </ul>
        )}
      </PullToRefresh>

      {adding && <AddEditItemSheet item={null} onClose={() => setAdding(false)} />}
      {editing && <AddEditItemSheet item={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
