import { join } from 'node:path'
import { BrowserWindow, screen, type Display } from 'electron'
import { IpcChannel, type IslandGeometry } from '@shared/ipc'
import { computeIslandGeometry, islandWindowBounds } from './geometry'

export interface IslandWindow {
  window: BrowserWindow
  geometry(): IslandGeometry
  setInteractive(interactive: boolean): void
  dispose(): void
}

export function createIslandWindow(): IslandWindow {
  let display: Display = screen.getPrimaryDisplay()
  let geometry = computeIslandGeometry(display)
  let interactive = false

  const window = new BrowserWindow({
    ...islandWindowBounds(display, geometry),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // NSPanel-style non-activating window: floats over full-screen apps and
    // never steals focus from the app the user is working in.
    type: 'panel',
    focusable: false,
    // Lets the frame sit over the menu bar without macOS nudging it down.
    enableLargerThanScreen: true,
    acceptFirstMouse: true,
    title: 'MacIsland',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  })

  // Above the menu bar and regular windows; present on every Space,
  // including full-screen ones.
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  window.setWindowButtonVisibility(false)

  // Transparent pixels must not swallow clicks meant for the menu bar or the
  // app underneath. `forward` keeps mousemove flowing so the renderer can
  // detect when the pointer reaches the island and ask to become interactive.
  window.setIgnoreMouseEvents(true, { forward: true })

  const reposition = (): void => {
    display = screen.getPrimaryDisplay()
    geometry = computeIslandGeometry(display)
    window.setBounds(islandWindowBounds(display, geometry))
    window.webContents.send(IpcChannel.GeometryChanged, geometry)
  }

  screen.on('display-metrics-changed', reposition)
  screen.on('display-added', reposition)
  screen.on('display-removed', reposition)

  window.once('ready-to-show', () => window.showInactive())

  if (process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return {
    window,
    geometry: () => geometry,
    setInteractive(next) {
      if (next === interactive || window.isDestroyed()) return
      interactive = next
      window.setIgnoreMouseEvents(!next, { forward: true })
    },
    dispose() {
      screen.off('display-metrics-changed', reposition)
      screen.off('display-added', reposition)
      screen.off('display-removed', reposition)
      if (!window.isDestroyed()) window.destroy()
    }
  }
}
