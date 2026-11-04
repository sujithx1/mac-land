import { motion, useReducedMotion } from 'framer-motion'
import type { IslandGeometry } from '@shared/ipc'
import type { BatteryStatus, IslandActions, IslandSnapshot } from '../types/activity'
import { EXPANDED_WIDTH, expandedHeaderHeight } from '../services/island-layout'
import { contentEnter, contentExit, instant } from '../services/motion'
import { currentActivityLabel } from '../services/presentation'
import { formatMinutes } from '../services/format'
import { MusicPlayer } from './MusicPlayer'
import { Notifications } from './Notifications'
import { SystemStatus, batteryIcon } from './SystemStatus'
import { TransferProgress } from './TransferProgress'

interface ExpandedPanelProps {
  geometry: IslandGeometry
  /** Final island height, so content is laid out once at full size. */
  height: number
  /** Whether there are notifications, a permission request or transfers to show. */
  activityRow: boolean
  snapshot: IslandSnapshot
  actions: IslandActions
}

/**
 * Laid out at its final size from the first frame and revealed by the
 * island's growing clip, so nothing reflows while the shape animates.
 */
export function ExpandedPanel({ geometry, height, activityRow, snapshot, actions }: ExpandedPanelProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="absolute inset-x-0 top-0 mx-auto flex flex-col px-5 pb-4"
      style={{ width: EXPANDED_WIDTH, height }}
      initial={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: reduceMotion ? instant : contentEnter }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(6px)', transition: reduceMotion ? instant : contentExit }}
    >
      <Header geometry={geometry} snapshot={snapshot} />

      {/* minmax(0, …) lets long titles truncate instead of pushing the stats card out. */}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_176px] gap-4">
        <MusicPlayer nowPlaying={snapshot.nowPlaying} actions={actions} />
        <SystemStatus system={snapshot.system} />
      </div>

      {activityRow && (
        <>
          <div className="my-3 h-px shrink-0 bg-white/[0.08]" />
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-5">
            <Notifications
              badges={snapshot.badges}
              permission={snapshot.badgePermission}
              onOpenApp={actions.openBadgeApp}
              onOpenSettings={actions.openAccessibilitySettings}
            />
            <TransferProgress transfers={snapshot.transfers} />
          </div>
        </>
      )}
    </motion.div>
  )
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
