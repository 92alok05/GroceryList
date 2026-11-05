import { API_URL } from '../config'
import { createStore, type Store } from './store'

const TOKEN_KEY = 'syncDeviceToken'
const HOUSEHOLD_KEY = 'syncHouseholdName'
const LAST_SYNCED_KEY = 'syncLastSyncedAt'
const TUTORIAL_KEY = 'hasSeenOnboardingTutorial'
// Keys from the pre-household proof of concept; wiped so the old shared secret does not linger.
const LEGACY_KEYS = ['syncWebAppURL', 'syncSharedSecret']

export interface SyncSettings {
  webAppURL: string
  /** Random per-device credential issued by the server when joining a household. */
  deviceToken: string
  householdName: string
  lastSyncedAt: number | null
  /** In-memory only, like the iOS app. */
  lastSyncError: string | null
}

export function isConfigured(s: Pick<SyncSettings, 'webAppURL' | 'deviceToken'>): boolean {
  return s.webAppURL.trim() !== '' && s.deviceToken.trim() !== ''
}

/** The token lives only in this device's localStorage; it is never part of the build. */
export function createSettingsStore(storage: Storage, webAppURL: string = API_URL): Store<SyncSettings> {
  LEGACY_KEYS.forEach((k) => storage.removeItem(k))
  const stored = Number(storage.getItem(LAST_SYNCED_KEY))
  return createStore<SyncSettings>(
    {
      webAppURL,
      deviceToken: storage.getItem(TOKEN_KEY) ?? '',
      householdName: storage.getItem(HOUSEHOLD_KEY) ?? '',
      lastSyncedAt: Number.isFinite(stored) && stored > 0 ? stored : null,
      lastSyncError: null,
    },
    (s) => {
      storage.setItem(TOKEN_KEY, s.deviceToken)
      storage.setItem(HOUSEHOLD_KEY, s.householdName)
      if (s.lastSyncedAt !== null) storage.setItem(LAST_SYNCED_KEY, String(s.lastSyncedAt))
      else storage.removeItem(LAST_SYNCED_KEY)
    },
  )
}

export interface TutorialState {
  isShowing: boolean
}

export function createTutorialStore(storage: Storage): Store<TutorialState> & {
  markSeen(): void
  replay(): void
} {
  const store = createStore<TutorialState>({ isShowing: storage.getItem(TUTORIAL_KEY) !== 'true' })
  return {
    ...store,
    markSeen() {
      storage.setItem(TUTORIAL_KEY, 'true')
      store.set({ isShowing: false })
    },
    replay() {
      store.set({ isShowing: true })
    },
  }
}
