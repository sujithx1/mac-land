import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { subscribeTicker } from '../../services/ticker'
import type { CharacterProps } from './characters'

/**
 * Skyline, MacIsland's own building-climbing hero: navy suit with glowing teal
 * seams, a round helmet with one wide visor, gold grip pads on gloves and
 * boots, and a short orange scarf.
 *
 * Seen from the side, upside-down, crawling along the underside of the island
 * (the island's edge is y = 0 in drawing units) the way climbers cling to a
 * wall: body close to the surface, elbows and knees folded outward. Every hand
 * and foot is placed each frame: it stays planted while the body moves past
 * it, then lifts and reaches forward, in diagonal pairs. Elbows and knees come
 * from two-bone inverse kinematics, so the grip never slides. Poses come from
 * the shared 12 fps ticker; resting costs no repaints.
 */

/** Pixels per drawing unit. */
const SCALE = 1.35
/** Drawing extents: x from -24 to 22, y from -1 to 15. */
const VIEW = { x: -24, y: -1, w: 46, h: 16 }
const WIDTH = VIEW.w * SCALE
const HEIGHT = VIEW.h * SCALE
/** Mirror around the drawing's centre (x = -1) to face left. */
const FACE_LEFT = 'translate(-2 0) scale(-1 1)'

/** Crawl speed (points per second) and rests at each end. Slow, so 12 poses a second stay smooth. */
const SPEED = { idle: 9, dancing: 13 }
const REST_S = { idle: 4, dancing: 1.5 }
/** Distance (drawing units) the body travels per gait cycle, the share of it a limb is in the air, and how high it lifts. */
const STRIDE = 7
const SWING = 0.35
const LIFT = 2.2

/** Grapple drop when something happens (charger, headphones, Mac unlock). */
const DROP: Record<CharacterProps['mood'], number> = { idle: 0, dancing: 0, excited: 22, clinging: 0 }
const EXCITED_MS = 1500

const SUIT = '#1d2b53'
const SUIT_FAR = '#131d3a'
const SEAM = '#2ee6c5'
const GRIP = '#ffb020'
const GRIP_FAR = '#c7841a'
const SCARF = '#ff7a45'

interface LimbSpec {
  anchor: { x: number; y: number }
  /** Where the hand or foot rests along the wall. */
  neutral: number
  upper: number
  lower: number
  /** Gait offset: diagonal pairs move together. */
  offset: number
}

// The body hugs the wall and the limbs are long for the reach, so elbows and knees fold far out.
const LIMBS = {
  nearArm: { anchor: { x: 5.5, y: 2.4 }, neutral: 16, upper: 8.6, lower: 8.6, offset: 0 },
  farArm: { anchor: { x: 4.5, y: 2 }, neutral: 13, upper: 8.6, lower: 8.6, offset: 0.5 },
  nearLeg: { anchor: { x: -6.5, y: 2.6 }, neutral: -17, upper: 9.6, lower: 9.6, offset: 0.5 },
  farLeg: { anchor: { x: -5.5, y: 2.1 }, neutral: -19.5, upper: 9.6, lower: 9.6, offset: 0 }
} satisfies Record<string, LimbSpec>
type LimbName = keyof typeof LIMBS
interface LimbElements {
  upper: SVGPathElement | null
  lower: SVGPathElement | null
  tip: SVGCircleElement | null
}

/** Hand or foot position for gait phase 0..1, in body coordinates. */
function footAt(limb: LimbSpec, phase: number): { x: number; y: number } {
  const p = (((phase + limb.offset) % 1) + 1) % 1
  const reach = STRIDE * (1 - SWING)
  if (p < 1 - SWING) {
    // Planted: the body moves forward, so the grip slides back in body coordinates.
    return { x: limb.neutral + reach / 2 - reach * (p / (1 - SWING)), y: 0 }
  }
  const s = (p - (1 - SWING)) / SWING
  return { x: limb.neutral - reach / 2 + reach * s, y: LIFT * Math.sin(Math.PI * s) }
}

