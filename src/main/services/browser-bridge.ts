import { WebSocketServer, type WebSocket } from 'ws'
import {
  BRIDGE_HOST,
  BRIDGE_PORT,
  EXTENSION_ORIGIN,
  PROTOCOL_VERSION,
  type AppMessage,
  type BrowserDownload,
  type TabMedia
} from '@shared/browser-bridge'
import type { BrowserState, MediaCommand, NowPlaying, Transfer } from '@shared/media'
import { parseExtensionMessage } from './browser-bridge-validate'

/** Real messages are a few KB at most. */
const MAX_PAYLOAD_BYTES = 64 * 1024
const HEARTBEAT_MS = 30_000

interface Client {
  browser: string
  media: TabMedia | null
  /** When `media` last changed, to pick the most recent player. */
  mediaAt: number
  downloads: BrowserDownload[]
  alive: boolean
}

export interface BrowserBridge {
  state(): BrowserState
  sendCommand(command: MediaCommand): void
  stop(): void
}

function toNowPlaying(media: TabMedia): NowPlaying {
  return {
    track: {
      id: `${media.site}\u0000${media.title}\u0000${media.artist}`,
      title: media.title,
      artist: media.artist,
      album: media.album,
      duration: media.duration,
      artworkUrl: media.artworkUrl
    },
    isPlaying: media.isPlaying,
    position: media.position,
    sourceApp: media.site
  }
}

function toTransfer(browser: string, download: BrowserDownload): Transfer {
  return {
    id: `${browser}-${download.id}`,
    kind: 'download',
    name: download.name,
    totalBytes: download.totalBytes,
    transferredBytes: download.bytesReceived,
    bytesPerSecond: download.bytesPerSecond,
    done: download.done
  }
}

/**
 * Local WebSocket server the MacIsland browser extension connects to.
 * Listens on loopback only and accepts only the extension's own origin.
 */
export function startBrowserBridge(onChange: (state: BrowserState) => void): BrowserBridge {
  const clients = new Map<WebSocket, Client>()
  let lastSent = ''

  const server = new WebSocketServer({
    host: BRIDGE_HOST,
    port: BRIDGE_PORT,
    maxPayload: MAX_PAYLOAD_BYTES,
    verifyClient: ({ origin }: { origin: string }) => origin === EXTENSION_ORIGIN
  })

  /** The tab that is playing wins; otherwise the one that changed most recently. */
  const activeClient = (): [WebSocket, Client] | null => {
    let best: [WebSocket, Client] | null = null
    for (const entry of clients) {
      const [, client] = entry
      if (!client.media) continue
      const current = best?.[1]
      const better =
        !current ||
        (client.media.isPlaying && !current.media?.isPlaying) ||
        (client.media.isPlaying === current.media?.isPlaying && client.mediaAt > current.mediaAt)
      if (better) best = entry
    }
    return best
  }

  const state = (): BrowserState => {
    const active = activeClient()
    return {
      nowPlaying: active?.[1].media ? toNowPlaying(active[1].media) : null,
      transfers: [...clients.values()].flatMap((client) => client.downloads.map((d) => toTransfer(client.browser, d)))
    }
  }

  const publish = (): void => {
    const next = state()
    const serialized = JSON.stringify(next)
    if (serialized === lastSent) return
    lastSent = serialized
    onChange(next)
  }

  server.on('connection', (socket) => {
    const client: Client = { browser: 'Browser', media: null, mediaAt: 0, downloads: [], alive: true }
    clients.set(socket, client)
    console.info('[browser-bridge] extension connected')

    socket.on('pong', () => (client.alive = true))
    socket.on('message', (data, isBinary) => {
      if (isBinary) return
      const message = parseExtensionMessage(data.toString())
      if (!message) {
        console.warn('[browser-bridge] dropped malformed message')
        return
      }
      client.alive = true
      switch (message.type) {
        case 'hello':
          client.browser = message.browser
          if (message.version !== PROTOCOL_VERSION) {
            console.warn(`[browser-bridge] extension protocol v${message.version}, app expects v${PROTOCOL_VERSION}`)
          }
          break
        case 'media':
          client.media = message.media
          client.mediaAt = Date.now()
          publish()
          break
        case 'downloads':
          client.downloads = message.downloads
          publish()
          break
        case 'ping':
          break
      }
    })
    socket.on('close', () => {
      clients.delete(socket)
      console.info('[browser-bridge] extension disconnected')
      publish()
    })
    socket.on('error', (error) => console.warn('[browser-bridge] socket error:', error.message))
  })

  server.on('error', (error: NodeJS.ErrnoException) => {
    const reason = error.code === 'EADDRINUSE' ? `port ${BRIDGE_PORT} is already in use` : error.message
    console.error(`[browser-bridge] not available: ${reason}`)
  })

  // Drop connections that stopped answering (browser quit without closing).
  const heartbeat = setInterval(() => {
    for (const [socket, client] of clients) {
      if (!client.alive) {
        socket.terminate()
        continue
      }
      client.alive = false
      socket.ping()
    }
  }, HEARTBEAT_MS)

  return {
    state,
    sendCommand(command) {
      const active = activeClient()
      if (!active) return
      const message: AppMessage = { type: 'command', command }
      active[0].send(JSON.stringify(message))
    },
    stop() {
      clearInterval(heartbeat)
      for (const socket of clients.keys()) socket.terminate()
      server.close()
    }
  }
}
