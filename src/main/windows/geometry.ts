import type { Display } from 'electron'
import type { IslandGeometry } from '@shared/ipc'

/**
 * The host window is a fixed transparent canvas sized for the largest island
 * state. The island animates inside it, so the native window never resizes
 * mid-animation (which is what makes window-resizing islands feel janky).
 */
const WINDOW_WIDTH = 720
const WINDOW_HEIGHT = 400

/**
 * Fallback until the helper reports exact screen data: notched MacBooks have
 * a taller menu bar (it matches the camera housing), plain displays ~24pt.
 */
const NOTCH_MENU_BAR_THRESHOLD = 30
const FALLBACK_NOTCH_WIDTH = 185

/** Camera housing size reported by the helper from NSScreen. */
export interface ScreenNotch {
  width: number
  height: number
}

export function menuBarHeightOf(display: Display): number {
  return Math.max(0, display.workArea.y - display.bounds.y)
}

/** `notch` is the helper's exact reading for this display, when available. */
export function computeIslandGeometry(display: Display, notch?: ScreenNotch): IslandGeometry {
  const menuBarHeight = menuBarHeightOf(display)
  const notchWidth = notch
    ? notch.width
    : display.internal && menuBarHeight >= NOTCH_MENU_BAR_THRESHOLD
      ? FALLBACK_NOTCH_WIDTH
      : 0

  return {
    variant: notchWidth > 0 ? 'notch' : 'floating',
    menuBarHeight,
    notchWidth,
    windowWidth: Math.min(WINDOW_WIDTH, display.bounds.width),
    windowHeight: Math.min(WINDOW_HEIGHT, display.bounds.height)
  }
}

/** Top-centre of the display, flush with the very top edge (over the menu bar). */
export function islandWindowBounds(display: Display, geometry: IslandGeometry): Electron.Rectangle {
  return {
    x: Math.round(display.bounds.x + (display.bounds.width - geometry.windowWidth) / 2),
    y: display.bounds.y,
    width: geometry.windowWidth,
    height: geometry.windowHeight
  }
}
