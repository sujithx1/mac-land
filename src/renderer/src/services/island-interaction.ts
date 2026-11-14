import type { IslandMode } from './island-layout'

export interface InteractionState {
  expanded: boolean
  hovering: boolean
}

export type InteractionEvent =
  | { type: 'pointer-enter' }
  | { type: 'pointer-leave' }
  | { type: 'expand' }
  | { type: 'collapse' }
  /** Close immediately, even under the pointer (e.g. MacIsland was just locked). */
  | { type: 'force-collapse' }

export const initialInteraction: InteractionState = { expanded: false, hovering: false }

export function interactionReducer(state: InteractionState, event: InteractionEvent): InteractionState {
  switch (event.type) {
    case 'pointer-enter':
      return state.hovering ? state : { ...state, hovering: true }
    case 'pointer-leave':
      return state.hovering ? { ...state, hovering: false } : state
    case 'expand':
      return state.expanded ? state : { ...state, expanded: true }
    case 'collapse':
      // Never collapse out from under the pointer.
      return state.expanded && !state.hovering ? { ...state, expanded: false } : state
    case 'force-collapse':
      return state.expanded ? { ...state, expanded: false } : state
  }
}

export function islandMode(state: InteractionState, hasActivity: boolean): IslandMode {
  if (state.expanded) return 'expanded'
  return hasActivity ? 'compact' : 'idle'
}
