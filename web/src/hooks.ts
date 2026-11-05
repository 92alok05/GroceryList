import { useEffect, useState } from 'react'

/** Current time, refreshed every minute so statuses move Bought → Due Soon → Needed live. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs])
  return now
}

export function useHashRoute(): [string, (to: string) => void] {
  const read = () => window.location.hash.replace(/^#/, '') || '/items'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return [route, (to) => (window.location.hash = to)]
}