/** Two-bone IK: the elbow or knee that bends away from the wall. */
function jointFor(limb: LimbSpec, foot: { x: number; y: number }): { x: number; y: number } {
  const { anchor, upper, lower } = limb
  const dx = foot.x - anchor.x
  const dy = foot.y - anchor.y
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), upper + lower - 0.01))
  const base = Math.atan2(dy, dx)
  const bend = Math.acos(Math.min(1, Math.max(-1, (upper * upper + d * d - lower * lower) / (2 * upper * d))))
  const a = { x: anchor.x + upper * Math.cos(base + bend), y: anchor.y + upper * Math.sin(base + bend) }
  const b = { x: anchor.x + upper * Math.cos(base - bend), y: anchor.y + upper * Math.sin(base - bend) }
  return a.y > b.y ? a : b
}

const f = (n: number): string => n.toFixed(2)

/** The scarf's two flutter shapes (trailing back and away from the wall from the neck). */
const SCARF_SHAPES = ['M8.6 3.6Q6 6.4 3.4 8.4Q5.6 6 7.6 3.2Z', 'M8.6 3.6Q5.4 5.6 2.8 6.6Q5.2 5.2 7.6 3.2Z']

export function CrawlingHero({ mood, excitement, edgeWidth }: CharacterProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const [excited, setExcited] = useState(false)
  useEffect(() => {
    if (excitement === 0) return
    setExcited(true)
    const timer = window.setTimeout(() => setExcited(false), EXCITED_MS)
    return () => window.clearTimeout(timer)
  }, [excitement])
  const shown = excited && mood !== 'clinging' ? 'excited' : mood

  const moverRef = useRef<HTMLDivElement>(null)
  const facingRef = useRef<SVGGElement>(null)
  const bodyRef = useRef<SVGGElement>(null)
  const headRef = useRef<SVGGElement>(null)
  const scarfRef = useRef<SVGPathElement>(null)
  const limbRefs = useRef<Partial<Record<LimbName, LimbElements>>>({})
  const live = useRef({ shown, edgeWidth })
  live.current = { shown, edgeWidth }

  useEffect(() => {
    const last = new Map<Element, string>()
    const set = (element: Element | null | undefined, apply: (element: Element, value: string) => void, value: string): void => {
      if (!element || last.get(element) === value) return
      last.set(element, value)
      apply(element, value)
    }
    const attr = (name: string) => (element: Element, value: string) => element.setAttribute(name, value)

    const pose = (phase: number, moving: boolean): void => {
      for (const name of Object.keys(LIMBS) as LimbName[]) {
        const limb = LIMBS[name]
        const foot = moving ? footAt(limb, phase) : { x: limb.neutral, y: 0 }
        const joint = jointFor(limb, foot)
        const parts = limbRefs.current[name]
        set(parts?.upper, attr('d'), `M${f(limb.anchor.x)} ${f(limb.anchor.y)}L${f(joint.x)} ${f(joint.y)}`)
        set(parts?.lower, attr('d'), `M${f(joint.x)} ${f(joint.y)}L${f(foot.x)} ${f(foot.y)}`)
        set(parts?.tip, attr('transform'), `translate(${f(foot.x)} ${f(foot.y)})`)
      }
      // The body rises a touch as each pair pushes off; the scarf flutters while he moves.
      const bob = moving ? 0.35 * Math.sin(phase * Math.PI * 4) : 0
      set(bodyRef.current, attr('transform'), bob === 0 ? '' : `translate(0 ${f(bob)})`)
      set(headRef.current, attr('transform'), bob === 0 ? '' : `translate(0 ${f(bob)})`)
      set(scarfRef.current, attr('d'), SCARF_SHAPES[moving && Math.floor(phase * 4) % 2 === 1 ? 1 : 0]!)
    }

    // Standing pose straight away, also when motion is reduced.
    pose(0, false)
    if (reduceMotion) return

    let x = 0
    let direction = 1
    let restUntil = 0
    let travelled = 0
    let previous: number | null = null

    return subscribeTicker((t) => {
      const dt = previous === null ? 0 : Math.min(0.25, t - previous)
      previous = t
      const { shown: current, edgeWidth: width } = live.current
      const span = Math.max(0, width - WIDTH)
      const pace = current === 'dancing' ? 'dancing' : 'idle'

      let moving = false
      if (current === 'clinging') {
        // Hold on near the right end while the island is open.
        x = span
        direction = -1
      } else if (current !== 'excited' && t >= restUntil && dt > 0) {
        const step = SPEED[pace] * dt
        x += direction * step
        travelled += step / SCALE
        moving = true
        if (x >= span || x <= 0) {
          // Reached the end: rest, then turn around.
          x = Math.min(span, Math.max(0, x))
          direction = x >= span ? -1 : 1
          restUntil = t + REST_S[pace]
          moving = false
        }
      }
      x = Math.min(span, Math.max(0, x))

      set(moverRef.current, (element, value) => ((element as HTMLElement).style.transform = value), `translateX(${x.toFixed(1)}px)`)
      // Facing the way he crawls; while resting he already faces the way he will go next.
      set(facingRef.current, attr('transform'), direction < 0 ? FACE_LEFT : '')
      pose(travelled / STRIDE, moving)
    })
  }, [reduceMotion])

  const drop = DROP[shown]

  return (
    <div aria-hidden className="pointer-events-none relative h-0">
      <div ref={moverRef} className="absolute top-0 left-0" style={{ width: WIDTH }}>
        {/* Grapple line during a drop, from the edge to his back. */}
        <motion.div
          className="absolute top-0 w-px"
          style={{ left: WIDTH / 2, backgroundColor: SEAM, boxShadow: `0 0 3px ${SEAM}` }}
          initial={false}
          animate={{ height: drop === 0 ? 0 : drop + 6 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 14 }}
        />
        <motion.div
          initial={false}
          animate={{ y: drop }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 11 }}
        >
          <svg
            width={WIDTH}
            height={HEIGHT}
            viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
            className="block overflow-visible"
          >
            <g ref={facingRef}>
              {/* Far-side limbs, darker, behind the body. */}
              <Limb refs={limbRefs} name="farLeg" color={SUIT_FAR} tip={GRIP_FAR} width={2.5} />
              <Limb refs={limbRefs} name="farArm" color={SUIT_FAR} tip={GRIP_FAR} width={2.1} />

              <g ref={bodyRef}>
                <path ref={scarfRef} d={SCARF_SHAPES[0]} fill={SCARF} />
                {/* Torso with a glowing seam along the side and a gold harness belt. */}
                <ellipse cx={-0.5} cy={3.4} rx={8.4} ry={2.5} fill={SUIT} />
                <path d="M-8 3.6Q-3 5.6 6.8 3.8" fill="none" stroke={SEAM} strokeWidth={0.55} strokeLinecap="round" />
                <path d="M-5 1.1v4.6" stroke={GRIP} strokeWidth={1.3} strokeLinecap="round" />
                <path d="M2.4 2.4l1.3 1.4l-1.3 1.4l-1.3-1.4z" fill={SEAM} />
              </g>

              {/* Near-side limbs, in front, with gold grip pads. */}
              <Limb refs={limbRefs} name="nearLeg" color={SUIT} tip={GRIP} width={2.7} />
              <Limb refs={limbRefs} name="nearArm" color={SUIT} tip={GRIP} width={2.3} />

              {/* Helmet last: turned toward you, in front of the arm, with one wide glowing visor. */}
              <g ref={headRef}>
                <circle cx={11.6} cy={5.4} r={3.7} fill={SUIT} stroke={SUIT_FAR} strokeWidth={0.4} />
                <rect x={8.8} y={4.6} width={6.4} height={2.1} rx={1.05} fill={SEAM} />
                <rect x={9.6} y={4.9} width={2.2} height={0.6} rx={0.3} fill="#fff" opacity={0.75} />
                <circle cx={10.4} cy={3} r={0.9} fill="#fff" opacity={0.12} />
              </g>
            </g>
          </svg>
        </motion.div>
      </div>
    </div>
  )
}

/** One arm or leg: two segments and a round grip pad that the crawl moves each frame. */
function Limb({
  refs,
  name,
  color,
  tip,
  width
}: {
  refs: React.RefObject<Partial<Record<LimbName, LimbElements>>>
  name: LimbName
  color: string
  tip: string
  width: number
}): React.JSX.Element {
  const entry = (): LimbElements => (refs.current[name] ??= { upper: null, lower: null, tip: null })
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path ref={(element) => void (entry().upper = element)} stroke={color} strokeWidth={width} />
      <path ref={(element) => void (entry().lower = element)} stroke={color} strokeWidth={width * 0.9} />
      <circle ref={(element) => void (entry().tip = element)} r={width * 0.62} fill={tip} />
    </g>
  )
}
