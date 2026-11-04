import type { IslandGeometry } from '@shared/ipc'

export type IslandMode = 'idle' | 'compact' | 'expanded'

/** Resolved size and placement of the island for one state, in points. */
export interface IslandFrame {
  width: number
  height: number
  top: number
  topRadius: number
  bottomRadius: number
}

/** Concave corners joining a notch-style island to the top of the display. */
export const SHOULDER_RADIUS = 8

/** Size of the expanded panel below its header row. */
export const EXPANDED_WIDTH = 580
/** Body height with and without the notifications/transfers row. */
const EXPANDED_BODY_HEIGHT = { withActivityRow: 294, withoutActivityRow: 142 } as const
const EXPANDED_RADIUS = 30

/** Header height used when there is no menu bar/notch strip to align with. */
const FLOATING_HEADER_HEIGHT = 32
const FLOATING_TOP = 6

interface Size {
  width: number
  height: number
}

/** How much each state grows under the pointer. */
const HOVER_GROWTH: Record<Exclude<IslandMode, 'expanded'>, Size> = {
  idle: { width: 16, height: 4 },
  compact: { width: 12, height: 3 }
}

/** Width of each "ear" beside the hardware notch, per state. */
const NOTCH_EAR: Record<Exclude<IslandMode, 'expanded'>, number> = {
  idle: 17,
  compact: 46
}

const FLOATING_SIZE: Record<Exclude<IslandMode, 'expanded'>, Size> = {
  idle: { width: 168, height: 32 },
  compact: { width: 232, height: 34 }
}

/** Row at the top of the expanded panel that lines up with the menu bar. */
export function expandedHeaderHeight(geometry: IslandGeometry): number {
  return geometry.variant === 'notch' ? Math.max(geometry.menuBarHeight, 32) : FLOATING_HEADER_HEIGHT
}

/**
 * Pure layout rules for the island. Components animate between the frames
 * this returns; they never compute sizes themselves.
 */
export function islandFrame(
  geometry: IslandGeometry,
  mode: IslandMode,
  hovering: boolean,
  activityRow = true
): IslandFrame {
  const isNotch = geometry.variant === 'notch'

  if (mode === 'expanded') {
    const body = activityRow ? EXPANDED_BODY_HEIGHT.withActivityRow : EXPANDED_BODY_HEIGHT.withoutActivityRow
    return {
      width: EXPANDED_WIDTH,
      height: expandedHeaderHeight(geometry) + body,
      top: isNotch ? 0 : FLOATING_TOP,
      topRadius: isNotch ? 0 : EXPANDED_RADIUS,
      bottomRadius: EXPANDED_RADIUS
    }
  }

  const growth = hovering ? HOVER_GROWTH[mode] : { width: 0, height: 0 }

  if (isNotch) {
    // Match the menu bar so the island reads as an extension of the hardware notch.
    return {
      width: geometry.notchWidth + NOTCH_EAR[mode] * 2 + growth.width,
      height: expandedHeaderHeight(geometry) + growth.height,
      top: 0,
      topRadius: 0,
      bottomRadius: 13
    }
  }

  const height = FLOATING_SIZE[mode].height + growth.height
  return {
    width: FLOATING_SIZE[mode].width + growth.width,
    height,
    top: FLOATING_TOP,
    topRadius: height / 2,
    bottomRadius: height / 2
  }
}
