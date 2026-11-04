/** System readings produced by the main process and shown by the island. */

export type BatteryState =
  /** On AC power and charging. */
  | 'charging'
  /** Running on battery. */
  | 'discharging'
  /** On AC power, battery full. */
  | 'full'
  /** On AC power, not charging (e.g. optimized charging hold). */
  | 'plugged'

export interface BatteryStatus {
  percent: number
  state: BatteryState
  /** Time to empty while discharging; null when unknown or on AC power. */
  minutesRemaining: number | null
}

export interface SystemStats {
  /** Null on Macs without a battery. */
  battery: BatteryStatus | null
  cpuPercent: number
  memoryUsedGB: number
  memoryTotalGB: number
}
