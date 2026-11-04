import type { IslandGeometry, MacIslandBridge } from '@shared/ipc'

/** Used when the renderer is opened in a normal browser for design work. */
const browserPreviewGeometry: IslandGeometry = {
  variant: 'notch',
  menuBarHeight: 33,
  notchWidth: 185,
  windowWidth: 720,
  windowHeight: 400
}

const browserPreviewBridge: MacIslandBridge = {
  setInteractive: () => undefined,
  getGeometry: () => Promise.resolve(browserPreviewGeometry),
  onGeometryChanged: () => () => undefined,
  getSystemStats: () => Promise.resolve(null),
  onSystemStats: () => () => undefined,
  getBrowserState: () => Promise.resolve({ nowPlaying: null, transfers: [] }),
  onBrowserState: () => () => undefined,
  sendMediaCommand: () => undefined,
  getNotifications: () => Promise.resolve({ permission: 'unknown', badges: [] }),
  onNotifications: () => () => undefined,
  openBadgeApp: () => undefined,
  openAccessibilitySettings: () => undefined,
  getLockState: () => Promise.resolve({ phase: 'unlocked', biometry: 'unknown', error: null }),
  onLockState: () => () => undefined,
  requestUnlock: () => undefined
}

export const bridge: MacIslandBridge = window.macIsland ?? browserPreviewBridge
