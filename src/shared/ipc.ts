/**
 * Single source of truth for every IPC channel and payload shape.
 * Main, preload and renderer all import from here so a renamed channel
 * or changed payload is a compile error rather than a silent runtime bug.
 */

import type { LockState } from './lock'
import type { BrowserState, MediaCommand } from './media'
import type { NotificationState } from './notifications'
import type { SystemStats } from './system'

export const IpcChannel = {
  /** renderer -> main (send): toggle whether the island window accepts mouse input. */
  SetInteractive: 'island:set-interactive',
  /** renderer -> main (invoke): current island geometry. */
  GetGeometry: 'island:get-geometry',
  /** main -> renderer (push): geometry changed (resolution, display swap). */
  GeometryChanged: 'island:geometry-changed',
  /** renderer -> main (invoke): latest system readings, or null before the first sample. */
  GetSystemStats: 'system:get-stats',
  /** main -> renderer (push): new system readings. */
  SystemStatsChanged: 'system:stats-changed',
  /** renderer -> main (invoke): latest music and downloads from the browser extension. */
  GetBrowserState: 'browser:get-state',
  /** main -> renderer (push): music or downloads changed. */
  BrowserStateChanged: 'browser:state-changed',
  /** renderer -> main (send): play/pause/skip in the browser tab that is playing. */
  SendMediaCommand: 'browser:media-command',
  /** renderer -> main (invoke): Dock badge counts and permission state. */
  GetNotifications: 'notifications:get',
  /** main -> renderer (push): badge counts or permission changed. */
  NotificationsChanged: 'notifications:changed',
  /** renderer -> main (send): open an app that currently has a badge. */
  OpenBadgeApp: 'notifications:open-app',
  /** renderer -> main (send): open System Settings > Privacy > Accessibility. */
  OpenAccessibilitySettings: 'notifications:open-settings',
  /** renderer -> main (invoke): current lock state. */
  GetLockState: 'lock:get',
  /** main -> renderer (push): lock state changed. */
  LockStateChanged: 'lock:changed',
  /** renderer -> main (send): ask main to show Touch ID; the renderer cannot unlock itself. */
  RequestUnlock: 'lock:request-unlock'
} as const

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel]

/** How the island should present itself on the display it lives on. */
export type IslandVariant =
  /** Built-in display with a camera housing: the island grows out of the notch. */
  | 'notch'
  /** Any other display: the island floats just below the top edge as a pill. */
  | 'floating'

export interface IslandGeometry {
  variant: IslandVariant
  /** Height of the macOS menu bar on this display, in points. */
  menuBarHeight: number
  /** Width of the camera housing in points; 0 when the display has none. */
  notchWidth: number
  /** Width and height of the transparent host window, in points. */
  windowWidth: number
  windowHeight: number
}

/** The API the preload script exposes on `window.macIsland`. */
export interface MacIslandBridge {
  setInteractive(interactive: boolean): void
  getGeometry(): Promise<IslandGeometry>
  /** Returns an unsubscribe function. */
  onGeometryChanged(listener: (geometry: IslandGeometry) => void): () => void
  getSystemStats(): Promise<SystemStats | null>
  /** Returns an unsubscribe function. */
  onSystemStats(listener: (stats: SystemStats) => void): () => void
  getBrowserState(): Promise<BrowserState>
  /** Returns an unsubscribe function. */
  onBrowserState(listener: (state: BrowserState) => void): () => void
  sendMediaCommand(command: MediaCommand): void
  getNotifications(): Promise<NotificationState>
  /** Returns an unsubscribe function. */
  onNotifications(listener: (state: NotificationState) => void): () => void
  openBadgeApp(path: string): void
  openAccessibilitySettings(): void
  getLockState(): Promise<LockState>
  /** Returns an unsubscribe function. */
  onLockState(listener: (state: LockState) => void): () => void
  requestUnlock(): void
}
