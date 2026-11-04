import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export const DISPLAY_PREFERENCES = ['builtin', 'main', 'follow-mouse'] as const
export type DisplayPreference = (typeof DISPLAY_PREFERENCES)[number]

export const DISPLAY_PREFERENCE_LABELS: Record<DisplayPreference, string> = {
  builtin: 'MacBook Display',
  main: 'Main Display',
  'follow-mouse': 'Display with Mouse Pointer'
}

export interface Settings {
  /** Which screen the island lives on. */
  display: DisplayPreference
  /** Kept across restarts so quitting MacIsland is not a way around the lock. */
  locked: boolean
  /** Lock MacIsland whenever the Mac's screen locks. */
  lockWhenMacLocks: boolean
}

const DEFAULTS: Settings = { display: 'builtin', locked: false, lockWhenMacLocks: false }

const settingsPath = (): string => join(app.getPath('userData'), 'settings.json')

/** Reads settings, keeping only known, valid values; anything else falls back to defaults. */
export function loadSettings(): Settings {
  try {
    const raw: unknown = JSON.parse(readFileSync(settingsPath(), 'utf8'))
    const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    const display = DISPLAY_PREFERENCES.find((value) => value === stored['display']) ?? DEFAULTS.display
    const flag = (key: 'locked' | 'lockWhenMacLocks'): boolean =>
      typeof stored[key] === 'boolean' ? stored[key] : DEFAULTS[key]
    return { display, locked: flag('locked'), lockWhenMacLocks: flag('lockWhenMacLocks') }
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
