import type { AppBadge, IslandSnapshot, Transfer } from '../types/activity'

export type CompactLead = 'artwork' | 'transfer' | 'notification' | 'none'

export interface CompactPresentation {
  lead: CompactLead
  /** Total unread across apps; non-numeric badges ("•") count as one. */
  notificationCount: number
  /** The app with the most unread, shown when notifications lead. */
  topBadge: AppBadge | null
  /** 0-1 across all active transfers. */
  transferProgress: number
}

/** 0-1, or null while the total size is unknown. */
export function transferFraction(transfer: Transfer): number | null {
  if (transfer.done) return 1
  return transfer.totalBytes > 0 ? Math.min(1, transfer.transferredBytes / transfer.totalBytes) : null
}

const SOURCE_ACCENTS: Record<string, string> = {
  YouTube: '#ff4e45',
  'YouTube Music': '#ff4e45',
  Spotify: '#1ed760',
  SoundCloud: '#ff7a1a',
  'Apple Music': '#fa2d48'
}

/** Tint for the equalizer and progress bar, from where the music is playing. */
export function sourceAccent(sourceApp: string): string {
  return SOURCE_ACCENTS[sourceApp] ?? '#ffffff'
}

function overallTransferProgress(transfers: readonly Transfer[]): number {
  const sized = transfers.filter((t) => t.totalBytes > 0)
  const total = sized.reduce((sum, t) => sum + t.totalBytes, 0)
  const done = sized.reduce((sum, t) => sum + Math.min(t.transferredBytes, t.totalBytes), 0)
  return total > 0 ? done / total : 0
}

export function unreadTotal(badges: readonly AppBadge[]): number {
  return badges.reduce((sum, badge) => sum + (badge.count ?? 1), 0)
}

/** Badges ordered by unread count, highest first. */
export function sortedBadges(badges: readonly AppBadge[]): AppBadge[] {
  return [...badges].sort((a, b) => (b.count ?? 1) - (a.count ?? 1))
}

/** "1", "42", "99+" */
export function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/** What the compact island shows, by priority: music, then transfers, then notifications. */
export function compactPresentation(snapshot: IslandSnapshot): CompactPresentation {
  const notificationCount = unreadTotal(snapshot.badges)
  const transferProgress = overallTransferProgress(snapshot.transfers)

  let lead: CompactLead = 'none'
  if (snapshot.nowPlaying?.isPlaying) lead = 'artwork'
  else if (snapshot.transfers.length > 0) lead = 'transfer'
  else if (notificationCount > 0) lead = 'notification'

  return { lead, notificationCount, topBadge: sortedBadges(snapshot.badges)[0] ?? null, transferProgress }
}

/** One-line summary of what the Mac is doing right now, for the expanded header. */
export function currentActivityLabel(snapshot: IslandSnapshot): string {
  const active = snapshot.transfers.filter((t) => !t.done)
  if (active.length > 0) {
    // Short enough for the strip beside the notch.
    const noun = active.every((t) => t.kind === 'download') ? 'download' : 'transfer'
    return `${active.length} ${noun}${active.length === 1 ? '' : 's'}`
  }
  if (snapshot.nowPlaying?.isPlaying) return `Playing in ${snapshot.nowPlaying.sourceApp}`
  const unread = unreadTotal(snapshot.badges)
  if (unread > 0) return `${unread} unread`
  return 'All quiet'
}
