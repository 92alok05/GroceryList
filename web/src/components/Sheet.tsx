import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  onCancel: () => void
  onConfirm?: () => void
  confirmLabel?: string
  confirmDisabled?: boolean
  children: ReactNode
}

/** Modal sheet with Cancel / Save in the nav bar (SwiftUI `.sheet`). */
export function Sheet({ title, onCancel, onConfirm, confirmLabel = 'Save', confirmDisabled, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-bar">
          <button className="text-button" onClick={onCancel}>Cancel</button>
          <h2>{title}</h2>
          {onConfirm ? (
            <button className="text-button bold" onClick={onConfirm} disabled={confirmDisabled}>{confirmLabel}</button>
          ) : (
            <span />
          )}
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
