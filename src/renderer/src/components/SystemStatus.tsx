import { Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, Cpu, MemoryStick, type LucideIcon } from 'lucide-react'
import type { BatteryStatus, SystemStats } from '../types/activity'
import { ProgressBar } from './ui/ProgressBar'

interface SystemStatusProps {
  /** Null until the first reading arrives. */
  system: SystemStats | null
}

export function batteryIcon(battery: BatteryStatus): LucideIcon {
  if (battery.state === 'charging') return BatteryCharging
  if (battery.percent >= 90) return BatteryFull
  if (battery.percent >= 50) return BatteryMedium
  if (battery.percent >= 20) return Battery
  return BatteryLow
}

function batteryColor(battery: BatteryStatus): string {
  if (battery.state !== 'discharging') return '#30d158'
  return battery.percent <= 20 ? '#ff453a' : '#fff'
}

/** Green when healthy, amber when busy, red when it needs attention. */
function loadColor(fraction: number): string {
  if (fraction >= 0.85) return '#ff453a'
  if (fraction >= 0.6) return '#ffd60a'
  return '#30d158'
}

export function SystemStatus({ system }: SystemStatusProps): React.JSX.Element {
  const battery = system?.battery ?? null
  const memoryFraction = system ? system.memoryUsedGB / system.memoryTotalGB : 0

  return (
    <div className="flex h-full flex-col justify-between gap-2 rounded-2xl bg-white/[0.06] px-3 py-2.5">
      {battery && (
        <Stat
          icon={batteryIcon(battery)}
          label="Battery"
          value={`${battery.percent}%`}
          fraction={battery.percent / 100}
          color={batteryColor(battery)}
        />
      )}
      <Stat
        icon={Cpu}
        label="CPU"
        value={system ? `${system.cpuPercent}%` : '--'}
        fraction={(system?.cpuPercent ?? 0) / 100}
        color={loadColor((system?.cpuPercent ?? 0) / 100)}
      />
      <Stat
        icon={MemoryStick}
        label="Memory"
        value={system ? `${system.memoryUsedGB.toFixed(1)} / ${system.memoryTotalGB} GB` : '--'}
        fraction={memoryFraction}
        color={loadColor(memoryFraction)}
      />
    </div>
  )
}

interface StatProps {
  icon: LucideIcon
  label: string
  value: string
  fraction: number
  color: string
}

function Stat({ icon: Icon, label, value, fraction, color }: StatProps): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <Icon size={13} className="text-white/50" />
        <span className="text-white/55">{label}</span>
        <span className="ml-auto font-medium text-white/90 tabular-nums">{value}</span>
      </div>
      <ProgressBar className="mt-1.5 h-[3px]" value={fraction} color={color} label={label} />
    </div>
  )
}
