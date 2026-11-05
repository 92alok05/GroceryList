import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/icons'
import { storesWithItems } from '../domain/stores'
import { itemStore } from '../appState'
import { useStore } from '../storage/store'

export function StoreModeScreen({ navigate }: { navigate: (to: string) => void }) {
  const stores = storesWithItems(useStore(itemStore))
  return (
    <section className="screen">
      <header className="nav-bar large">
        <h1>Store Mode</h1>
      </header>
      <div className="scroll">
        {stores.length === 0 ? (
          <EmptyState icon="store" title="No Stores Yet" description="Add grocery items with a recommended store first." />
        ) : (
          <ul className="list">
            {stores.map((store) => (
              <li key={store}>
                <button className="row link" onClick={() => navigate(`/stores/${encodeURIComponent(store)}`)}>
                  <span className="title">{store}</span>
                  <Icon name="chevronRight" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
