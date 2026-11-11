/** Short-lived alerts the island shows when power or headphones connect, like on iPhone. */

import type { BatteryState } from './system'

/** Battery levels macOS reports for Bluetooth headphones, in percent; null when not reported. */
export interface HeadphoneBattery {
  /** Single-battery headphones and headsets. */
  main: number | null
  /** Earbuds such as AirPods report each bud and the case. */
  left: number | null
  right: number | null
  case: number | null
}

export type DeviceAlert =
  | { kind: 'charging'; percent: number; state: BatteryState }
  | { kind: 'headphones'; name: string; battery: HeadphoneBattery | null }
