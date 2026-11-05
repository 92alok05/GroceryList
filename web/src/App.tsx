import { settingsStore, tutorialStore } from './appState'
import { TabBar } from './components/TabBar'
import { useHashRoute } from './hooks'
import { HouseholdScreen } from './screens/HouseholdScreen'
import { ItemListScreen } from './screens/ItemListScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StoreChecklistScreen } from './screens/StoreChecklistScreen'
import { StoreModeScreen } from './screens/StoreModeScreen'
import { TutorialScreen } from './screens/TutorialScreen'
import { useStore } from './storage/store'

export function App() {
  const [route, navigate] = useHashRoute()
  const tutorial = useStore(tutorialStore)
  const settings = useStore(settingsStore)

  let screen
  if (route.startsWith('/stores/')) {
    screen = <StoreChecklistScreen store={decodeURIComponent(route.slice('/stores/'.length))} navigate={navigate} />
  } else if (route.startsWith('/stores')) {
    screen = <StoreModeScreen navigate={navigate} />
  } else if (route.startsWith('/settings')) {
    screen = <SettingsScreen />
  } else {
    screen = <ItemListScreen />
  }

  const signedIn = settings.deviceToken !== ''

  return (
    <div className="app">
      <main>{signedIn ? screen : <HouseholdScreen initialError={settings.lastSyncError} />}</main>
      {signedIn && <TabBar route={route} navigate={navigate} />}
      {tutorial.isShowing && <TutorialScreen onFinish={() => tutorialStore.markSeen()} />}
    </div>
  )
}
