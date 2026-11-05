import { useState } from 'react'
import { actions, itemStore } from '../appState'
import { Sheet } from '../components/Sheet'
import { REPEAT_CADENCES, parseCadence, type RepeatCadence } from '../domain/cadence'
import type { GroceryItem } from '../domain/item'
import { DEFAULT_STORES, availableStores } from '../domain/stores'
import { useStore } from '../storage/store'

const NEW_STORE = '__new_store__'

/** Add or edit a grocery item: name, recommended store, quantity and repeat cadence. */
export function AddEditItemSheet({ item, onClose }: { item: GroceryItem | null; onClose: () => void }) {
  const items = useStore(itemStore)
  const stores = availableStores(items)

  const [name, setName] = useState(item?.name ?? '')
  const [store, setStore] = useState(item ? (stores.includes(item.recommendedStore) ? item.recommendedStore : NEW_STORE) : (DEFAULT_STORES[0] ?? NEW_STORE))
  const [newStoreName, setNewStoreName] = useState(item && !stores.includes(item.recommendedStore) ? item.recommendedStore : '')
  const [quantity, setQuantity] = useState(item?.recommendedQuantity ?? '1')
  const [cadence, setCadence] = useState<RepeatCadence>(item?.cadence ?? 'One Time')
  const [customDays, setCustomDays] = useState(item?.customCadenceDays ?? 7)

  const resolvedStore = store === NEW_STORE ? newStoreName.trim() : store
  const valid = name.trim() !== '' && resolvedStore.trim() !== ''

  const save = () => {
    if (!valid) return
    const q = quantity.trim()
    actions.save(
      {
        name,
        recommendedStore: resolvedStore,
        recommendedQuantity: q === '' ? '1' : q,
        cadence,
        customCadenceDays: customDays,
      },
      item?.id,
    )
    onClose()
  }

  return (
    <Sheet title={item ? 'Edit Item' : 'Add Item'} onCancel={onClose} onConfirm={save} confirmDisabled={!valid}>
      <form onSubmit={(e) => { e.preventDefault(); save() }}>
        <h4 className="section-header">Item</h4>
        <div className="group">
          <div className="field">
            <input aria-label="Item name" placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!item} />
          </div>
          <div className="field">
            <label htmlFor="store">Recommended store</label>
            <select id="store" value={store} onChange={(e) => setStore(e.target.value)}>
              {stores.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value={NEW_STORE}>Add New Store…</option>
            </select>
          </div>
          {store === NEW_STORE && (
            <div className="field">
              <input aria-label="New store name" placeholder="New store name" value={newStoreName} onChange={(e) => setNewStoreName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <input aria-label="Recommended quantity" placeholder="Recommended quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>

        <h4 className="section-header">Repeat Cadence</h4>
        <div className="group">
          <div className="field">
            <label htmlFor="cadence">Cadence</label>
            <select id="cadence" value={cadence} onChange={(e) => setCadence(parseCadence(e.target.value))}>
              {REPEAT_CADENCES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {cadence === 'Custom' && (
            <div className="field">
              <span>{`Every ${customDays} day(s)`}</span>
              <span className="stepper">
                <button type="button" aria-label="Decrease days" disabled={customDays <= 1} onClick={() => setCustomDays((d) => Math.max(1, d - 1))}>−</button>
                <button type="button" aria-label="Increase days" disabled={customDays >= 365} onClick={() => setCustomDays((d) => Math.min(365, d + 1))}>+</button>
              </span>
            </div>
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
