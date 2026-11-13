import { motion, useReducedMotion } from 'framer-motion'
import type { InUse } from '../../types/activity'

/** Same colors as macOS and iPhone: green for a camera (which usually brings the mic), orange for the microphone alone. */
const CAMERA = '#30d158'
const MICROPHONE = '#ff9f0a'

export function inUseColor(inUse: InUse): string | null {
  if (inUse.camera) return CAMERA
  if (inUse.microphone) return MICROPHONE
  return null
}

export function inUseLabel(inUse: InUse): string {
  if (inUse.camera && inUse.microphone) return 'Camera and microphone in use'
  return inUse.camera ? 'Camera in use' : 'Microphone in use'
}

/** The dot itself; it pops in and out like the iPhone's. */
export function InUseDot({ color, label }: { color: string; label: string }): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  return (
    <motion.span
      role="img"
      aria-label={label}
      className="block size-1.5 rounded-full"
      style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}99` }}
      initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
    />
  )
}
