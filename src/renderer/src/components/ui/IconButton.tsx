import { motion, useReducedMotion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = {
  sm: { box: 'size-6', icon: 12 },
  md: { box: 'size-8', icon: 17 },
  lg: { box: 'size-10', icon: 22 }
} as const

export function IconButton({ icon: Icon, label, onClick, size = 'md', className = '' }: IconButtonProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const { box, icon } = SIZES[size]

  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      whileTap={reduceMotion ? {} : { scale: 0.86 }}
      className={`grid ${box} place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${className}`}
    >
      <Icon size={icon} strokeWidth={2} fill={size === 'lg' ? 'currentColor' : 'none'} />
    </motion.button>
  )
}
