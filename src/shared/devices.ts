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

/** Whether any app is using a camera or the microphone right now, like the iPhone's green and orange dots. */
export interface InUse {
  camera: boolean
  microphone: boolean
}

export type DeviceAlert =
  | { kind: 'charging'; percent: number; state: BatteryState }
  | { kind: 'headphones'; name: string; battery: HeadphoneBattery | null }
