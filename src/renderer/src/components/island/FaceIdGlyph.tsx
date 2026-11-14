import { motion, useReducedMotion, type Transition } from 'framer-motion'

/**
 * - face:    the resting glyph, corner brackets around a face
 * - scan:    the face fades and the brackets spin, like the iPhone while it looks at you
 * - success: the whole face returns, settling back to full size (shown in green)
 * - failure: the face returns with a flat mouth
 */
export type FaceIdStage = 'face' | 'scan' | 'success' | 'failure'

interface FaceIdGlyphProps {
  stage: FaceIdStage
  size: number
  color?: string
}

const BRACKETS = [
  'M6 20V14a8 8 0 0 1 8-8h6',
  'M44 6h6a8 8 0 0 1 8 8v6',
  'M58 44v6a8 8 0 0 1-8 8h-6',
  'M20 58h-6a8 8 0 0 1-8-8v-6'
]
const EYES = ['M22 22v5', 'M42 22v5']
const NOSE = 'M32 22v12h-3'
const SMILE = 'M23 42c5 5 13 5 18 0'
const FLAT_MOUTH = 'M24 44c5 0 11 0 16 0'

const spring: Transition = { type: 'spring', stiffness: 420, damping: 26 }
const spin: Transition = { rotate: { duration: 0.9, ease: 'linear', repeat: Infinity }, scale: spring }

/** Face ID style glyph, drawn as strokes so each part can animate on its own. */
export function FaceIdGlyph({ stage, size, color = '#fff' }: FaceIdGlyphProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const scanning = stage === 'scan'
  const showFace = stage !== 'scan'
  const quick: Transition = reduceMotion ? { duration: 0 } : spring

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke={color}
      strokeWidth={3.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ overflow: 'visible', transition: 'stroke 200ms ease' }}
    >
      <motion.g
        // A spin that is already running when the glyph appears must start from 0, not be skipped.
        initial={scanning && !reduceMotion ? { rotate: 0, scale: 0.82 } : false}
        animate={{
          rotate: scanning && !reduceMotion ? [0, 360] : 0,
          scale: scanning ? 0.82 : 1
        }}
        transition={scanning && !reduceMotion ? spin : quick}
      >
        {BRACKETS.map((d) => (
          <path key={d} d={d} />
        ))}
      </motion.g>

      <motion.g initial={false} animate={{ opacity: showFace ? 1 : 0, scale: showFace ? 1 : 0.7 }} transition={quick}>
        {EYES.map((d) => (
          <path key={d} d={d} />
        ))}
        <path d={NOSE} />
        <motion.path initial={false} animate={{ d: stage === 'failure' ? FLAT_MOUTH : SMILE }} transition={quick} />
      </motion.g>
    </svg>
  )
}
