import type { MacIslandBridge } from '@shared/ipc'
import type { LockState } from '@shared/lock'
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
    // Safe default: the renderer holds no data until main sends it, and main
    // only sends what the lock allows. The real state arrives right away.
    lock: { phase: 'unlocked', biometry: 'unknown', error: null },
    transfers: []
  }

  const emit = (next: IslandSnapshot): void => {
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  const applyBrowserState = ({ nowPlaying, transfers }: BrowserState): void =>
    emit({ ...snapshot, nowPlaying, transfers })

  const applyNotifications = ({ badges }: NotificationState): void => emit({ ...snapshot, badges })

  const applyLock = (lock: LockState): void => emit({ ...snapshot, lock })

  const connect = (): void => {
    const unsubscribeSystem = bridge.onSystemStats((system) => emit({ ...snapshot, system }))
    const unsubscribeBrowser = bridge.onBrowserState(applyBrowserState)
    const unsubscribeNotifications = bridge.onNotifications(applyNotifications)
    const unsubscribeLock = bridge.onLockState(applyLock)
    disconnect = () => {
      unsubscribeSystem()
      unsubscribeBrowser()
      unsubscribeNotifications()
      unsubscribeLock()
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
    bridge
      .getLockState()
      .then(applyLock)
      .catch((error: unknown) => console.error('Failed to read lock state:', error))
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
    requestUnlock: () => bridge.requestUnlock()
  }
}
