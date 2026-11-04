import type { AppBadge } from '@shared/notifications'

export type HelperMessage = { type: 'permission'; granted: boolean } | { type: 'badges'; badges: AppBadge[] }

const MAX_BADGES = 40
const MAX_ICON_LENGTH = 200_000
const ICON_PREFIX = 'data:image/png;base64,'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : null

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

/** Returns null for anything that is not a well-formed helper message. */
export function parseHelperMessage(line: string): HelperMessage | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (!isRecord(value)) return null

  if (value['type'] === 'permission' && typeof value['granted'] === 'boolean') {
    return { type: 'permission', granted: value['granted'] }
  }
  if (value['type'] === 'badges' && Array.isArray(value['badges'])) {
    const badges = value['badges']
      .slice(0, MAX_BADGES)
      .map(parseBadge)
      .filter((badge): badge is AppBadge => badge !== null)
    return { type: 'badges', badges }
  }
  return null
}
