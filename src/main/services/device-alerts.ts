import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { app, powerMonitor } from 'electron'
import type { DeviceAlert, HeadphoneBattery } from '@shared/devices'
import type { BatteryStatus } from '@shared/system'
import { parseHeadphoneBattery, parseWatcherLine } from './device-alerts-parse'

const run = promisify(execFile)

const WATCHER = 'macisland-audio-watch'
/** pmset still reports the old state for a moment after the cable goes in. */
const CHARGER_SETTLE_MS = 1000
/** Headphones report their battery shortly after connecting; ask twice before showing without it. */
const BATTERY_ATTEMPTS_MS = [1200, 2500]
const RELAUNCH_DELAY_MS = 2000
const MAX_RELAUNCHES = 5
const MAX_LINE_BYTES = 64 * 1024

function watcherPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, WATCHER)
    : join(app.getAppPath(), 'native', 'swift-helper', '.build', WATCHER)
}

async function readHeadphoneBattery(name: string): Promise<HeadphoneBattery | null> {
  try {
    const { stdout } = await run('/usr/sbin/system_profiler', ['SPBluetoothDataType', '-json'], {
      timeout: 5000,
      maxBuffer: 4 * 1024 * 1024
    })
    return parseHeadphoneBattery(JSON.parse(stdout), name)
  } catch (error) {
    console.warn('[device-alerts] headphone battery read failed:', (error as Error).message)
    return null
  }
}

export interface DeviceAlertOptions {
  /** Reads the Mac's battery now and updates the battery beside the notch. */
  refreshBattery(): Promise<BatteryStatus | null>
  onAlert(alert: DeviceAlert): void
}

/**
 * Notices a charger being plugged in (powerMonitor) and Bluetooth headphones
 * connecting (macisland-audio-watch, a small Core Audio watcher that needs no
 * permission), and reports each as an alert for the island.
 */
export function startDeviceAlerts({ refreshBattery, onAlert }: DeviceAlertOptions): { stop(): void } {
  let stopped = false
  const timers = new Set<NodeJS.Timeout>()
  const later = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        resolve()
      }, ms)
      timers.add(timer)
    })

  // Charger.
  const onAC = async (): Promise<void> => {
    await later(CHARGER_SETTLE_MS)
    const battery = await refreshBattery()
    if (stopped || !battery || battery.state === 'discharging') return
    onAlert({ kind: 'charging', percent: battery.percent, state: battery.state })
  }
  const onBattery = (): void => void refreshBattery()
  const acListener = (): void => void onAC()
  powerMonitor.on('on-ac', acListener)
  powerMonitor.on('on-battery', onBattery)

  // Headphones. The first report is what was already connected; only later additions are announced.
  let connected: Set<string> | null = null
  let watcher: ChildProcess | null = null
  let relaunches = 0

  const announce = async (name: string): Promise<void> => {
    let battery: HeadphoneBattery | null = null
    for (const wait of BATTERY_ATTEMPTS_MS) {
      await later(wait)
      if (stopped || !connected?.has(name)) return
      battery = await readHeadphoneBattery(name)
      if (battery) break
    }
    if (stopped || !connected?.has(name)) return
    onAlert({ kind: 'headphones', name, battery })
  }

  const onDevices = (names: string[]): void => {
    const previous = connected
    connected = new Set(names)
    if (!previous) return
    for (const name of names) if (!previous.has(name)) void announce(name)
  }

  const launch = (): void => {
    connected = null
    const child = spawn(watcherPath(), [], { stdio: ['pipe', 'pipe', 'ignore'] })
    watcher = child
    let buffer = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.length > MAX_LINE_BYTES) {
        console.warn('[device-alerts] watcher output too long; ignoring it')
        buffer = ''
        return
      }
      let newline: number
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const names = parseWatcherLine(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        if (names) onDevices(names)
      }
    })
    child.on('error', (error) => console.warn('[device-alerts] audio watcher failed:', error.message))
    child.on('exit', () => {
      if (watcher === child) watcher = null
      if (stopped || relaunches >= MAX_RELAUNCHES) return
      relaunches++
      void later(RELAUNCH_DELAY_MS).then(() => {
        if (!stopped) launch()
      })
    })
  }
  launch()

  return {
    stop() {
      stopped = true
      powerMonitor.off('on-ac', acListener)
      powerMonitor.off('on-battery', onBattery)
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      // Closing its stdin makes the watcher exit by itself; kill covers a stuck one.
      watcher?.stdin?.end()
      watcher?.kill()
      watcher = null
    }
  }
}
