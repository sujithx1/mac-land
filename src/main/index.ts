import { app, powerMonitor } from 'electron'
import { IpcChannel } from '@shared/ipc'
import { registerBrowserIpc } from './ipc/browser'
import { registerIslandIpc } from './ipc/island'
import { registerLockIpc } from './ipc/lock'
import { registerNotificationIpc } from './ipc/notifications'
import { registerSystemIpc } from './ipc/system'
import { applySecurityPolicy } from './security'
import { createAppLock, visibleBrowserState, visibleNotifications } from './services/app-lock'
import { startBrowserBridge } from './services/browser-bridge'
import { startNativeHelper } from './services/native-helper'
import { loadSettings, saveSettings } from './services/settings'
import { startSystemMonitor } from './services/system-monitor'
import { createTray } from './tray'
import { computeIslandGeometry, type ScreenNotch } from './windows/geometry'
import { createIslandWindow } from './windows/island'
import { resolveDisplay, startIslandPlacement } from './windows/placement'

if (process.platform !== 'darwin') {
  console.error('MacIsland only runs on macOS.')
  app.exit(1)
}

if (!app.requestSingleInstanceLock()) {
  console.info('MacIsland is already running. Quit it from the menu bar icon first.')
  app.exit(0)
}

/** Cleanup steps, run in reverse order on quit. */
const disposers: (() => void)[] = []

/**
 * Some callbacks below refer to services created later in this function
 * (e.g. `tray`, `pushBrowser`). That is safe because they only fire on
 * later events (sockets, timers, IPC), never during start() itself.
 */
function start(): void {
  // An ambient system feature, not a document app: no Dock icon, no app menu.
  app.dock?.hide()
  applySecurityPolicy()

  const settings = loadSettings()
  const persist = (): void => saveSettings(settings)

  // Island window, placed on the preferred display.
  const initialDisplay = resolveDisplay(settings.display)
  const island = createIslandWindow(initialDisplay, computeIslandGeometry(initialDisplay))
  disposers.push(() => island.dispose())
  const contents = island.window.webContents
  const send = (channel: IpcChannel, payload: unknown): void => {
    if (!island.window.isDestroyed()) contents.send(channel, payload)
  }
  disposers.push(registerIslandIpc(island))

  let notches: ReadonlyMap<number, ScreenNotch> = new Map()
  const placement = startIslandPlacement(island, settings.display, () => notches)
  disposers.push(() => placement.dispose())

  // System readings.
  const monitor = startSystemMonitor((stats) => send(IpcChannel.SystemStatsChanged, stats))
  disposers.push(() => monitor.stop(), registerSystemIpc(monitor, contents))

  // Lock gate: while locked, browser and notification data never reach the renderer.
  let locked = settings.locked
  const isLocked = (): boolean => locked

  const browserBridge = startBrowserBridge(() => pushBrowser())
  disposers.push(() => browserBridge.stop(), registerBrowserIpc(browserBridge, contents, isLocked))
  const pushBrowser = (): void =>
    send(IpcChannel.BrowserStateChanged, visibleBrowserState(browserBridge.state(), isLocked()))

  const helper = startNativeHelper({
    onNotifications: () => {
      pushNotifications()
      tray.refresh()
    },
    onScreens: (next) => {
      notches = next
      placement.refresh()
    },
    onBiometry: (biometry) => appLock.setBiometry(biometry)
  })
  disposers.push(() => helper.stop(), registerNotificationIpc(helper, contents, isLocked))
  const pushNotifications = (): void =>
    send(IpcChannel.NotificationsChanged, visibleNotifications(helper.notifications(), isLocked()))

  const appLock = createAppLock({
    initiallyLocked: settings.locked,
    authenticate: (reason) => helper.authenticate(reason),
    onChange: (state) => {
      send(IpcChannel.LockStateChanged, state)
      tray.refresh()
    },
    onLockedChanged: (nowLocked) => {
      locked = nowLocked
      settings.locked = nowLocked
      persist()
      pushBrowser()
      pushNotifications()
    }
  })
  disposers.push(() => appLock.dispose(), registerLockIpc(appLock, contents))

  const onMacLocked = (): void => {
    if (settings.lockWhenMacLocks) appLock.lock()
  }
  powerMonitor.on('lock-screen', onMacLocked)
  disposers.push(() => powerMonitor.off('lock-screen', onMacLocked))

  const tray = createTray({
    displayPreference: () => placement.preference(),
    setDisplayPreference(preference) {
      settings.display = preference
      persist()
      placement.setPreference(preference)
      tray.refresh()
    },
    lockState: () => appLock.state(),
    lock: () => appLock.lock(),
    unlock: () => void appLock.unlock(),
    lockWhenMacLocks: () => settings.lockWhenMacLocks,
    setLockWhenMacLocks(enabled) {
      settings.lockWhenMacLocks = enabled
      persist()
    },
    badgePermission: () => helper.notifications().permission
  })
  disposers.push(() => tray.destroy())

  if (!app.isPackaged) console.info('[island] display', initialDisplay.label, island.geometry())
}

app
  .whenReady()
  .then(start)
  .catch((error: unknown) => {
    console.error('MacIsland failed to start:', error)
    app.exit(1)
  })

app.on('before-quit', () => {
  for (const dispose of disposers.splice(0).reverse()) dispose()
})

// The island is the whole app; closing it must not leave a headless process
// unless we are quitting anyway.
app.on('window-all-closed', () => app.quit())
