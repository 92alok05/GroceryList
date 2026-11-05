import { useEffect } from 'react'
import { actions, itemStore, sync } from '../appState'
import { Icon, StatusIcon } from '../components/icons'
import { PullToRefresh } from '../components/PullToRefresh'
import { SwipeRow } from '../components/SwipeRow'
import { itemStatus, sortByStatus } from '../domain/status'
import { useNow } from '../hooks'
import { useStore } from '../storage/store'

const formatChecked = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Per-store checklist for in-aisle shopping. */
export function StoreChecklistScreen({ store, navigate }: { store: string; navigate: (to: string) => void }) {
  const items = useStore(itemStore)
  const now = useNow()

  useEffect(() => {
    actions.refreshCadence()
  }, [])

  const visible = sortByStatus(items.filter((i) => i.recommendedStore === store), now)

  return (
    <section className="screen">
      <header className="nav-bar inline">
        <button className="back" onClick={() => navigate('/stores')}>
          <Icon name="chevronLeft" size={22} />
          <span>Store Mode</span>
        </button>
        <h1>{store}</h1>
        <span />
      </header>
      <PullToRefresh onRefresh={() => sync.syncAll()}>
        <ul className="list">
          {visible.map((item) => {
            const status = itemStatus(item, now)
            return (
              <li key={item.id}>
                <SwipeRow
                  leading={status === 'dueSoon' ? { label: 'Extend', color: 'orange', icon: <Icon name="extend" size={22} />, onAction: () => actions.snooze(item.id) } : undefined}
                >
                  <button className="row" onClick={() => actions.toggle(item.id)}>
                    <StatusIcon status={status} />
                    <span className="row-text">
                      <span className={item.isChecked ? 'title struck' : 'title'}>{item.name}</span>
                      <span className="caption">{`Qty: ${item.recommendedQuantity}`}</span>
                      {item.isChecked && item.lastCheckedDate !== null && (
                        <span className="caption">{`Checked ${formatChecked(item.lastCheckedDate)}`}</span>
                      )}
                    </span>
                  </button>
                </SwipeRow>
              </li>
            )
          })}
        </ul>
      </PullToRefresh>
    </section>
  )
}
