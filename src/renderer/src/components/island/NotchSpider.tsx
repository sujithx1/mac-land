import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { subscribeTicker } from '../../services/ticker'

/**
 * What the spider is doing:
 * - idle:    sways gently on its thread, blinks, wiggles its legs
 * - dancing: music is playing; it swings and bobs faster
 * - excited: something just happened (charger, headphones, Mac unlocked); it drops and spins
 * - clinging: the island is open; it climbs up close to the edge
 */
export type SpiderMood = 'idle' | 'dancing' | 'excited' | 'clinging'

interface NotchSpiderProps {
  mood: SpiderMood
  /** Changes on every new event, so the same mood twice still replays the drop. */
  excitement: number
}

/** Thread length below the island's bottom edge, per mood. */
const THREAD: Record<SpiderMood, number> = { idle: 16, dancing: 20, excited: 46, clinging: 4 }
/** How long the excited drop lasts before it climbs back. */
const EXCITED_MS = 1400

const BODY = '#0b0b0f'
const RIM = 'rgba(255,255,255,0.38)'

/** Left legs as body point, knee, tip; the right ones are mirrored. */
const LEGS = ['M15 18Q8 11 4 13', 'M14 21Q7 17 2 20', 'M14 24Q7 25 3 29', 'M15 27Q10 31 7 35']
const mirror = (path: string): string =>
  path.replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${40 - Number(x)} ${y}`)

/**
 * Poses are set straight on the elements from the shared 12 fps ticker (see
 * services/ticker.ts), like a cartoon. While idle the spider mostly rests: it
 * blinks, and every few seconds it fidgets (a short sway and leg wiggle). In
 * between nothing changes, so the window does not repaint. It only moves
 * continuously while dancing, on the same ticks as the equalizer.
 */
const TAU = Math.PI * 2
/** Idle: a fidget of this length every FIDGET_EVERY_S seconds. */
const FIDGET_EVERY_S = 8
const FIDGET_S = 2.4
/** Seconds per full sway and per leg wiggle, idle and while dancing. */
const SWAY_PERIOD = { idle: 1.6, dancing: 1 }
const LEG_PERIOD = { idle: 1.2, dancing: 0.5 }
const BLINK_EVERY_S = 4.6
const BLINK_S = 0.15

/**
 * MacIsland's own little spider. It hangs on a thread from the bottom edge
 * of the island; the island positions it. It never takes clicks.
 */
export function NotchSpider({ mood, excitement }: NotchSpiderProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const [excited, setExcited] = useState(false)

  // Each new event replays the drop for a moment, then the spider climbs back.
  useEffect(() => {
    if (excitement === 0) return
    setExcited(true)
    const timer = window.setTimeout(() => setExcited(false), EXCITED_MS)
    return () => window.clearTimeout(timer)
  }, [excitement])

  const shown: SpiderMood = excited && mood !== 'clinging' ? 'excited' : mood

  const swayRef = useRef<HTMLDivElement>(null)
  const legsLeftRef = useRef<SVGGElement>(null)
  const legsRightRef = useRef<SVGGElement>(null)
  const eyesRef = useRef<SVGGElement>(null)
  const moodRef = useRef(shown)
  moodRef.current = shown

  useEffect(() => {
    if (reduceMotion) return
    // Only touch the DOM when a value really changes, so a resting spider costs no repaints.
    const last = new Map<Element, string>()
    const set = (element: Element | null, apply: (value: string) => void, value: string): void => {
      if (!element || last.get(element) === value) return
      last.set(element, value)
      apply(value)
    }
    return subscribeTicker((t) => {
      const sway = swayRef.current
      const left = legsLeftRef.current
      const right = legsRightRef.current
      const eyes = eyesRef.current
      if (!sway || !left || !right || !eyes) return
      const current = moodRef.current
      const dancing = current === 'dancing'
      // Idle: rest, with a fidget every few seconds that eases in and out. Holding on to the open island: keep still.
      const fidget = t % FIDGET_EVERY_S
      const strength = dancing ? 1 : current === 'idle' && fidget < FIDGET_S ? Math.sin((fidget / FIDGET_S) * Math.PI) : 0
      const pace = dancing ? 'dancing' : 'idle'

      const phase = Math.sin((t * TAU) / SWAY_PERIOD[pace])
      const angle = strength === 0 ? 0 : phase * (dancing ? 11 : 6) * strength
      const bob = dancing ? Math.abs(phase) * 3 : 0
      set(sway, (v) => (sway.style.transform = v), strength === 0 ? '' : `rotate(${angle.toFixed(1)}deg) translateY(${bob.toFixed(1)}px)`)

      const leg = strength === 0 ? 0 : Math.sin((t * TAU) / LEG_PERIOD[pace]) * 4.5 * strength
      set(left, (v) => left.setAttribute('transform', v), leg === 0 ? '' : `rotate(${leg.toFixed(1)} 15 22)`)
      set(right, (v) => right.setAttribute('transform', v), leg === 0 ? '' : `rotate(${(-leg).toFixed(1)} 25 22)`)

      const blinking = t % BLINK_EVERY_S > BLINK_EVERY_S - BLINK_S
      set(eyes, (v) => eyes.setAttribute('transform', v), blinking ? 'translate(0 20) scale(1 0.1) translate(0 -20)' : '')
    })
  }, [reduceMotion])

  return (
    // Swings from the top of the thread.
    <div ref={swayRef} aria-hidden className="pointer-events-none flex origin-top flex-col items-center">
      {/* The silk thread, from the island's edge down to the spider. */}
      <motion.div
        // Mid grey with a faint shadow, so the silk shows on light and dark wallpapers alike.
        className="w-px bg-[#a4a4ae] shadow-[0_0_1px_rgba(0,0,0,0.35)]"
        initial={false}
        animate={{ height: THREAD[shown] }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: shown === 'excited' ? 220 : 160, damping: shown === 'excited' ? 9 : 18 }}
      />
      <motion.svg
        width={34}
        height={34}
        viewBox="0 0 40 40"
        // Pulled up so the thread meets the top of the body (y 13.4 of 40).
        className="-mt-[10px] overflow-visible"
        initial={false}
        animate={{ rotate: shown === 'excited' && !reduceMotion ? 360 : 0 }}
        transition={shown === 'excited' ? { duration: 0.7, ease: 'easeInOut' } : { duration: 0 }}
      >
        <g ref={legsLeftRef} fill="none" strokeLinecap="round">
          {LEGS.map((d) => (
            <g key={d}>
              <path d={d} stroke={RIM} strokeWidth={2.8} />
              <path d={d} stroke={BODY} strokeWidth={1.7} />
            </g>
          ))}
        </g>
        <g ref={legsRightRef} fill="none" strokeLinecap="round">
          {LEGS.map(mirror).map((d) => (
            <g key={d}>
              <path d={d} stroke={RIM} strokeWidth={2.8} />
              <path d={d} stroke={BODY} strokeWidth={1.7} />
            </g>
          ))}
        </g>

        <ellipse cx={20} cy={22} rx={7.6} ry={8.6} fill={BODY} stroke={RIM} strokeWidth={0.9} />
        {/* A soft highlight, so the body reads as round. */}
        <ellipse cx={17.4} cy={17.6} rx={2.6} ry={1.6} fill="#fff" opacity={0.12} />

        <g ref={eyesRef}>
          <ellipse cx={17.1} cy={20.3} rx={2.5} ry={2.8} fill="#fff" />
          <ellipse cx={22.9} cy={20.3} rx={2.5} ry={2.8} fill="#fff" />
          <circle cx={17.5} cy={21} r={1.25} fill={BODY} />
          <circle cx={23.3} cy={21} r={1.25} fill={BODY} />
        </g>
        <path
          d={shown === 'excited' || shown === 'dancing' ? 'M17.8 25.2Q20 27.4 22.2 25.2' : 'M18.6 25.4Q20 26.3 21.4 25.4'}
          fill="none"
          stroke="#fff"
          strokeOpacity={0.85}
          strokeWidth={0.9}
          strokeLinecap="round"
        />
      </motion.svg>
    </div>
  )
}
