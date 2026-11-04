import { motion, useReducedMotion } from 'framer-motion'
import { instant, tickTransition } from '../../services/motion'

interface ProgressBarProps {
  /** 0-1 */
  value: number
  color?: string
  label: string
  className?: string
}

export function ProgressBar({ value, color = '#fff', label, className = '' }: ProgressBarProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`h-1 overflow-hidden rounded-full bg-white/15 ${className}`}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={false}
        animate={{ width: `${percent}%` }}
        transition={reduceMotion ? instant : tickTransition}
      />
    </div>
  )
}
