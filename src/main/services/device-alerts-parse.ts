import type { HeadphoneBattery } from '@shared/devices'

/** Pure parsers for device-alerts.ts, kept free of Electron so they can be tested on their own. */

const MAX_DEVICES = 32
const MAX_NAME_LENGTH = 200

/** One line from the watcher: the names of the connected Bluetooth audio devices. */
export function parseWatcherLine(line: string): string[] | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (!Array.isArray(value) || value.length > MAX_DEVICES) return null
  const valid = value.every((name) => typeof name === 'string' && name.length > 0 && name.length <= MAX_NAME_LENGTH)
  return valid ? (value as string[]) : null
}

function percent(value: unknown): number | null {
  const match = typeof value === 'string' ? /^(\d{1,3})\s?%$/.exec(value.trim()) : null
  const number = match ? Number(match[1]) : NaN
  return number >= 0 && number <= 100 ? number : null
}

/** Battery of one connected device from `system_profiler SPBluetoothDataType -json`. */
export function parseHeadphoneBattery(output: unknown, name: string): HeadphoneBattery | null {
  const sections = (output as { SPBluetoothDataType?: unknown } | null)?.SPBluetoothDataType
  if (!Array.isArray(sections)) return null

  for (const section of sections) {
    const connected = (section as { device_connected?: unknown } | null)?.device_connected
    if (!Array.isArray(connected)) continue
    for (const entry of connected) {
      const info = (entry as Record<string, unknown> | null)?.[name] as Record<string, unknown> | undefined
      if (!info || typeof info !== 'object') continue
      const battery: HeadphoneBattery = {
        main: percent(info['device_batteryLevelMain']),
        left: percent(info['device_batteryLevelLeft']),
        right: percent(info['device_batteryLevelRight']),
        case: percent(info['device_batteryLevelCase'])
      }
      return Object.values(battery).some((level) => level !== null) ? battery : null
    }
  }
  return null
}
