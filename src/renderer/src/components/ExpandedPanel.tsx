import { motion, useReducedMotion } from 'framer-motion'
import { Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, type LucideIcon } from 'lucide-react'
import type { IslandGeometry } from '@shared/ipc'
import type { BatteryStatus, IslandActions, IslandSnapshot } from '../types/activity'
import {
  EXPANDED_WIDTH,
  expandedHeaderHeight,
  showsNotifications,
  type ActivityRowContent
} from '../services/island-layout'
import { contentEnter, contentExit, instant } from '../services/motion'
import { currentActivityLabel } from '../services/presentation'
import { formatMinutes } from '../services/format'
import { MusicPlayer } from './MusicPlayer'
import { Notifications } from './Notifications'
import { TransferProgress } from './TransferProgress'

interface ExpandedPanelProps {
  geometry: IslandGeometry
  /** Final island height, so content is laid out once at full size. */
  height: number
  /** What the notifications/transfers row has to show; empty sections are left out. */
  activity: ActivityRowContent
  snapshot: IslandSnapshot
  actions: IslandActions
}

/**
 * Laid out at its final size from the first frame and revealed by the
 * island's growing clip, so nothing reflows while the shape animates.
 */
export function ExpandedPanel({ geometry, height, activity, snapshot, actions }: ExpandedPanelProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const notifications = showsNotifications(activity)
  const transfers = activity.transfers > 0

  return (
    <motion.div
      className="absolute inset-x-0 top-0 mx-auto flex flex-col px-5 pb-4"
      style={{ width: EXPANDED_WIDTH, height }}
      initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: reduceMotion ? instant : contentEnter }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(6px)', transition: reduceMotion ? instant : contentExit }}
    >
      <Header geometry={geometry} snapshot={snapshot} />

      <div className="mt-2 min-w-0">
        <MusicPlayer nowPlaying={snapshot.nowPlaying} actions={actions} />
      </div>

      {(notifications || transfers) && (
        <>
          <div className="my-3 h-px shrink-0 bg-white/[0.08]" />
          {/* A section with nothing in it is left out; a lone section takes the full width. */}
          <div className={`grid min-h-0 gap-5 ${notifications && transfers ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {notifications && (
              <Notifications
                badges={snapshot.badges}
                onOpenApp={actions.openBadgeApp}
              />
            )}
            {transfers && <TransferProgress transfers={snapshot.transfers} />}
          </div>
        </>
      )}
    </motion.div>
  )
}

function batteryIcon(battery: BatteryStatus): LucideIcon {
  if (battery.state === 'charging') return BatteryCharging
  if (battery.percent >= 90) return BatteryFull
  if (battery.percent >= 50) return BatteryMedium
  if (battery.percent >= 20) return Battery
  return BatteryLow
}

/** Sits in the menu bar strip, either side of the notch. */
function batteryDetail(battery: BatteryStatus): string | null {
  switch (battery.state) {
    case 'charging':
      return 'Charging'
    case 'full':
      return 'Charged'
    case 'plugged':
      return 'On power'
    case 'discharging':
      return battery.minutesRemaining !== null ? `${formatMinutes(battery.minutesRemaining)} left` : null
  }
}

function Header({ geometry, snapshot }: { geometry: IslandGeometry; snapshot: IslandSnapshot }): React.JSX.Element {
  const battery = snapshot.system?.battery ?? null

  return (
    <div className="flex shrink-0 items-center text-[11px]" style={{ height: expandedHeaderHeight(geometry) }}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-white/70">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="truncate">{currentActivityLabel(snapshot)}</span>
      </div>

      <div className="shrink-0" style={{ width: geometry.notchWidth }} />

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-white/70 tabular-nums">
        {battery && <BatteryReadout battery={battery} />}
      </div>
    </div>
  )
}

function BatteryReadout({ battery }: { battery: BatteryStatus }): React.JSX.Element {
  const BatteryIcon = batteryIcon(battery)
  const detail = batteryDetail(battery)
  return (
    <>
      {detail && <span className="truncate text-white/40">{detail}</span>}
      <span className="font-medium text-white/85">{battery.percent}%</span>
      <BatteryIcon size={16} className={battery.state === 'discharging' ? 'text-white/80' : 'text-emerald-400'} />
    </>
  )
}
