import { execFile } from 'node:child_process'
import { chmodSync, existsSync, unlinkSync } from 'node:fs'
import { createServer, type Socket } from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'
import type { NotificationState } from '@shared/notifications'
import { parseHelperMessage } from './native-helper-validate'

const HELPER_BUNDLE = 'MacIsland Helper.app'
/** sockaddr_un.sun_path is 104 bytes on macOS, including the terminator. */
const MAX_SOCKET_PATH = 103
/** Icons make lines a few hundred KB at most; anything bigger is not from our helper. */
const MAX_BUFFER_BYTES = 4 * 1024 * 1024

function helperBundlePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, HELPER_BUNDLE)
    : join(app.getAppPath(), 'native', 'swift-helper', '.build', HELPER_BUNDLE)
}

export interface NativeHelper {
  state(): NotificationState
  stop(): void
}

/**
 * Starts "MacIsland Helper" and receives Dock badge counts from it over a
 * private Unix socket. The helper is launched through LaunchServices so
 * macOS asks for Accessibility permission for the helper alone.
 */
export function startNativeHelper(onChange: (state: NotificationState) => void): NativeHelper {
  let state: NotificationState = { permission: 'unknown', badges: [] }
  let active: Socket | null = null

  const update = (next: NotificationState): void => {
    state = next
    onChange(state)
  }

  const socketPath = join(app.getPath('userData'), 'helper.sock')
  const bundle = helperBundlePath()

  const server = createServer((socket) => {
    // One helper at a time; anything else connecting is refused.
    if (active) {
      socket.destroy()
      return
    }
    active = socket
    let buffer = ''

    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.length > MAX_BUFFER_BYTES) {
        console.warn('[native-helper] oversized message, disconnecting')
        socket.destroy()
        return
      }
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const message = parseHelperMessage(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        if (!message) {
          console.warn('[native-helper] dropped malformed message')
        } else if (message.type === 'permission') {
          update({ permission: message.granted ? 'granted' : 'denied', badges: message.granted ? state.badges : [] })
        } else {
          update({ ...state, badges: message.badges })
        }
      }
    })
    socket.on('close', () => {
      if (active === socket) active = null
      update({ permission: 'unknown', badges: [] })
    })
    socket.on('error', (error) => console.warn('[native-helper] socket error:', error.message))
  })

  server.on('error', (error) => console.error('[native-helper] socket server failed:', error.message))

  if (socketPath.length > MAX_SOCKET_PATH) {
    console.error(`[native-helper] socket path too long (${socketPath.length} chars): ${socketPath}`)
  } else if (!existsSync(bundle)) {
    console.error(`[native-helper] helper not built at ${bundle}. Run: npm run build:native`)
  } else {
    // A stale socket from a crash would make listen() fail.
    if (existsSync(socketPath)) unlinkSync(socketPath)
    server.listen(socketPath, () => {
      // Only this user may connect.
      chmodSync(socketPath, 0o600)
      execFile('/usr/bin/open', ['-g', '-j', '-n', bundle, '--args', '--socket', socketPath], (error) => {
        if (error) console.error('[native-helper] failed to launch helper:', error.message)
      })
    })
  }

  return {
    state: () => state,
    stop() {
      // Closing the socket makes the helper exit on its own.
      active?.destroy()
      server.close()
      if (existsSync(socketPath)) unlinkSync(socketPath)
    }
  }
}
