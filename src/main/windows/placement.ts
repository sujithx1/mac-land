import { screen, type Display } from 'electron'
import type { DisplayPreference } from '../services/settings'
import { computeIslandGeometry, type ScreenNotch } from './geometry'
import type { IslandWindow } from './island'

const FOLLOW_POLL_MS = 250
/**
 * The pointer must rest on another display this long before the island
 * follows, so skimming across a screen edge does not make it flicker and an
 * open panel has time to collapse first.
 */
const FOLLOW_SETTLE_MS = 600

export function resolveDisplay(preference: DisplayPreference): Display {
  switch (preference) {
    case 'builtin':
      // Lid closed (clamshell) or a desktop Mac: fall back to the main display.
      return screen.getAllDisplays().find((display) => display.internal) ?? screen.getPrimaryDisplay()
    case 'main':
      return screen.getPrimaryDisplay()
    case 'follow-mouse':
      return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  }
}

export interface IslandPlacement {
  preference(): DisplayPreference
  setPreference(preference: DisplayPreference): void
  /** Re-evaluate after the helper reports new screen data. */
  refresh(): void
  dispose(): void
}

/**
 * Keeps the island on the right display: reacts to displays being added,
 * removed or rearranged, and follows the pointer when asked to.
 */
export function startIslandPlacement(
  island: IslandWindow,
  initial: DisplayPreference,
  notches: () => ReadonlyMap<number, ScreenNotch>
): IslandPlacement {
  let preference = initial
  let placedKey = ''
  let placedDisplayId: number | null = null
  let pending: { displayId: number; since: number } | null = null

  const place = (display: Display): void => {
    const geometry = computeIslandGeometry(display, notches().get(display.id))
    const key = JSON.stringify([display.id, display.bounds, display.workArea, geometry])
    if (key === placedKey) return
    placedKey = key
    placedDisplayId = display.id
    island.place(display, geometry)
  }

  const apply = (): void => {
    pending = null
    place(resolveDisplay(preference))
  }

  screen.on('display-added', apply)
  screen.on('display-removed', apply)
  screen.on('display-metrics-changed', apply)

  const follow = setInterval(() => {
    // Never move the island out from under the pointer.
    if (preference !== 'follow-mouse' || island.isInteractive()) return
    const target = resolveDisplay('follow-mouse')
    if (target.id === placedDisplayId) {
      pending = null
      return
    }
    const now = Date.now()
    if (pending?.displayId !== target.id) pending = { displayId: target.id, since: now }
    else if (now - pending.since >= FOLLOW_SETTLE_MS) apply()
  }, FOLLOW_POLL_MS)

  apply()

  return {
    preference: () => preference,
    setPreference(next) {
      preference = next
      apply()
    },
    refresh: apply,
    dispose() {
      clearInterval(follow)
      screen.off('display-added', apply)
      screen.off('display-removed', apply)
      screen.off('display-metrics-changed', apply)
    }
  }
}
