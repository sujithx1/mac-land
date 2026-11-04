import { app, type Tray } from 'electron'
import { IpcChannel } from '@shared/ipc'
import { createIslandWindow, type IslandWindow } from './windows/island'
import { registerIslandIpc } from './ipc/island'
import { registerSystemIpc } from './ipc/system'
import { registerBrowserIpc } from './ipc/browser'
import { registerNotificationIpc } from './ipc/notifications'
import { startNativeHelper, type NativeHelper } from './services/native-helper'
import { startBrowserBridge, type BrowserBridge } from './services/browser-bridge'
import { startSystemMonitor, type SystemMonitor } from './services/system-monitor'
import { applySecurityPolicy } from './security'
import { createTray } from './tray'

if (process.platform !== 'darwin') {
  console.error('MacIsland only runs on macOS.')
  app.exit(1)
}

if (!app.requestSingleInstanceLock()) {
  console.info('MacIsland is already running. Quit it from the menu bar icon first.')
  app.exit(0)
}

let island: IslandWindow | null = null
let tray: Tray | null = null
let monitor: SystemMonitor | null = null
let browserBridge: BrowserBridge | null = null
let nativeHelper: NativeHelper | null = null
const disposers: (() => void)[] = []

app.whenReady().then(() => {
  // An ambient system feature, not a document app: no Dock icon, no app menu.
  app.dock?.hide()
  applySecurityPolicy()

  const islandWindow = createIslandWindow()
  island = islandWindow
  disposers.push(registerIslandIpc(islandWindow))

  monitor = startSystemMonitor((stats) => {
    if (!islandWindow.window.isDestroyed()) islandWindow.window.webContents.send(IpcChannel.SystemStatsChanged, stats)
  })
  disposers.push(registerSystemIpc(monitor, islandWindow.window.webContents))

  browserBridge = startBrowserBridge((state) => {
    if (!islandWindow.window.isDestroyed()) islandWindow.window.webContents.send(IpcChannel.BrowserStateChanged, state)
  })
  disposers.push(registerBrowserIpc(browserBridge, islandWindow.window.webContents))

  nativeHelper = startNativeHelper((state) => {
    if (!islandWindow.window.isDestroyed()) islandWindow.window.webContents.send(IpcChannel.NotificationsChanged, state)
  })
  disposers.push(registerNotificationIpc(nativeHelper, islandWindow.window.webContents))

  tray = createTray()

  if (!app.isPackaged) console.info('[island] geometry', island.geometry())
}).catch((error: unknown) => {
  console.error('MacIsland failed to start:', error)
  app.exit(1)
})

app.on('before-quit', () => {
  disposers.splice(0).forEach((dispose) => dispose())
  monitor?.stop()
  browserBridge?.stop()
  nativeHelper?.stop()
  island?.dispose()
  tray?.destroy()
  island = null
  monitor = null
  browserBridge = null
  nativeHelper = null
  tray = null
})

// The island is the whole app; closing it must not leave a headless process
// unless we are quitting anyway.
app.on('window-all-closed', () => app.quit())
