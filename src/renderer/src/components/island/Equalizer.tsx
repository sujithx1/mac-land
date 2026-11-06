import { motion, useReducedMotion } from 'framer-motion'

interface EqualizerProps {
  playing: boolean
  color: string
}

/** Per-bar keyframes and timing, offset so the bars never move in lockstep. */
const BARS = [
  { heights: [0.35, 0.9, 0.5, 1, 0.4], duration: 1.1 },
  { heights: [0.8, 0.4, 1, 0.55, 0.85], duration: 0.9 },
  { heights: [0.5, 1, 0.35, 0.8, 0.6], duration: 1.25 },
  { heights: [0.9, 0.55, 0.75, 0.35, 1], duration: 1 }
] as const

export function Equalizer({ playing, color }: EqualizerProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const animate = playing && !reduceMotion

  return (
    <div aria-hidden className="flex h-3.5 items-center gap-[2.5px]">
      {BARS.map((bar, index) => (
        <motion.span
          key={index}
          className="block h-full w-[3px] rounded-full"
          style={{ backgroundColor: color, originY: 0.5 }}
          // `initial={false}` would jump a looping animation to its last keyframe and never start it,
          // so a bar that appears while music is already playing starts from its first height.
          initial={animate ? { scaleY: bar.heights[0] } : false}
          animate={animate ? { scaleY: [...bar.heights] } : { scaleY: playing ? 0.6 : 0.25 }}
          transition={
            animate
              ? { duration: bar.duration, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  )
}
