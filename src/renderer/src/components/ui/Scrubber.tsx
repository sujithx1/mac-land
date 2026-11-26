import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, type Transition } from 'framer-motion'
import { formatDuration } from '../../services/format'
import { instant, tickTransition } from '../../services/motion'

interface ScrubberProps {
  /** Seconds into the track, as last reported by the browser. */
  position: number
  /** Seconds; 0 for live streams, which cannot be scrubbed. */
  duration: number
  color: string
  label: string
  onSeek(position: number): void
}

/** Arrow keys move this far, like the 5 s skip in most players. */
const KEY_STEP_S = 5
/** After a seek, hold the new position until the browser reports one close to it. */
const SEEK_SETTLE_MS = 2500
const SEEK_MATCH = 0.02

const clamp = (value: number): number => Math.min(1, Math.max(0, value))

/**
 * Progress bar you can tap or drag to seek, like the Now Playing scrubber on
 * iPhone: it thickens and shows a knob under the pointer, and the times
 * below follow the drag.
 */
export function Scrubber({ position, duration, color, label, onSeek }: ScrubberProps): React.JSX.Element {
  const reduceMotion = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [pending, setPending] = useState<{ fraction: number; at: number } | null>(null)
  const [hovering, setHovering] = useState(false)
  const seekable = duration > 0
  const reported = seekable ? clamp(position / duration) : 0

  // Drop the held position once the browser has caught up (or never does).
  useEffect(() => {
    if (!pending) return
    if (Math.abs(reported - pending.fraction) < SEEK_MATCH) {
      setPending(null)
      return
    }
    const timer = window.setTimeout(() => setPending(null), Math.max(0, pending.at + SEEK_SETTLE_MS - Date.now()))
    return () => window.clearTimeout(timer)
  }, [pending, reported])

  const fraction = dragging ?? pending?.fraction ?? reported
  const shownPosition = fraction * duration
  const active = seekable && (hovering || dragging !== null)

  const fractionAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    return rect && rect.width > 0 ? clamp((clientX - rect.left) / rect.width) : fraction
  }

  const commit = (next: number): void => {
    setPending({ fraction: next, at: Date.now() })
    onSeek(next * duration)
  }

  const fill: Transition = reduceMotion || dragging !== null ? instant : pending ? { duration: 0.2 } : tickTransition

  return (
    <div>
      <div
        role={seekable ? 'slider' : 'progressbar'}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shownPosition)}
        aria-valuetext={formatDuration(shownPosition)}
        tabIndex={seekable ? 0 : -1}
        // A taller hit area than the 4 px bar, without changing the layout.
        className={`-my-1.5 py-1.5 focus-visible:outline-none ${seekable ? 'cursor-pointer' : ''}`}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onPointerDown={(event) => {
          if (!seekable || event.button !== 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          setDragging(fractionAt(event.clientX))
        }}
        onPointerMove={(event) => {
          if (dragging !== null) setDragging(fractionAt(event.clientX))
        }}
        onPointerUp={(event) => {
          if (dragging === null) return
          commit(fractionAt(event.clientX))
          setDragging(null)
        }}
        onPointerCancel={() => setDragging(null)}
        onKeyDown={(event) => {
          if (!seekable || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
          event.preventDefault()
          const step = (event.key === 'ArrowRight' ? KEY_STEP_S : -KEY_STEP_S) / duration
          commit(clamp(fraction + step))
        }}
      >
        {/* A fixed 4 px slot; the bar grows around its centre so nothing below moves. */}
        <div ref={trackRef} className="relative h-1">
          <motion.div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-white/15"
            initial={false}
            animate={{ height: active ? 7 : 4 }}
            transition={reduceMotion ? instant : { type: 'spring', stiffness: 500, damping: 32 }}
          >
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={false}
                animate={{ width: `${fraction * 100}%` }}
                transition={fill}
              />
            </div>
            {/* The knob sits on the end of the fill while the bar is being used. */}
            <motion.div
              aria-hidden
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
              initial={false}
              animate={{ left: `${fraction * 100}%`, scale: active ? 1 : 0, opacity: active ? 1 : 0 }}
              transition={reduceMotion ? instant : { left: fill, default: { type: 'spring', stiffness: 500, damping: 30 } }}
            />
          </motion.div>
        </div>
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-white/40 tabular-nums">
        <span className={dragging !== null ? 'text-white/80' : ''}>{formatDuration(shownPosition)}</span>
        <span>{seekable ? `-${formatDuration(duration - shownPosition)}` : 'Live'}</span>
      </div>
    </div>
  )
}
