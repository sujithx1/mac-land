import { motion, useReducedMotion } from 'framer-motion'
import { Check, Fingerprint, KeyRound, Lock } from 'lucide-react'
import type { LockState } from '../types/activity'
import { contentEnter, contentExit, instant } from '../services/motion'

interface FaceLockProps {
  lock: LockState
  /** Briefly true after a successful unlock, to show the check mark. */
  justUnlocked: boolean
  /** Width hidden behind the hardware notch; content stays clear of it. */
  notchWidth: number
}

const GREEN = '#30d158'
const RED = '#ff453a'

/** The locked island: a lock on one side, the way to unlock on the other. */
export function FaceLock({ lock, justUnlocked, notchWidth }: FaceLockProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const authenticating = lock.phase === 'authenticating'
  const failed = lock.phase === 'failed'
  const UnlockIcon = lock.biometry === 'none' ? KeyRound : Fingerprint

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-between px-3.5"
      initial={{ opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)', transition: reduceMotion ? instant : contentEnter }}
      exit={{ opacity: 0, filter: 'blur(4px)', transition: reduceMotion ? instant : contentExit }}
    >
      <motion.span
        key={justUnlocked ? 'check' : 'lock'}
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        className="grid place-items-center"
      >
        {justUnlocked ? (
          <Check size={17} strokeWidth={3} style={{ color: GREEN }} />
        ) : (
          <Lock size={15} strokeWidth={2.4} style={{ color: failed ? RED : 'rgba(255,255,255,0.88)' }} />
        )}
      </motion.span>

      <div style={{ width: notchWidth }} className="shrink-0" />

      <motion.span
        className="grid place-items-center"
        animate={
          authenticating && !reduceMotion
            ? { opacity: [0.35, 1, 0.35], scale: [0.92, 1.05, 0.92] }
            : { opacity: justUnlocked ? 0 : 0.6, scale: 1 }
        }
        transition={authenticating ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <UnlockIcon size={16} strokeWidth={2} style={{ color: failed ? RED : '#fff' }} />
      </motion.span>
    </motion.div>
  )
}
