/** Music and transfer data as the island consumes it. Produced by the main process. */

export interface Track {
  /** Stable for the same title + artist, so the UI can tell a new track from a progress tick. */
  id: string
  title: string
  artist: string
  album: string
  /** Seconds; 0 when unknown (live streams). */
  duration: number
  /** https URL of the cover or video thumbnail. */
  artworkUrl: string | null
}

export interface NowPlaying {
  track: Track
  isPlaying: boolean
  /** Seconds into the track. */
  position: number
  /** Where it is playing, e.g. "YouTube". */
  sourceApp: string
}

export type TransferKind = 'download' | 'file-copy'

export interface Transfer {
  id: string
  kind: TransferKind
  name: string
  /** 0 when the size is not known yet. */
  totalBytes: number
  transferredBytes: number
  bytesPerSecond: number
  done: boolean
}

export const MEDIA_COMMANDS = ['toggle', 'next', 'previous'] as const
export type MediaCommand = (typeof MEDIA_COMMANDS)[number]

/** Everything the browser extension currently knows about. */
export interface BrowserState {
  nowPlaying: NowPlaying | null
  transfers: Transfer[]
}
