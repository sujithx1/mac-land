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
 * Notched MacBooks report a taller menu bar (it matches the camera housing).
 * Non-notched displays sit around 24-25pt. This heuristic is replaced by
 * NSScreen.safeAreaInsets from the Swift helper in a later phase.
 */
const NOTCH_MENU_BAR_THRESHOLD = 30

/**
 * Camera housing width on current notched MacBook Pro/Air panels
 * (NSScreen.auxiliaryTopLeftArea/RightArea leave a 185pt gap).
 */
const NOTCH_WIDTH = 185

export function menuBarHeightOf(display: Display): number {
  return Math.max(0, display.workArea.y - display.bounds.y)
}

export function computeIslandGeometry(display: Display): IslandGeometry {
  const menuBarHeight = menuBarHeightOf(display)
  const hasNotch = display.internal && menuBarHeight >= NOTCH_MENU_BAR_THRESHOLD

  return {
    variant: hasNotch ? 'notch' : 'floating',
    menuBarHeight,
    notchWidth: hasNotch ? NOTCH_WIDTH : 0,
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
