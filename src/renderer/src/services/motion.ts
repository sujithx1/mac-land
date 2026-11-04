import type { Transition } from 'framer-motion'

/**
 * Spring tuned to feel like the iPhone Dynamic Island: quick to respond,
 * a hint of overshoot, settles without wobble.
 */
export const islandSpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.9
}

/** Content fades in once the shape has mostly opened, and leaves fast. */
export const contentEnter: Transition = { duration: 0.28, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }
export const contentExit: Transition = { duration: 0.12, ease: 'easeIn' }

/** Live values tick once a second; glide between them instead of jumping. */
export const tickTransition: Transition = { duration: 1, ease: 'linear' }

export const instant: Transition = { duration: 0 }
