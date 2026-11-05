import { useState } from 'react'
import { household, settingsStore, sync, tutorialStore } from '../appState'
import { Icon } from '../components/icons'
import { isConfigured } from '../storage/settings'
import { useStore } from '../storage/store'

export function SettingsScreen() {
  const settings = useStore(settingsStore)
  const [syncing, setSyncing] = useState(false)

  const syncNow = async () => {
    setSyncing(true)
    await sync.syncAll()
    setSyncing(false)
  }

  const leave = () => {
    if (window.confirm(`Leave "${settings.householdName}"? This clears the list on this device.`)) void household.leave()
  }

  return (
    <section className="screen">
      <header className="nav-bar large">
        <h1>Settings</h1>
      </header>
      <div className="scroll">
        <h4 className="section-header">Household</h4>
        <div className="group">
          <div className="field">
            <span>Household</span>
            <span className="secondary">{settings.householdName}</span>
          </div>
        </div>
        <p className="section-footer">
          Everyone in this household shares one grocery list. To add someone, give them the household name and passcode.
        </p>

        <div className="group">
          <button className="field action" onClick={syncNow} disabled={!isConfigured(settings) || syncing}>
            {syncing ? <div className="spinner spinning" /> : (<><Icon name="sync" size={22} /><span>Sync Now</span></>)}
          </button>
          {settings.lastSyncedAt !== null && (
            <div className="field">
              <span>Last synced</span>
              <span className="secondary">{new Date(settings.lastSyncedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          )}
          {settings.lastSyncError && <p className="error">{settings.lastSyncError}</p>}
        </div>

        <div className="group">
          <button className="field action" onClick={() => tutorialStore.replay()}>
            <Icon name="help" size={22} />
            <span>Replay Tutorial</span>
          </button>
        </div>

        <div className="group">
          <button className="field action destructive" onClick={leave}>
            <span>Leave household</span>
          </button>
        </div>
        <p className="section-footer">Leaving removes this device from the household and clears its local list. Your household's data stays safe in the sheet.</p>
      </div>
    </section>
  )
}
