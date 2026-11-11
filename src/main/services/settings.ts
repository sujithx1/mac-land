import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** A display picked in the menu, remembered by id and by name: ids can change when a monitor is reconnected. */
export interface DisplayChoice {
  id: number
  name: string
}

export interface DisplaySelection {
  /** An island on every connected display, including ones plugged in later. */
  all: boolean
  /** Used when `all` is off. Empty means the MacBook's own display. */
  chosen: DisplayChoice[]
}

/** More than anyone connects; caps what a hand-edited settings file can ask for. */
const MAX_CHOSEN_DISPLAYS = 16

export interface Settings {
  /** Which screens show an island. */
  displays: DisplaySelection
  /** Kept across restarts so quitting MacIsland is not a way around the lock. */
  locked: boolean
  /** Lock MacIsland whenever the Mac's screen locks. */
  lockWhenMacLocks: boolean
  /** Play the Face ID style animation in the island after the Mac is unlocked. */
  animateMacUnlock: boolean
  /** Briefly expand the island when a charger or Bluetooth headphones connect. */
  deviceAlerts: boolean
}

const DEFAULTS: Settings = {
  displays: { all: false, chosen: [] },
  locked: false,
  lockWhenMacLocks: false,
  animateMacUnlock: true,
  deviceAlerts: true
}

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

function parseDisplays(value: unknown): DisplaySelection {
  if (typeof value !== 'object' || value === null) return { ...DEFAULTS.displays }
  const stored = value as Record<string, unknown>
  const chosen = Array.isArray(stored['chosen']) ? stored['chosen'] : []
  return {
    all: stored['all'] === true,
    chosen: chosen
      .filter((entry): entry is DisplayChoice => {
        const choice = entry as Partial<DisplayChoice> | null
        return (
          typeof choice?.id === 'number' &&
          Number.isInteger(choice.id) &&
          typeof choice.name === 'string' &&
          choice.name.length <= 200
        )
      })
      .slice(0, MAX_CHOSEN_DISPLAYS)
      .map(({ id, name }) => ({ id, name }))
  }
}

/** Reads settings, keeping only known, valid values; anything else falls back to defaults. */
export function loadSettings(): Settings {
  try {
    const raw: unknown = JSON.parse(readFileSync(settingsPath(), 'utf8'))
    const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const flag = (key: 'locked' | 'lockWhenMacLocks' | 'animateMacUnlock' | 'deviceAlerts'): boolean =>
      typeof stored[key] === 'boolean' ? stored[key] : DEFAULTS[key]
    return {
      displays: parseDisplays(stored['displays']),
      locked: flag('locked'),
      lockWhenMacLocks: flag('lockWhenMacLocks'),
      animateMacUnlock: flag('animateMacUnlock'),
      deviceAlerts: flag('deviceAlerts')
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Writes atomically so a crash mid-write can never leave a corrupt file. */
export function saveSettings(settings: Settings): void {
  const target = settingsPath()
  const temporary = `${target}.tmp`
  try {
    writeFileSync(temporary, JSON.stringify(settings, null, 2), { mode: 0o600 })
    renameSync(temporary, target)
  } catch (error) {
    console.error('[settings] failed to save:', (error as Error).message)
  }
}
