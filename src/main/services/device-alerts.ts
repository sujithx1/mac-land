import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { app, powerMonitor } from 'electron'
import type { DeviceAlert, HeadphoneBattery, InUse } from '@shared/devices'
import type { BatteryStatus } from '@shared/system'
import { parseHeadphoneBattery, parseWatcherLine, type WatcherState } from './device-alerts-parse'

const run = promisify(execFile)

const WATCHER = 'macisland-device-watch'
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
  /** A camera or the microphone started or stopped being used. */
  onInUse(inUse: InUse): void
}

export interface DeviceAlerts {
  inUse(): InUse
  stop(): void
}

const NOT_IN_USE: InUse = { camera: false, microphone: false }

/**
 * Notices a charger being plugged in (powerMonitor), Bluetooth headphones
 * connecting, and cameras or the microphone being used. The last two come from
 * macisland-device-watch, a small Core Audio / CoreMediaIO watcher that needs
 * no permission.
 */
export function startDeviceAlerts({ refreshBattery, onAlert, onInUse }: DeviceAlertOptions): DeviceAlerts {
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
  let inUse: InUse = NOT_IN_USE
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

  const setInUse = (next: InUse): void => {
    if (next.camera === inUse.camera && next.microphone === inUse.microphone) return
    inUse = next
    onInUse(inUse)
  }

  const onState = (state: WatcherState): void => {
    setInUse({ camera: state.camera, microphone: state.microphone })
    const previous = connected
    connected = new Set(state.bluetooth)
    if (!previous) return
    for (const name of state.bluetooth) if (!previous.has(name)) void announce(name)
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
        const state = parseWatcherLine(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        if (state) onState(state)
      }
    })
    child.on('error', (error) => console.warn('[device-alerts] device watcher failed:', error.message))
    child.on('exit', () => {
      if (watcher === child) watcher = null
      // Without the watcher there is no way to know; never leave a stale dot showing.
      if (!stopped) setInUse(NOT_IN_USE)
      if (stopped || relaunches >= MAX_RELAUNCHES) return
      relaunches++
      void later(RELAUNCH_DELAY_MS).then(() => {
        if (!stopped) launch()
      })
    })
  }
  launch()

  return {
    inUse: () => inUse,
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
