/** Unread counts shown on Dock icons, read by the native helper. */

export interface AppBadge {
  /** App name as shown in the Dock, e.g. "Mail". */
  app: string
  /** Absolute path to the .app bundle; used to open the app. */
  path: string
  /** Badge text exactly as the Dock shows it: "3", "99+", "•". */
  label: string
  /** Numeric value of the label, or null for non-numeric badges like "•". */
  count: number | null
  /** 64px PNG data URL of the app icon. */
  icon: string | null
}

export type BadgePermission =
  /** Helper not running yet (or not built). */
  | 'unknown'
  /** Accessibility permission not granted to MacIsland Helper. */
  | 'denied'
  | 'granted'

export interface NotificationState {
  permission: BadgePermission
  badges: AppBadge[]
}
