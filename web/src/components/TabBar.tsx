import { Icon, type IconName } from './icons'

const TABS: { path: string; label: string; icon: IconName }[] = [
  { path: '/items', label: 'All Items', icon: 'list' },
  { path: '/stores', label: 'Store Mode', icon: 'cart' },
  { path: '/settings', label: 'Settings', icon: 'gear' },
]

export function TabBar({ route, navigate }: { route: string; navigate: (to: string) => void }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((tab) => {
        const active = route === tab.path || route.startsWith(`${tab.path}/`)
        return (
          <button
            key={tab.path}
            className={active ? 'tab active' : 'tab'}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(tab.path)}
          >
            <Icon name={tab.icon} size={26} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
