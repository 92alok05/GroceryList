import { useState } from 'react'
import { settingsStore, sync, tutorialStore } from '../appState'
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

  return (
    <section className="screen">
      <header className="nav-bar large">
        <h1>Settings</h1>
      </header>
      <div className="scroll">
        <h4 className="section-header">Google Sheet Sync</h4>
        <div className="group">
          <div className="field">
            <input
              type="url"
              aria-label="Web App URL"
              placeholder="Web App URL"
              value={settings.webAppURL}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => settingsStore.set((s) => ({ ...s, webAppURL: e.target.value }))}
            />
          </div>
          <div className="field">
            <input
              type="password"
              aria-label="Shared secret"
              placeholder="Shared secret"
              value={settings.sharedSecret}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => settingsStore.set((s) => ({ ...s, sharedSecret: e.target.value }))}
            />
          </div>
        </div>
        <p className="section-footer">
          Paste the Web App URL and shared secret from your deployed Google Apps Script. Every family member should enter the same values on their phone. See README for setup steps.
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
      </div>
    </section>
  )
}
