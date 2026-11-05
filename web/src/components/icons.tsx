import type { ReactNode } from 'react'

// Original SVG drawings standing in for SF Symbols (which can't be used on the web).
const paths: Record<string, ReactNode> = {
  list: (
    <>
      <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <path d="M8 6h13M8 12h13M8 18h13" />
    </>
  ),
  cart: (
    <>
      <path d="M2 3h3l2.5 11.5h10.5L20.5 7H6" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l5 5" />
    </>
  ),
  extend: (
    <>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v4.5h-4.5M12 8v4.5l3 1.5" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  sync: <path d="M20 8a8 8 0 0 0-14-2M4 4v4h4M4 16a8 8 0 0 0 14 2M20 20v-4h-4" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.1" />
    </>
  ),
  store: <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v1.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v7h14v-7M10 20v-4h4v4" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3 19c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5M16 14c3 0 5 1.6 5 4.5" />
    </>
  ),
  seal: (
    <>
      <path d="M12 2.5l2.4 1.7 2.9-.1.9 2.8 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.8-2.9-.1L12 21.5l-2.4-1.7-2.9.1-.9-2.8-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.8 2.9.1z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  cartPlus: (
    <>
      <path d="M2 3h3l2.5 11.5h10.5L20.5 7H6" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
      <path d="M13 8v4M11 10h4" />
    </>
  ),
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function StatusIcon({ status }: { status: 'needed' | 'dueSoon' | 'bought' }) {
  const label = { needed: 'Needed', dueSoon: 'Due soon', bought: 'Bought' }[status]
  return (
    <svg className={`status-icon ${status}`} width="28" height="28" viewBox="0 0 28 28" role="img" aria-label={label}>
      {status === 'needed' && <circle cx="14" cy="14" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.8" />}
      {status === 'dueSoon' && (
        <>
          <circle cx="14" cy="14" r="11.5" fill="currentColor" />
          <path d="M9.5 7.5h9M9.5 20.5h9M10.5 7.5c0 4 3 4.5 3.5 6.5-.5 2-3.5 2.5-3.5 6.5M17.5 7.5c0 4-3 4.5-3.5 6.5.5 2 3.5 2.5 3.5 6.5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {status === 'bought' && (
        <>
          <circle cx="14" cy="14" r="11.5" fill="currentColor" />
          <path d="M8.5 14.5l4 4 7-8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}
