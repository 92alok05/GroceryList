import { useRef, useState, type ReactNode } from 'react'

export interface SwipeAction {
  label: string
  icon?: ReactNode
  color: 'orange' | 'red'
  onAction: () => void
  /** Triggers automatically when swiped past the edge (iOS `allowsFullSwipe`). */
  fullSwipe?: boolean
}

interface Props {
  children: ReactNode
  /** Revealed by swiping right (iOS leading edge). */
  leading?: SwipeAction
  /** Revealed by swiping left (iOS trailing edge). */
  trailing?: SwipeAction
}

const ACTION_WIDTH = 88
const FULL_SWIPE = 220

/** Pointer-based stand-in for SwiftUI `swipeActions`. */
export function SwipeRow({ children, leading, trailing }: Props) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; base: number; locked: boolean | null } | null>(null)
  const moved = useRef(false)

  const clamp = (v: number) => {
    const max = leading ? FULL_SWIPE : 0
    const min = trailing ? -FULL_SWIPE : 0
    return Math.min(max, Math.max(min, v))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: offset, locked: null }
    moved.current = false
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (s.locked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.locked = Math.abs(dx) > Math.abs(dy) // horizontal gesture?
      if (s.locked) e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (s.locked) {
      moved.current = true
      setDragging(true)
      setOffset(clamp(s.base + dx))
    }
  }

  const finish = () => {
    const s = start.current
    start.current = null
    setDragging(false)
    if (!s?.locked) return
    if (offset <= -FULL_SWIPE * 0.75 && trailing?.fullSwipe) {
      setOffset(0)
      trailing.onAction()
    } else if (offset >= ACTION_WIDTH / 2 && leading) setOffset(ACTION_WIDTH)
    else if (offset <= -ACTION_WIDTH / 2 && trailing) setOffset(-ACTION_WIDTH)
    else setOffset(0)
  }

  const run = (a: SwipeAction) => {
    setOffset(0)
    a.onAction()
  }

  return (
    <div className="swipe-row">
      {leading && (
        <button className={`swipe-action leading ${leading.color}`} style={{ width: Math.max(offset, 0) }} onClick={() => run(leading)} tabIndex={offset > 0 ? 0 : -1}>
          <span>{leading.icon}{leading.label}</span>
        </button>
      )}
      {trailing && (
        <button className={`swipe-action trailing ${trailing.color}`} style={{ width: Math.max(-offset, 0) }} onClick={() => run(trailing)} tabIndex={offset < 0 ? 0 : -1}>
          <span>{trailing.icon}{trailing.label}</span>
        </button>
      )}
      <div
        className="swipe-content"
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => {
          if (moved.current) {
            e.stopPropagation()
            e.preventDefault()
            moved.current = false
          } else if (offset !== 0) {
            e.stopPropagation()
            e.preventDefault()
            setOffset(0)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
