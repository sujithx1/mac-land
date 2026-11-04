import type { MacIslandBridge } from '@shared/ipc'
import type { BrowserState } from '@shared/media'
import type { NotificationState } from '@shared/notifications'
import type { ActivitySource, IslandSnapshot } from '../../types/activity'

/**
 * Real data only. System readings, browser music/downloads and Dock badge
 * counts stream from the main process; nothing is shown that is not
 * actually happening.
 */
export function createLiveActivitySource(bridge: MacIslandBridge): ActivitySource {
  const listeners = new Set<() => void>()
  let disconnect: (() => void) | null = null
  let snapshot: IslandSnapshot = {
    nowPlaying: null,
    system: null,
    badges: [],
    badgePermission: 'unknown',
    transfers: []
  }

  const emit = (next: IslandSnapshot): void => {
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  const applyBrowserState = ({ nowPlaying, transfers }: BrowserState): void =>
    emit({ ...snapshot, nowPlaying, transfers })

  const applyNotifications = ({ permission, badges }: NotificationState): void =>
    emit({ ...snapshot, badgePermission: permission, badges })

  const connect = (): void => {
    const unsubscribeSystem = bridge.onSystemStats((system) => emit({ ...snapshot, system }))
    const unsubscribeBrowser = bridge.onBrowserState(applyBrowserState)
    const unsubscribeNotifications = bridge.onNotifications(applyNotifications)
    disconnect = () => {
      unsubscribeSystem()
      unsubscribeBrowser()
      unsubscribeNotifications()
    }

    bridge
      .getSystemStats()
      .then((stats) => {
        if (stats && !snapshot.system) emit({ ...snapshot, system: stats })
      })
      .catch((error: unknown) => console.error('Failed to read system stats:', error))
    bridge
      .getBrowserState()
      .then(applyBrowserState)
      .catch((error: unknown) => console.error('Failed to read browser state:', error))
    bridge
      .getNotifications()
      .then(applyNotifications)
      .catch((error: unknown) => console.error('Failed to read notifications:', error))
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      if (!disconnect) connect()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          disconnect?.()
          disconnect = null
        }
      }
    },
    togglePlayback: () => bridge.sendMediaCommand('toggle'),
    nextTrack: () => bridge.sendMediaCommand('next'),
    previousTrack: () => bridge.sendMediaCommand('previous'),
    openBadgeApp: (path) => bridge.openBadgeApp(path),
    openAccessibilitySettings: () => bridge.openAccessibilitySettings()
  }
}
