import { screen, type Display, type WebContents } from 'electron'
import type { IpcChannel } from '@shared/ipc'
import type { DisplayChoice, DisplaySelection } from '../services/settings'
import { computeIslandGeometry, type ScreenNotch } from './geometry'
import { createIslandWindow, type IslandWindow } from './island'

/** The MacBook's own screen; the main display with the lid closed or on a desktop Mac. */
function defaultDisplay(connected: readonly Display[]): Display {
  return connected.find((display) => display.internal) ?? screen.getPrimaryDisplay()
}

/** Matches by id, or by name when that id is gone (the same monitor reconnected under a new id). */
function isChosen(display: Display, chosen: readonly DisplayChoice[], connected: readonly Display[]): boolean {
  return chosen.some(
    (choice) =>
      choice.id === display.id || (choice.name === display.label && !connected.some((d) => d.id === choice.id))
  )
}

/** The displays that get an island right now; never empty. */
export function resolveDisplays(selection: DisplaySelection): Display[] {
  const connected = screen.getAllDisplays()
  if (selection.all) return connected
  const picked = connected.filter((display) => isChosen(display, selection.chosen, connected))
  return picked.length > 0 ? picked : [defaultDisplay(connected)]
}

/** Menu name for a display. */
export function displayName(display: Display): string {
  return display.internal ? 'MacBook Display' : display.label || `Display ${display.id}`
}

/**
 * The selection after ticking or unticking one display in the menu, or null
 * when that would leave no island at all.
 */
export function toggleDisplay(selection: DisplaySelection, display: Display): DisplaySelection | null {
  const shown = resolveDisplays(selection)
  const next = shown.some((d) => d.id === display.id)
    ? shown.filter((d) => d.id !== display.id)
    : [...shown, display]
  if (next.length === 0) return null
  return { all: false, chosen: next.map((d) => ({ id: d.id, name: d.label })) }
}

export interface Islands {
  windows(): readonly IslandWindow[]
  /** The island whose page sent an IPC message, if it is one of ours. */
  fromSender(contents: WebContents): IslandWindow | undefined
  /** Sends to every island; each shows the same live data. */
  broadcast(channel: IpcChannel, payload: unknown): void
  selection(): DisplaySelection
  setSelection(selection: DisplaySelection): void
  /** Re-place after the helper reports new notch sizes. */
  refresh(): void
  dispose(): void
}

/**
 * One island window per chosen display. Windows never move between
 * displays: plugging a monitor in or out, or changing the choice, adds or
 * removes whole windows and re-places the rest.
 */
export function startIslands(
  initial: DisplaySelection,
  notches: () => ReadonlyMap<number, ScreenNotch>,
  /** After displays or the choice change; not for the first placement, which runs before the menu exists. */
  onChanged: () => void
): Islands {
  let selection = initial
  const islands = new Map<number, { island: IslandWindow; placedKey: string }>()

  const place = (): void => {
    const targets = resolveDisplays(selection)
    const targetIds = new Set(targets.map((display) => display.id))

    for (const [id, entry] of islands) {
      if (targetIds.has(id)) continue
      entry.island.dispose()
      islands.delete(id)
    }

    for (const display of targets) {
      const geometry = computeIslandGeometry(display, notches().get(display.id))
      const placedKey = JSON.stringify([display.bounds, display.workArea, geometry])
      const entry = islands.get(display.id)
      if (!entry) {
        islands.set(display.id, { island: createIslandWindow(display, geometry), placedKey })
      } else if (entry.placedKey !== placedKey) {
        entry.placedKey = placedKey
        entry.island.place(display, geometry)
      }
    }
  }
  const sync = (): void => {
    place()
    onChanged()
  }

  screen.on('display-added', sync)
  screen.on('display-removed', sync)
  screen.on('display-metrics-changed', sync)
  place()

  const windows = (): IslandWindow[] => [...islands.values()].map((entry) => entry.island)

  return {
    windows,
    fromSender: (contents) => windows().find((island) => island.window.webContents === contents),
    broadcast(channel, payload) {
      for (const island of windows()) {
        if (!island.window.isDestroyed()) island.window.webContents.send(channel, payload)
      }
    },
    selection: () => selection,
    setSelection(next) {
      selection = next
      sync()
    },
    refresh: sync,
    dispose() {
      screen.off('display-added', sync)
      screen.off('display-removed', sync)
      screen.off('display-metrics-changed', sync)
      for (const island of windows()) island.dispose()
      islands.clear()
    }
  }
}
