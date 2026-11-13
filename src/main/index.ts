import { app, powerMonitor, screen } from 'electron'
import { IpcChannel } from '@shared/ipc'
import { registerBrowserIpc } from './ipc/browser'
import { registerIslandIpc } from './ipc/island'
import { registerLockIpc } from './ipc/lock'
import { registerNotificationIpc } from './ipc/notifications'
import { registerSystemIpc } from './ipc/system'
import { applySecurityPolicy } from './security'
import { createAppLock, visibleBrowserState, visibleNotifications } from './services/app-lock'
import { startBrowserBridge } from './services/browser-bridge'
import { startDeviceAlerts } from './services/device-alerts'
import { startNativeHelper } from './services/native-helper'
import { loadSettings, saveSettings } from './services/settings'
import { startSystemMonitor } from './services/system-monitor'
import { createTray } from './tray'
import type { ScreenNotch } from './windows/geometry'
import { displayName, resolveDisplays, startIslands, toggleDisplay } from './windows/islands'

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

  // One island per chosen display; all of them show the same live data.
  let notches: ReadonlyMap<number, ScreenNotch> = new Map()
  const islands = startIslands(settings.displays, () => notches, () => tray.refresh())
  disposers.push(() => islands.dispose())
  const send = (channel: IpcChannel, payload: unknown): void => islands.broadcast(channel, payload)
  const isTrusted = (contents: Electron.WebContents): boolean => islands.fromSender(contents) !== undefined
  disposers.push(registerIslandIpc(islands, isTrusted))

  // System readings.
  const monitor = startSystemMonitor((stats) => send(IpcChannel.SystemStatsChanged, stats))
  // Camera and microphone use, from `deviceAlerts` below; only asked for once the island has loaded.
  disposers.push(() => monitor.stop(), registerSystemIpc(monitor, () => deviceAlerts.inUse(), isTrusted))

  // Lock gate: while locked, browser and notification data never reach the renderer.
  let locked = settings.locked
  const isLocked = (): boolean => locked

  const browserBridge = startBrowserBridge(() => pushBrowser())
  disposers.push(() => browserBridge.stop(), registerBrowserIpc(browserBridge, isTrusted, isLocked))
  const pushBrowser = (): void =>
    send(IpcChannel.BrowserStateChanged, visibleBrowserState(browserBridge.state(), isLocked()))

  const helper = startNativeHelper({
    onNotifications: () => {
      pushNotifications()
      tray.refresh()
    },
    onScreens: (next) => {
      notches = next
      islands.refresh()
    },
    onBiometry: (biometry) => appLock.setBiometry(biometry)
  })
  disposers.push(() => helper.stop(), registerNotificationIpc(helper, isTrusted, isLocked))
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
  disposers.push(() => appLock.dispose(), registerLockIpc(appLock, isTrusted))

  const onMacLocked = (): void => {
    if (settings.lockWhenMacLocks) appLock.lock('mac')
  }
  powerMonitor.on('lock-screen', onMacLocked)
  disposers.push(() => powerMonitor.off('lock-screen', onMacLocked))

  // macOS has just checked Touch ID or the password. A lock that came from
  // the Mac locking opens with it; a lock set from the menu still needs
  // MacIsland's own Touch ID, and the animation is skipped for it.
  const onMacUnlocked = (): void => {
    const opensLock = appLock.lockedByMac()
    const animate = settings.animateMacUnlock && (!locked || opensLock)
    if (!app.isPackaged) {
      console.info('[island] mac unlocked:', opensLock ? 'lock opened,' : '', 'animation', animate ? 'played' : 'skipped')
    }
    // Animation first, so the Face ID card already covers the island as the lock opens.
    if (animate) send(IpcChannel.MacUnlocked, null)
    if (opensLock) appLock.unlockWithMac()
  }
  powerMonitor.on('unlock-screen', onMacUnlocked)
  disposers.push(() => powerMonitor.off('unlock-screen', onMacUnlocked))

  // A charger or headphones connecting. Headphone names are personal ("Sujith's AirPods"),
  // so like music they are not shown while MacIsland is locked; the charge level is.
  // Camera and microphone use is a privacy signal, so it shows even while locked.
  const deviceAlerts = startDeviceAlerts({
    onInUse: (inUse) => send(IpcChannel.InUseChanged, inUse),
    refreshBattery: () => monitor.refreshBattery(),
    onAlert: (alert) => {
      if (!settings.deviceAlerts) return
      if (alert.kind === 'headphones' && isLocked()) return
      if (!app.isPackaged) console.info('[island] device alert:', alert)
      send(IpcChannel.DeviceAlert, alert)
    }
  })
  disposers.push(() => deviceAlerts.stop())

  const tray = createTray({
    displays: () => {
      const shown = new Set(resolveDisplays(islands.selection()).map((display) => display.id))
      return screen.getAllDisplays().map((display) => ({
        id: display.id,
        name: displayName(display),
        shown: shown.has(display.id)
      }))
    },
    allDisplays: () => islands.selection().all,
    toggleDisplay(id) {
      const display = screen.getAllDisplays().find((d) => d.id === id)
      const next = display && toggleDisplay(islands.selection(), display)
      if (!next) return
      settings.displays = next
      persist()
      islands.setSelection(next)
    },
    setAllDisplays(all) {
      // Turning "All Displays" off keeps the MacBook display, the default.
      settings.displays = { all, chosen: [] }
      persist()
      islands.setSelection(settings.displays)
    },
    lockState: () => appLock.state(),
    lock: () => appLock.lock(),
    unlock: () => void appLock.unlock(),
    lockWhenMacLocks: () => settings.lockWhenMacLocks,
    setLockWhenMacLocks(enabled) {
      settings.lockWhenMacLocks = enabled
      persist()
    },
    badgePermission: () => helper.notifications().permission,
    animateMacUnlock: () => settings.animateMacUnlock,
    setAnimateMacUnlock(enabled) {
      settings.animateMacUnlock = enabled
      persist()
    },
    deviceAlerts: () => settings.deviceAlerts,
    setDeviceAlerts(enabled) {
      settings.deviceAlerts = enabled
      persist()
    }
  })
  disposers.push(() => tray.destroy())

  if (!app.isPackaged) {
    for (const island of islands.windows()) console.info('[island] window', island.geometry())
  }
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
