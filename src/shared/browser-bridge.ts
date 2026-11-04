/**
 * Wire protocol between the MacIsland browser extension and the app.
 * The extension's JavaScript is type-checked against these definitions.
 */

import type { MediaCommand } from './media'

/** Loopback only; the server never listens on a network interface. */
export const BRIDGE_HOST = '127.0.0.1'
export const BRIDGE_PORT = 47652

/**
 * Fixed by the public key in extension/manifest.json, so the app can accept
 * connections from this extension and nothing else (browsers set Origin on
 * WebSocket handshakes and pages cannot forge it).
 */
export const EXTENSION_ID = 'bnllnbannjccbcobfklfefafnlhmhphc'
export const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`

export const PROTOCOL_VERSION = 1

/** A playing (or paused) media element in one tab, as the content script sees it. */
export interface TabMedia {
  title: string
  artist: string
  album: string
  artworkUrl: string | null
  isPlaying: boolean
  position: number
  duration: number
  /** Site name, e.g. "YouTube". */
  site: string
}

export interface BrowserDownload {
  id: number
  name: string
  bytesReceived: number
  /** 0 when unknown. */
  totalBytes: number
  bytesPerSecond: number
  done: boolean
}

/** extension -> app */
export type ExtensionMessage =
  | { type: 'hello'; version: number; browser: string }
  | { type: 'media'; media: TabMedia | null }
  | { type: 'downloads'; downloads: BrowserDownload[] }
  | { type: 'ping' }

/** app -> extension */
export type AppMessage = { type: 'command'; command: MediaCommand }

/** content script <-> service worker, inside the extension */
export type ContentMessage = { type: 'media'; media: TabMedia | null }
export type WorkerMessage =
  | { type: 'command'; command: MediaCommand }
  /** Sent after the service worker restarts, which loses what tabs had reported. */
  | { type: 'report' }
