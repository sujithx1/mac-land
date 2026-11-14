/** App-level lock for MacIsland itself. Never touches the macOS login screen. */

export type Biometry =
  /** Helper not connected yet. */
  | 'unknown'
  | 'touchID'
  /** No Touch ID sensor (or none enrolled); macOS falls back to the account password. */
  | 'none'

export type AuthError = 'cancelled' | 'failed' | 'lockout' | 'unavailable' | 'busy' | 'timeout'

export type LockPhase = 'unlocked' | 'locked' | 'authenticating' | 'failed'

export interface LockState {
  phase: LockPhase
  biometry: Biometry
  /** Why the last attempt failed, while phase is 'failed'. */
  error: AuthError | null
}
