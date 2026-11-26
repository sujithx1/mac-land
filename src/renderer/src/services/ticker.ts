/**
 * One shared, low frame-rate clock for the island's looping animations (the
 * equalizer bars and the spider), drawn like a cartoon at 12 poses a second.
 *
 * Endless CSS or Framer Motion loops make Chromium repaint the transparent
 * island window at the display's full refresh rate (120 Hz on ProMotion),
 * which cost about a third of a CPU core for the equalizer alone. Here every
 * subscriber updates its elements directly on the same tick, so each window
 * repaints at most 12 times a second, and not at all while nothing loops.
 */

export const TICK_FPS = 12

type Tick = (seconds: number) => void

const subscribers = new Set<Tick>()
let timer: number | undefined
const started = performance.now()

function tick(): void {
  const seconds = (performance.now() - started) / 1000
  subscribers.forEach((subscriber) => subscriber(seconds))
}

/** Calls `onTick` with seconds since the island loaded, 12 times a second. Returns an unsubscribe function. */
export function subscribeTicker(onTick: Tick): () => void {
  subscribers.add(onTick)
  if (timer === undefined) timer = window.setInterval(tick, 1000 / TICK_FPS)
  onTick((performance.now() - started) / 1000)
  return () => {
    subscribers.delete(onTick)
    if (subscribers.size === 0 && timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  }
}
