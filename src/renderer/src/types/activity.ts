import type { NowPlaying, Transfer } from '@shared/media'
import type { AppBadge, BadgePermission } from '@shared/notifications'
import type { SystemStats } from '@shared/system'

export type { BatteryStatus, SystemStats } from '@shared/system'
export type { NowPlaying, Track, Transfer, TransferKind } from '@shared/media'
export type { AppBadge, BadgePermission } from '@shared/notifications'

/**
 * Everything the island can display, as one immutable snapshot.
 * The main process (system monitor, browser extension bridge) produces
 * the data; components only ever read it.
 */
export interface IslandSnapshot {
  nowPlaying: NowPlaying | null
  /** Null until the first reading arrives from the main process. */
  system: SystemStats | null
  /** Unread counts from Dock icons. */
  badges: readonly AppBadge[]
  badgePermission: BadgePermission
  transfers: readonly Transfer[]
}

export interface IslandActions {
  togglePlayback(): void
  nextTrack(): void
  previousTrack(): void
  openBadgeApp(path: string): void
  openAccessibilitySettings(): void
}

export interface ActivitySource extends IslandActions {
  getSnapshot(): IslandSnapshot
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
}
