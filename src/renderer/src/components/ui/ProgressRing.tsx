import { motion, useReducedMotion } from 'framer-motion'
import { instant, tickTransition } from '../../services/motion'

interface ProgressRingProps {
  /** 0-1 */
  value: number
  size: number
  stroke?: number
  color?: string
}

export function ProgressRing({ value, size, stroke = 2.5, color = '#fff' }: ProgressRingProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, value))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={false}
        animate={{ strokeDashoffset: circumference * (1 - clamped) }}
        transition={reduceMotion ? instant : tickTransition}
      />
    </svg>
  )
}
