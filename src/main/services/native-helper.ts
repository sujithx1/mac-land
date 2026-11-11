import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, unlinkSync } from 'node:fs'
import { createServer, type Socket } from 'node:net'
import { join } from 'node:path'
import { app } from 'electron'
import type { AuthError, Biometry } from '@shared/lock'
import type { NotificationState } from '@shared/notifications'
import type { ScreenNotch } from '../windows/geometry'
import { parseHelperMessage } from './native-helper-validate'

const HELPER_BUNDLE = 'MacIsland Helper.app'
/** sockaddr_un.sun_path is 104 bytes on macOS, including the terminator. */
const MAX_SOCKET_PATH = 103
/** Icons make lines a few hundred KB at most; anything bigger is not from our helper. */
const MAX_BUFFER_BYTES = 4 * 1024 * 1024
/** The Touch ID sheet waits for the user; give up eventually so the UI never hangs. */
const AUTH_TIMEOUT_MS = 120_000
/** Relaunch a helper that exits unexpectedly, but stop if it keeps failing. */
const RELAUNCH_DELAY_MS = 2000
const MAX_QUICK_RELAUNCHES = 5

export type AuthOutcome = { success: true } | { success: false; error: AuthError }

export interface HelperEvents {
  onNotifications(state: NotificationState): void
  onScreens(screens: ReadonlyMap<number, ScreenNotch>): void
  onBiometry(biometry: Biometry): void
}

export interface NativeHelper {
  notifications(): NotificationState
  screens(): ReadonlyMap<number, ScreenNotch>
  biometry(): Biometry
  /** Shows the system Touch ID / password sheet. */
  authenticate(reason: string): Promise<AuthOutcome>
  stop(): void
}

function helperBundlePath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, HELPER_BUNDLE)
    : join(app.getAppPath(), 'native', 'swift-helper', '.build', HELPER_BUNDLE)
}

/**
 * Starts "MacIsland Helper" and talks to it over a private Unix socket.
 * The helper is launched through LaunchServices so macOS asks for
 * Accessibility permission for the helper alone.
 */
export function startNativeHelper(events: HelperEvents): NativeHelper {
  let notifications: NotificationState = { permission: 'unknown', badges: [] }
  let screens: ReadonlyMap<number, ScreenNotch> = new Map()
  let biometry: Biometry = 'unknown'
  let active: Socket | null = null
  let stopped = false
  let quickRelaunches = 0
  let launchedAt = 0
  const pendingAuth = new Map<string, { resolve: (outcome: AuthOutcome) => void; timer: NodeJS.Timeout }>()

  const setNotifications = (next: NotificationState): void => {
    notifications = next
    events.onNotifications(notifications)
  }

  const settleAuth = (id: string, outcome: AuthOutcome): void => {
    const pending = pendingAuth.get(id)
    if (!pending) return
    clearTimeout(pending.timer)
    pendingAuth.delete(id)
    pending.resolve(outcome)
  }

  const socketPath = join(app.getPath('userData'), 'helper.sock')
  const bundle = helperBundlePath()

  const launch = (): void => {
    launchedAt = Date.now()
    // Never raise the macOS Accessibility dialog on launch: it pops up on every start
    // whenever macOS no longer matches the helper to its saved permission. While access
    // is missing, the menu bar menu offers "Allow Notification Counts…" instead.
    const args = ['--socket', socketPath, '--no-prompt']
    execFile('/usr/bin/open', ['-g', '-j', '-n', bundle, '--args', ...args], (error) => {
      if (error) console.error('[native-helper] failed to launch helper:', error.message)
    })
  }

  const handleLine = (line: string): void => {
    const message = parseHelperMessage(line)
    if (!message) {
      console.warn('[native-helper] dropped malformed message')
      return
    }
    switch (message.type) {
      case 'permission':
        setNotifications({
          permission: message.granted ? 'granted' : 'denied',
          badges: message.granted ? notifications.badges : []
        })
        break
      case 'badges':
        setNotifications({ ...notifications, badges: message.badges })
        break
      case 'screens':
        screens = new Map(message.screens.map((s) => [s.id, { width: s.notchWidth, height: s.notchHeight }]))
        events.onScreens(screens)
        break
      case 'auth-capability':
        biometry = message.biometry
        events.onBiometry(biometry)
        break
      case 'auth-result':
        settleAuth(message.id, message.success ? { success: true } : { success: false, error: message.error ?? 'failed' })
        break
    }
  }

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
        handleLine(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
      }
    })
    socket.on('close', () => {
      if (active !== socket) return
      active = null
      for (const id of [...pendingAuth.keys()]) settleAuth(id, { success: false, error: 'unavailable' })
      // Quitting: the tray and window this would update are already gone.
      if (stopped) return
      setNotifications({ permission: 'unknown', badges: [] })
      biometry = 'unknown'
      events.onBiometry(biometry)

      quickRelaunches = Date.now() - launchedAt < 10_000 ? quickRelaunches + 1 : 0
      if (quickRelaunches >= MAX_QUICK_RELAUNCHES) {
        console.error('[native-helper] helper keeps exiting; not relaunching')
        return
      }
      setTimeout(() => {
        if (!stopped) launch()
      }, RELAUNCH_DELAY_MS)
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
      launch()
    })
  }

  return {
    notifications: () => notifications,
    screens: () => screens,
    biometry: () => biometry,
    authenticate(reason) {
      const socket = active
      if (!socket) return Promise.resolve({ success: false, error: 'unavailable' })
      const id = randomUUID()
      return new Promise<AuthOutcome>((resolve) => {
        const timer = setTimeout(() => settleAuth(id, { success: false, error: 'timeout' }), AUTH_TIMEOUT_MS)
        pendingAuth.set(id, { resolve, timer })
        socket.write(`${JSON.stringify({ type: 'authenticate', id, reason })}\n`)
      })
    },
    stop() {
      stopped = true
      for (const id of [...pendingAuth.keys()]) settleAuth(id, { success: false, error: 'unavailable' })
      // Closing the socket makes the helper exit on its own.
      active?.destroy()
      server.close()
      if (existsSync(socketPath)) unlinkSync(socketPath)
    }
  }
}
