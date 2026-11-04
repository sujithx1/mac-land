import { ShieldCheck } from 'lucide-react'
import type { AppBadge, BadgePermission } from '../types/activity'
import { sortedBadges, unreadTotal } from '../services/presentation'
import { AppIcon } from './ui/AppIcon'
import { CountBadge } from './ui/CountBadge'
import { SectionLabel } from './ui/SectionLabel'

interface NotificationsProps {
  badges: readonly AppBadge[]
  permission: BadgePermission
  onOpenApp: (path: string) => void
  onOpenSettings: () => void
}

const VISIBLE = 2

export function Notifications({ badges, permission, onOpenApp, onOpenSettings }: NotificationsProps): React.JSX.Element {
  const ordered = sortedBadges(badges)
  const hidden = ordered.length - VISIBLE
  const total = unreadTotal(badges)

  return (
    <section aria-label="Notifications" className="min-w-0">
      <SectionLabel trailing={total > 0 ? `${total} unread` : undefined}>Notifications</SectionLabel>

      {permission === 'denied' ? (
        <div className="flex items-start gap-2.5 pt-1">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-white/50" />
          <div className="min-w-0">
            <p className="text-[11px] leading-snug text-white/60">
              Allow <span className="text-white/85">MacIsland Helper</span> in Accessibility to show unread counts from your apps.
            </p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20"
            >
              Open Settings
            </button>
          </div>
        </div>
      ) : ordered.length === 0 ? (
        <p className="pt-3 text-[12px] text-white/35">No unread notifications</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {ordered.slice(0, VISIBLE).map((badge) => (
            <li key={badge.path || badge.app}>
              <BadgeRow badge={badge} onOpen={onOpenApp} />
            </li>
          ))}
          {hidden > 0 && <li className="px-1.5 text-[10px] text-white/35">+{hidden} more apps</li>}
        </ul>
      )}
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
      className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors enabled:hover:bg-white/[0.06]"
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
