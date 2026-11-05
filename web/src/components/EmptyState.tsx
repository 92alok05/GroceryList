import { Icon, type IconName } from './icons'

export function EmptyState({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={52} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
