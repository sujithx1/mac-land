import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { AuthError } from '@shared/lock'
import type { LockState } from '../types/activity'
import { contentEnter, contentExit, instant } from '../services/motion'
import { FaceIdGlyph, type FaceIdStage } from './island/FaceIdGlyph'

const RED = '#ff453a'
const GREEN = '#30d158'
/** How long the resting face shows before the scan starts, as on iPhone. */
const FACE_BEFORE_SCAN_MS = 450

function useFade(): Pick<React.ComponentProps<typeof motion.div>, 'initial' | 'animate' | 'exit'> {
  const reduceMotion = useReducedMotion()
  return {
    initial: { opacity: 0, filter: 'blur(4px)' },
    animate: { opacity: 1, filter: 'blur(0px)', transition: reduceMotion ? instant : contentEnter },
    exit: { opacity: 0, filter: 'blur(4px)', transition: reduceMotion ? instant : contentExit }
  }
}

/** The resting locked island: a padlock on one side, the Face ID glyph on the other. */
export function LockedCompact({ notchWidth }: { notchWidth: number }): React.JSX.Element {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-between px-3.5"
      {...useFade()}
    >
      <svg width={15} height={15} viewBox="0 0 22 22" aria-hidden>
        {/* The shackle drops into place as the island locks. */}
        <motion.path
          d="M7 10.5V7a4 4 0 0 1 8 0v3.5"
          fill="none"
          stroke="rgba(255,255,255,0.88)"
          strokeWidth={2.4}
          strokeLinecap="round"
          initial={reduceMotion ? false : { y: -3.5 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.12 }}
        />
        <rect x={3.5} y={10} width={15} height={11} rx={3} fill="rgba(255,255,255,0.88)" />
      </svg>

      <div style={{ width: notchWidth }} className="shrink-0" />

      <span className="grid place-items-center opacity-70">
        <FaceIdGlyph stage="face" size={16} />
      </span>
    </motion.div>
  )
}

const FAILURE_TEXT: Record<AuthError, string> = {
  failed: 'Not recognized',
  cancelled: 'Cancelled',
  lockout: 'Too many attempts',
  unavailable: 'Touch ID unavailable',
  busy: 'Try again',
  timeout: 'Timed out'
}

function caption(lock: LockState, stage: FaceIdStage): string {
  if (stage === 'success') return 'Unlocked'
  if (stage === 'failure') return FAILURE_TEXT[lock.error ?? 'failed']
  return lock.biometry === 'none' ? 'Enter your Mac password' : 'Touch ID to unlock'
}

interface FaceIdCardProps {
  lock: LockState
  /** True for a moment after a successful unlock, to play the check mark. */
  justUnlocked: boolean
  /** Height hidden behind the menu bar and notch; content stays below it. */
  topInset: number
}

/**
 * The island while unlocking, modelled on Face ID on iPhone. The look is
 * borrowed; the check itself is Touch ID (or the Mac password) via macOS.
 */
export function FaceIdCard({ lock, justUnlocked, topInset }: FaceIdCardProps): React.JSX.Element {
  const authenticating = lock.phase === 'authenticating'
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (!authenticating) {
      setScanning(false)
      return
    }
    const timer = window.setTimeout(() => setScanning(true), FACE_BEFORE_SCAN_MS)
    return () => window.clearTimeout(timer)
  }, [authenticating])

  const stage: FaceIdStage = justUnlocked
    ? 'success'
    : lock.phase === 'failed'
      ? 'failure'
      : scanning
        ? 'scan'
        : 'face'
  return <FaceIdView stage={stage} text={caption(lock, stage)} topInset={topInset} />
}

interface FaceIdViewProps {
  stage: FaceIdStage
  /** Shown under the glyph; empty keeps the space so the glyph does not move. */
  text: string
  topInset: number
}

/** The glyph and caption on the near-square Face ID card; green face and check once unlocked. */
export function FaceIdView({ stage, text, topInset }: FaceIdViewProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const success = stage === 'success'
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3"
      style={{ paddingTop: topInset }}
      {...useFade()}
    >
      <FaceIdGlyph stage={stage} size={58} color={success ? GREEN : stage === 'failure' ? RED : '#fff'} />
      <motion.span
        key={text}
        className={`flex items-center gap-1 text-[12px] font-medium tracking-[-0.01em] ${success ? '' : 'text-white/60'}`}
        style={success ? { color: GREEN } : {}}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {success && (
          <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
            <motion.path
              d="M3 8.5l3.2 3.2L13 5"
              stroke={GREEN}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduceMotion ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : 0.12, ease: 'easeOut' }}
            />
          </svg>
        )}
        {text || '\u00a0'}
      </motion.span>
    </motion.div>
  )
}
