import type { AuthError, Biometry } from '@shared/lock'
import type { AppBadge } from '@shared/notifications'

export interface HelperScreen {
  id: number
  notchWidth: number
  notchHeight: number
}

export type HelperMessage =
  | { type: 'permission'; granted: boolean }
  | { type: 'badges'; badges: AppBadge[] }
  | { type: 'screens'; screens: HelperScreen[] }
  | { type: 'auth-capability'; biometry: Exclude<Biometry, 'unknown'> }
  | { type: 'auth-result'; id: string; success: boolean; error: AuthError | null }

const MAX_BADGES = 40
const MAX_SCREENS = 16
const MAX_ICON_LENGTH = 200_000
const ICON_PREFIX = 'data:image/png;base64,'
const AUTH_ERRORS: readonly AuthError[] = ['cancelled', 'failed', 'lockout', 'unavailable', 'busy', 'timeout']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : null

const points = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000 ? value : null

/** "12" -> 12, "99+" -> 99, "•" -> null */
function badgeCount(label: string): number | null {
  const match = /^(\d{1,5})\+?$/.exec(label.trim())
  return match ? Number(match[1]) : null
}

function parseBadge(value: unknown): AppBadge | null {
  if (!isRecord(value)) return null
  const app = text(value['app'], 120)
  const label = text(value['label'], 12)
  if (!app || !label) return null

  // Only real app bundles may be opened later.
  const rawPath = typeof value['path'] === 'string' ? value['path'] : ''
  const path = rawPath.startsWith('/') && rawPath.endsWith('.app') && rawPath.length <= 1024 ? rawPath : ''

  const rawIcon = value['icon']
  const icon =
    typeof rawIcon === 'string' && rawIcon.startsWith(ICON_PREFIX) && rawIcon.length <= MAX_ICON_LENGTH ? rawIcon : null

  return { app, path, label, count: badgeCount(label), icon }
}

function parseScreen(value: unknown): HelperScreen | null {
  if (!isRecord(value) || !Number.isSafeInteger(value['id'])) return null
  const notchWidth = points(value['notchWidth'])
  const notchHeight = points(value['notchHeight'])
  if (notchWidth === null || notchHeight === null) return null
  return { id: value['id'] as number, notchWidth, notchHeight }
}

/** Returns null for anything that is not a well-formed helper message. */
export function parseHelperMessage(line: string): HelperMessage | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (!isRecord(value)) return null

  switch (value['type']) {
    case 'permission':
      return typeof value['granted'] === 'boolean' ? { type: 'permission', granted: value['granted'] } : null
    case 'badges': {
      if (!Array.isArray(value['badges'])) return null
      const badges = value['badges']
        .slice(0, MAX_BADGES)
        .map(parseBadge)
        .filter((badge): badge is AppBadge => badge !== null)
      return { type: 'badges', badges }
    }
    case 'screens': {
      if (!Array.isArray(value['screens'])) return null
      const screens = value['screens']
        .slice(0, MAX_SCREENS)
        .map(parseScreen)
        .filter((screen): screen is HelperScreen => screen !== null)
      return { type: 'screens', screens }
    }
    case 'auth-capability': {
      const biometry = value['biometry']
      return biometry === 'touchID' || biometry === 'none' ? { type: 'auth-capability', biometry } : null
    }
    case 'auth-result': {
      const id = text(value['id'], 64)
      if (!id || typeof value['success'] !== 'boolean') return null
      const error = AUTH_ERRORS.find((known) => known === value['error']) ?? null
      return { type: 'auth-result', id, success: value['success'], error: value['success'] ? null : (error ?? 'failed') }
    }
    default:
      return null
  }
}
