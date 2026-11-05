import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { onForeground } from './appState'
import './styles.css'

registerSW({ immediate: true })

// Best effort: ask the browser not to evict local data.
void navigator.storage?.persist?.()

onForeground()
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') onForeground()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
