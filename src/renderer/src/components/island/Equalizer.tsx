import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { subscribeTicker } from '../../services/ticker'

interface EqualizerProps {
  playing: boolean
  color: string
}

/** Per-bar height range and speed, offset so the bars never move in lockstep. */
const BARS = [
  { low: 0.35, high: 1, period: 1.1, offset: 0 },
  { low: 0.4, high: 1, period: 0.9, offset: 1.3 },
  { low: 0.35, high: 1, period: 1.25, offset: 2.1 },
  { low: 0.35, high: 1, period: 1, offset: 0.6 }
] as const

const PAUSED = 0.25
const STILL = 0.6

/**
 * Four bars that bounce while music plays. They move on the shared 12 fps
 * ticker (see services/ticker.ts), like a real level meter, instead of a
 * 120 Hz loop.
 */
export function Equalizer({ playing, color }: EqualizerProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const animate = playing && !reduceMotion
  const bars = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const set = (index: number, scale: number): void => {
      const bar = bars.current[index]
      if (bar) bar.style.transform = `scaleY(${scale.toFixed(3)})`
    }
    if (!animate) {
      BARS.forEach((_, index) => set(index, playing ? STILL : PAUSED))
      return
    }
    return subscribeTicker((seconds) => {
      BARS.forEach(({ low, high, period, offset }, index) => {
        // Two waves per bar give an irregular, music-like bounce.
        const wave = (Math.sin(((seconds + offset) * Math.PI * 2) / period) + Math.sin((seconds + offset) * 7.3) * 0.35) / 1.35
        set(index, low + ((wave + 1) / 2) * (high - low))
      })
    })
  }, [animate, playing])

  return (
    <div aria-hidden className="flex h-3.5 items-center gap-[2.5px]">
      {BARS.map((_, index) => (
        <span
          key={index}
          ref={(element) => {
            bars.current[index] = element
          }}
          className="block h-full w-[3px] origin-center rounded-full transition-none"
          style={{ backgroundColor: color, transform: `scaleY(${playing ? STILL : PAUSED})` }}
        />
      ))}
    </div>
  )
}
