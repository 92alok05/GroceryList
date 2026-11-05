import { useRef, useState, type ReactNode } from 'react'

const THRESHOLD = 70

/** Custom pull-to-refresh: installed iOS PWAs have no native one. */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    startY.current = e.currentTarget.scrollTop <= 0 ? e.touches[0].clientY : null
  }
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startY.current === null || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0 && e.currentTarget.scrollTop <= 0) setPull(Math.min(dy * 0.5, 100))
    else setPull(0)
  }
  const onTouchEnd = async () => {
    const triggered = pull >= THRESHOLD * 0.6
    startY.current = null
    if (!triggered) return setPull(0)
    setRefreshing(true)
    setPull(48)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
      setPull(0)
    }
  }

  return (
    <div className="scroll" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="ptr-indicator" style={{ height: pull }} aria-hidden={pull === 0}>
        {pull > 0 && <div className={`spinner ${refreshing ? 'spinning' : ''}`} />}
      </div>
      {children}
    </div>
  )
}
