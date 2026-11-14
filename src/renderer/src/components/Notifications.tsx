import type { AppBadge } from '../types/activity'
import { ACTIVITY_VISIBLE_ROWS } from '../services/island-layout'
import { sortedBadges, unreadTotal } from '../services/presentation'
import { AppIcon } from './ui/AppIcon'
import { CountBadge } from './ui/CountBadge'
import { SectionLabel } from './ui/SectionLabel'

interface NotificationsProps {
  badges: readonly AppBadge[]
  onOpenApp: (path: string) => void
}

/** Heights here match ACTIVITY_ROW in island-layout, which sizes the island. */
export function Notifications({ badges, onOpenApp }: NotificationsProps): React.JSX.Element {
  const ordered = sortedBadges(badges)
  const hidden = ordered.length - ACTIVITY_VISIBLE_ROWS
  const total = unreadTotal(badges)

  return (
    <section aria-label="Notifications" className="min-w-0">
      <SectionLabel trailing={total > 0 ? `${total} unread` : undefined}>Notifications</SectionLabel>

        <ul className="flex flex-col gap-0.5">
          {ordered.slice(0, ACTIVITY_VISIBLE_ROWS).map((badge) => (
            <li key={badge.path || badge.app}>
              <BadgeRow badge={badge} onOpen={onOpenApp} />
            </li>
          ))}
          {hidden > 0 && <li className="flex h-4 items-center px-1.5 text-[10px] text-white/35">+{hidden} more apps</li>}
        </ul>
    </section>
  )
}

function BadgeRow({ badge, onOpen }: { badge: AppBadge; onOpen: (path: string) => void }): React.JSX.Element {
  const detail = badge.count === null ? 'New activity' : `${badge.label} unread`

  return (
    <button
      type="button"
      disabled={!badge.path}
      onClick={() => onOpen(badge.path)}
      title={`Open ${badge.app}`}
      className="flex h-10 w-full items-center gap-2.5 rounded-xl px-1.5 text-left transition-colors enabled:hover:bg-white/[0.06]"
    >
      <AppIcon icon={badge.icon} size={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-white">{badge.app}</span>
        <span className="block truncate text-[11px] text-white/50">{detail}</span>
      </span>
      {badge.count !== null && <CountBadge count={badge.count} />}
    </button>
  )
}
