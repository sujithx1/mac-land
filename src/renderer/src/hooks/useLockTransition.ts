import { useEffect, useRef, useState } from 'react'
import type { LockState } from '../types/activity'

/** How long the green check shows after a successful unlock. */
const UNLOCKED_CHECK_MS = 650

/**
 * Watches lock phase changes: closes the island when it locks, and after a
 * successful unlock shows a check mark briefly before handing back.
 */
export function useLockTransition(
  phase: LockState['phase'],
  handlers: { onLocked: () => void; onUnlocked: () => void }
): { justUnlocked: boolean } {
  const [justUnlocked, setJustUnlocked] = useState(false)
  const previous = useRef(phase)
  const latestHandlers = useRef(handlers)
  latestHandlers.current = handlers

  useEffect(() => {
    const before = previous.current
    previous.current = phase

    if (phase === 'locked' && before === 'unlocked') latestHandlers.current.onLocked()
    if (phase !== 'unlocked' || before !== 'authenticating') return

    setJustUnlocked(true)
    const timer = window.setTimeout(() => {
      setJustUnlocked(false)
      latestHandlers.current.onUnlocked()
    }, UNLOCKED_CHECK_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  return { justUnlocked }
}
