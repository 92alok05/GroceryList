import { createStore, type Store } from './store'

const URL_KEY = 'syncWebAppURL'
const SECRET_KEY = 'syncSharedSecret'
const LAST_SYNCED_KEY = 'syncLastSyncedAt'
const TUTORIAL_KEY = 'hasSeenOnboardingTutorial'

export interface SyncSettings {
  webAppURL: string
  sharedSecret: string
  lastSyncedAt: number | null
  /** In-memory only, like the iOS app. */
  lastSyncError: string | null
}

export function isConfigured(s: Pick<SyncSettings, 'webAppURL' | 'sharedSecret'>): boolean {
  return s.webAppURL.trim() !== '' && s.sharedSecret.trim() !== ''
}

/** The secret lives only in this device's localStorage; it is never part of the build. */
export function createSettingsStore(storage: Storage): Store<SyncSettings> {
  const stored = Number(storage.getItem(LAST_SYNCED_KEY))
  return createStore<SyncSettings>(
    {
      webAppURL: storage.getItem(URL_KEY) ?? '',
      sharedSecret: storage.getItem(SECRET_KEY) ?? '',
      lastSyncedAt: Number.isFinite(stored) && stored > 0 ? stored : null,
      lastSyncError: null,
    },
    (s) => {
      storage.setItem(URL_KEY, s.webAppURL)
      storage.setItem(SECRET_KEY, s.sharedSecret)
      if (s.lastSyncedAt !== null) storage.setItem(LAST_SYNCED_KEY, String(s.lastSyncedAt))
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
