import type { IslandGeometry } from '@shared/ipc'

export type IslandMode = 'idle' | 'compact' | 'expanded'
/**
 * Every shape the island can take: the interaction modes, the Face ID card
 * shown while unlocking, and the wide strip for a charger or headphones alert.
 */
export type IslandShape = IslandMode | 'face-id' | 'alert'

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
export const EXPANDED_WIDTH = 460
/** Music row plus padding: a track with controls, or the shorter "Not Playing" row. */
const EXPANDED_MUSIC_HEIGHT = { playing: 142, idle: 89 } as const
const EXPANDED_RADIUS = 30

/** What the notifications/transfers row below the music has to show. */
export interface ActivityRowContent {
  badges: number
  transfers: number
}

/** Rows listed per section; the rest are summarised. */
export const ACTIVITY_VISIBLE_ROWS = 2

/**
 * Fixed heights of the activity row's parts. The components use matching
 * fixed sizes, so the island can open straight to the right height.
 */
export const ACTIVITY_ROW = {
  divider: 25,
  label: 24,
  item: 40,
  badgeGap: 2,
  more: 16,
  transferGap: 8
} as const

export function showsNotifications(content: ActivityRowContent): boolean {
  return content.badges > 0
}

/** Everything the expanded panel shows below its header. */
export interface PanelContent extends ActivityRowContent {
  hasTrack: boolean
}

/** Height of the expanded panel below its header, from what it has to show. */
export function expandedBodyHeight(content: PanelContent): number {
  return (content.hasTrack ? EXPANDED_MUSIC_HEIGHT.playing : EXPANDED_MUSIC_HEIGHT.idle) + activityRowHeight(content)
}

/** Height the activity row adds to the expanded panel; 0 when there is nothing to show. */
export function activityRowHeight(content: ActivityRowContent): number {
  const notifications = showsNotifications(content)
  const transfers = Math.min(content.transfers, ACTIVITY_VISIBLE_ROWS)
  if (!notifications && transfers === 0) return 0

  let notificationsHeight = 0
  if (notifications) {
    const shown = Math.min(content.badges, ACTIVITY_VISIBLE_ROWS)
    const more = content.badges > shown ? ACTIVITY_ROW.badgeGap + ACTIVITY_ROW.more : 0
    notificationsHeight = shown * ACTIVITY_ROW.item + (shown - 1) * ACTIVITY_ROW.badgeGap + more
  }
  const transfersHeight = transfers > 0 ? transfers * ACTIVITY_ROW.item + (transfers - 1) * ACTIVITY_ROW.transferGap : 0

  return ACTIVITY_ROW.divider + ACTIVITY_ROW.label + Math.max(notificationsHeight, transfersHeight)
}

/** The near-square card shown while unlocking, like Face ID on iPhone. */
const FACE_ID_WIDTH = 210
const FACE_ID_EAR = 14
const FACE_ID_BODY_HEIGHT = 150
const FACE_ID_RADIUS = 42

/** The charger/headphones alert: the compact island stretched wide, like iPhone. Each ear fits "Sujith's AirPods Pro". */
const ALERT_NOTCH_EAR = 160
const ALERT_FLOATING_SIZE = { width: 300, height: 36 }

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
  mode: IslandShape,
  hovering: boolean,
  /** Expanded panel height below the header, from expandedBodyHeight(). */
  bodyHeight: number = EXPANDED_MUSIC_HEIGHT.playing
): IslandFrame {
  const isNotch = geometry.variant === 'notch'

  if (mode === 'face-id') {
    return isNotch
      ? {
          // Wide enough to wrap the camera housing; the glyph sits below it.
          width: Math.max(FACE_ID_WIDTH, geometry.notchWidth + FACE_ID_EAR * 2),
          height: expandedHeaderHeight(geometry) + FACE_ID_BODY_HEIGHT,
          top: 0,
          topRadius: 0,
          bottomRadius: FACE_ID_RADIUS
        }
      : {
          width: FACE_ID_WIDTH,
          height: FACE_ID_WIDTH,
          top: FLOATING_TOP,
          topRadius: FACE_ID_RADIUS,
          bottomRadius: FACE_ID_RADIUS
        }
  }

  if (mode === 'alert') {
    if (isNotch) {
      return {
        width: geometry.notchWidth + ALERT_NOTCH_EAR * 2,
        height: expandedHeaderHeight(geometry),
        top: 0,
        topRadius: 0,
        bottomRadius: 16
      }
    }
    return {
      ...ALERT_FLOATING_SIZE,
      top: FLOATING_TOP,
      topRadius: ALERT_FLOATING_SIZE.height / 2,
      bottomRadius: ALERT_FLOATING_SIZE.height / 2
    }
  }

  if (mode === 'expanded') {
    return {
      width: EXPANDED_WIDTH,
      height: expandedHeaderHeight(geometry) + bodyHeight,
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
