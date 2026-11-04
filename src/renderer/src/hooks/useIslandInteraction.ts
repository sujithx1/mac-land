import { useCallback, useEffect, useReducer, useRef } from 'react'
import { bridge } from '../services/bridge'
import { initialInteraction, interactionReducer, islandMode } from '../services/island-interaction'
import type { IslandMode } from '../services/island-layout'

/** Grace period so brushing past the edge does not slam the panel shut. */
const COLLAPSE_DELAY_MS = 450

/**
 * Hover, expand and collapse for the island, plus click-through.
 * The host window ignores the mouse so clicks reach whatever is underneath;
 * while the pointer is over the island we ask main to accept input.
 * The window never takes focus, so the expanded panel closes when the
 * pointer moves away rather than on an outside click.
 */
export function useIslandInteraction(hasActivity: boolean): {
  mode: IslandMode
  hovering: boolean
  onPointerEnter: () => void
  onPointerLeave: () => void
  expand: () => void
} {
  const [state, dispatch] = useReducer(interactionReducer, initialInteraction)
  const collapseTimer = useRef<number | null>(null)

  const cancelCollapse = useCallback(() => {
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current)
    collapseTimer.current = null
  }, [])

  const onPointerEnter = useCallback(() => {
    cancelCollapse()
    dispatch({ type: 'pointer-enter' })
    bridge.setInteractive(true)
  }, [cancelCollapse])

  const onPointerLeave = useCallback(() => {
    dispatch({ type: 'pointer-leave' })
    bridge.setInteractive(false)
    cancelCollapse()
    collapseTimer.current = window.setTimeout(() => dispatch({ type: 'collapse' }), COLLAPSE_DELAY_MS)
  }, [cancelCollapse])

  const expand = useCallback(() => dispatch({ type: 'expand' }), [])

  // Never leave the window capturing clicks if the island unmounts mid-hover.
  useEffect(
    () => () => {
      cancelCollapse()
      bridge.setInteractive(false)
    },
    [cancelCollapse]
  )

  return { mode: islandMode(state, hasActivity), hovering: state.hovering, onPointerEnter, onPointerLeave, expand }
}
