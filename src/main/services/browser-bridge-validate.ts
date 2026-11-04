import type { BrowserDownload, ExtensionMessage, TabMedia } from '@shared/browser-bridge'

/**
 * The extension is trusted, but what it relays comes from web pages, so
 * every field is type-checked, bounded and normalised before use.
 */

const MAX_DOWNLOADS = 50

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' ? value.trim().slice(0, max) : null
}

function amount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** Only https artwork is shown; anything else (http, data:, blob:, file:) is dropped. */
function artworkUrl(value: unknown): string | null {
  const raw = text(value, 2048)
  if (!raw) return null
  try {
    return new URL(raw).protocol === 'https:' ? raw : null
  } catch {
    return null
  }
}

function parseTabMedia(value: unknown): TabMedia | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const title = text(value['title'], 300)
  const position = amount(value['position'])
  const duration = amount(value['duration'])
  if (!title || position === null || duration === null || typeof value['isPlaying'] !== 'boolean') return undefined

  return {
    title,
    artist: text(value['artist'], 200) ?? '',
    album: text(value['album'], 200) ?? '',
    artworkUrl: artworkUrl(value['artworkUrl']),
    isPlaying: value['isPlaying'],
    position: duration > 0 ? Math.min(position, duration) : position,
    duration,
    site: text(value['site'], 40) || 'Browser'
  }
}

function parseDownload(value: unknown): BrowserDownload | null {
  if (!isRecord(value) || !Number.isSafeInteger(value['id'])) return null
  const name = text(value['name'], 260)
  const bytesReceived = amount(value['bytesReceived'])
  const totalBytes = amount(value['totalBytes'])
  const bytesPerSecond = amount(value['bytesPerSecond'])
  if (!name || bytesReceived === null || totalBytes === null || bytesPerSecond === null) return null
  if (typeof value['done'] !== 'boolean') return null
  return { id: value['id'] as number, name, bytesReceived, totalBytes, bytesPerSecond, done: value['done'] }
}

/** Returns null for anything that is not a well-formed protocol message. */
export function parseExtensionMessage(raw: string): ExtensionMessage | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(value)) return null

  switch (value['type']) {
    case 'ping':
      return { type: 'ping' }
    case 'hello': {
      const version = value['version']
      if (typeof version !== 'number') return null
      return { type: 'hello', version, browser: text(value['browser'], 40) || 'Browser' }
    }
    case 'media': {
      const media = parseTabMedia(value['media'])
      return media === undefined ? null : { type: 'media', media }
    }
    case 'downloads': {
      if (!Array.isArray(value['downloads'])) return null
      const downloads = value['downloads']
        .slice(0, MAX_DOWNLOADS)
        .map(parseDownload)
        .filter((download): download is BrowserDownload => download !== null)
      return { type: 'downloads', downloads }
    }
    default:
      return null
  }
}
