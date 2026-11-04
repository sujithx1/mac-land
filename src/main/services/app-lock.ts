import type { BrowserState } from '@shared/media'
import type { Biometry, LockState } from '@shared/lock'
import type { NotificationState } from '@shared/notifications'
import type { AuthOutcome } from './native-helper'

/** Shown in the system sheet as "MacIsland Helper is trying to unlock MacIsland." */
const UNLOCK_REASON = 'unlock MacIsland'
/** How long the failure state shows before returning to locked. */
const FAILED_VISIBLE_MS = 1500

export interface AppLock {
  state(): LockState
  isLocked(): boolean
  lock(): void
  /** Resolves true once unlocked; false if the user cancelled or failed. */
  unlock(): Promise<boolean>
  setBiometry(biometry: Biometry): void
  dispose(): void
}

interface AppLockOptions {
  initiallyLocked: boolean
  authenticate(reason: string): Promise<AuthOutcome>
  onChange(state: LockState): void
  /** Fires only when locked/unlocked flips, e.g. to persist it and re-send data. */
  onLockedChanged(locked: boolean): void
}

/**
 * App-level lock for MacIsland's own content. Lives in the main process so
 * the renderer can never unlock itself; it only ever asks.
 */
export function createAppLock(options: AppLockOptions): AppLock {
  let state: LockState = { phase: options.initiallyLocked ? 'locked' : 'unlocked', biometry: 'unknown', error: null }
  let failedTimer: NodeJS.Timeout | null = null

  const set = (next: Partial<LockState>): void => {
    const wasLocked = state.phase !== 'unlocked'
    state = { ...state, ...next }
    options.onChange(state)
    const isLocked = state.phase !== 'unlocked'
    if (wasLocked !== isLocked) options.onLockedChanged(isLocked)
  }

  return {
    state: () => state,
    isLocked: () => state.phase !== 'unlocked',
    lock() {
      if (state.phase === 'unlocked') set({ phase: 'locked', error: null })
    },
    async unlock() {
      if (state.phase === 'unlocked') return true
      if (state.phase === 'authenticating') return false
      if (failedTimer) clearTimeout(failedTimer)

      set({ phase: 'authenticating', error: null })
      const outcome = await options.authenticate(UNLOCK_REASON)
      if (outcome.success) {
        set({ phase: 'unlocked', error: null })
        return true
      }
      if (outcome.error === 'cancelled') {
        set({ phase: 'locked', error: null })
        return false
      }
      set({ phase: 'failed', error: outcome.error })
      failedTimer = setTimeout(() => {
        if (state.phase === 'failed') set({ phase: 'locked', error: null })
      }, FAILED_VISIBLE_MS)
      return false
    },
    setBiometry(biometry) {
      if (biometry !== state.biometry) set({ biometry })
    },
    dispose() {
      if (failedTimer) clearTimeout(failedTimer)
    }
  }
}

/** What the renderer may see of browser data while locked: nothing. */
export function visibleBrowserState(state: BrowserState, locked: boolean): BrowserState {
  return locked ? { nowPlaying: null, transfers: [] } : state
}

/** Keeps the permission status (so setup still works) but hides every badge while locked. */
export function visibleNotifications(state: NotificationState, locked: boolean): NotificationState {
  return locked ? { permission: state.permission, badges: [] } : state
}
