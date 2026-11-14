import { execFile } from 'node:child_process'
import { cpus, totalmem } from 'node:os'
import { promisify } from 'node:util'
import type { BatteryStatus, SystemStats } from '@shared/system'

const run = promisify(execFile)

const SAMPLE_INTERVAL_MS = 2000
/** CPU load is a delta between two readings; give the first one something to compare against. */
const FIRST_SAMPLE_DELAY_MS = 500
/** Battery changes slowly and pmset is the costliest probe; read it less often. */
const BATTERY_EVERY_SAMPLES = 15
const GB = 1024 ** 3

interface CpuTimes {
  idle: number
  total: number
}

function readCpuTimes(): CpuTimes {
  let idle = 0
  let total = 0
  for (const { times } of cpus()) {
    idle += times.idle
    total += times.user + times.nice + times.sys + times.irq + times.idle
  }
  return { idle, total }
}

/**
 * "Memory Used" the way Activity Monitor counts it:
 * app memory (anonymous minus purgeable) + wired + compressed.
 */
export function parseVmStat(output: string): number | null {
  const pageSize = Number(/page size of (\d+) bytes/.exec(output)?.[1])
  const pages = (label: string): number => Number(new RegExp(`${label}:\\s+(\\d+)`).exec(output)?.[1] ?? NaN)
  const used =
    pages('Anonymous pages') - pages('Pages purgeable') + pages('Pages wired down') + pages('Pages occupied by compressor')
  return Number.isFinite(used) && pageSize > 0 ? used * pageSize : null
}

/** Parses `pmset -g batt`, e.g. "-InternalBattery-0 (id=1)\t82%; discharging; 5:12 remaining present: true". */
export function parsePmset(output: string): BatteryStatus | null {
  const line = /InternalBattery[^\t]*\t(\d+)%;\s*([^;]+);\s*([^\n]*)/.exec(output)
  if (!line) return null

  const percent = Number(line[1])
  const reported = line[2]!.trim()
  const onAC = output.includes("'AC Power'")
  const time = /(\d+):(\d{2}) remaining/.exec(line[3]!)

  const state: BatteryStatus['state'] =
    reported === 'charging' || reported === 'finishing charge'
      ? 'charging'
      : reported === 'charged'
        ? 'full'
        : onAC
          ? 'plugged'
          : 'discharging'

  const minutes = time ? Number(time[1]) * 60 + Number(time[2]) : null
  return {
    percent,
    state,
    // pmset reports 0:00 while it is still estimating.
    minutesRemaining: state === 'discharging' && minutes ? minutes : null
  }
}

export interface SystemMonitor {
  latest(): SystemStats | null
  /** Reads the battery now instead of waiting for the next scheduled read, and reports it. */
  refreshBattery(): Promise<BatteryStatus | null>
  stop(): void
}

/** Samples CPU, memory and battery on a fixed interval and reports each reading. */
export function startSystemMonitor(onSample: (stats: SystemStats) => void): SystemMonitor {
  const memoryTotalGB = Math.round(totalmem() / GB)
  let previousCpu = readCpuTimes()
  let battery: BatteryStatus | null = null
  let latest: SystemStats | null = null
  let samples = 0
  let stopped = false

  const readBattery = async (): Promise<BatteryStatus | null> => {
    try {
      const { stdout } = await run('/usr/bin/pmset', ['-g', 'batt'], { timeout: 2000 })
      return parsePmset(stdout)
    } catch (error) {
      console.warn('[system-monitor] battery read failed:', (error as Error).message)
      return battery
    }
  }

  const readMemoryUsed = async (): Promise<number | null> => {
    try {
      const { stdout } = await run('/usr/bin/vm_stat', [], { timeout: 2000 })
      return parseVmStat(stdout)
    } catch (error) {
      console.warn('[system-monitor] memory read failed:', (error as Error).message)
      return null
    }
  }

  const sample = async (): Promise<void> => {
    const cpu = readCpuTimes()
    const totalDelta = cpu.total - previousCpu.total
    const cpuPercent = totalDelta > 0 ? Math.round((1 - (cpu.idle - previousCpu.idle) / totalDelta) * 100) : 0
    previousCpu = cpu

    if (samples % BATTERY_EVERY_SAMPLES === 0) battery = await readBattery()
    samples++
    const memoryUsed = await readMemoryUsed()
    if (stopped) return

    latest = {
      battery,
      cpuPercent: Math.min(100, Math.max(0, cpuPercent)),
      memoryUsedGB: memoryUsed === null ? (latest?.memoryUsedGB ?? 0) : Math.round((memoryUsed / GB) * 10) / 10,
      memoryTotalGB
    }
    onSample(latest)
  }

  const firstSample = setTimeout(() => void sample(), FIRST_SAMPLE_DELAY_MS)
  const timer = setInterval(() => void sample(), SAMPLE_INTERVAL_MS)

  return {
    latest: () => latest,
    async refreshBattery() {
      battery = await readBattery()
      if (latest && !stopped) {
        latest = { ...latest, battery }
        onSample(latest)
      }
      return battery
    },
    stop() {
      stopped = true
      clearTimeout(firstSample)
      clearInterval(timer)
    }
  }
}
