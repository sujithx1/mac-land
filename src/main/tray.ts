import { Menu, Tray, app, nativeImage, shell, type NativeImage } from 'electron'
import type { LockState } from '@shared/lock'
import type { BadgePermission } from '@shared/notifications'

const ACCESSIBILITY_SETTINGS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'

/**
 * Draws a small pill as a macOS template image so the menu bar tints it
 * correctly in light, dark and tinted menu bars. Generated at runtime to
 * avoid shipping binary assets for an 18pt glyph.
 */
function createPillTemplateIcon(): NativeImage {
  const scale = 2
  const size = 18 * scale
  const pillWidth = 14 * scale
  const pillHeight = 6 * scale
  const radius = pillHeight / 2
  const left = (size - pillWidth) / 2
  const top = (size - pillHeight) / 2
  const samples = 4
  const buffer = Buffer.alloc(size * size * 4)

  const inside = (x: number, y: number): boolean => {
    const cx = Math.min(Math.max(x, left + radius), left + pillWidth - radius)
    const cy = top + radius
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
  }

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          if (inside(px + (sx + 0.5) / samples, py + (sy + 0.5) / samples)) hits++
        }
      }
      // BGRA; template images only use alpha.
      buffer[(py * size + px) * 4 + 3] = Math.round((hits / samples ** 2) * 255)
    }
  }

  const image = nativeImage.createFromBitmap(buffer, { width: size, height: size, scaleFactor: scale })
  image.setTemplateImage(true)
  return image
}

/** A connected display as the menu lists it. */
export interface DisplayMenuEntry {
  id: number
  name: string
  /** Has an island right now. */
  shown: boolean
}

export interface TrayController {
  displays(): DisplayMenuEntry[]
  allDisplays(): boolean
  /** Ticks or unticks one display; the last one shown cannot be unticked. */
  toggleDisplay(id: number): void
  setAllDisplays(all: boolean): void
  lockState(): LockState
  lock(): void
  unlock(): void
  lockWhenMacLocks(): boolean
  setLockWhenMacLocks(enabled: boolean): void
  /** Whether MacIsland Helper may read Dock badge counts. */
  badgePermission(): BadgePermission
  animateMacUnlock(): boolean
  setAnimateMacUnlock(enabled: boolean): void
}

/** Only the installed app can start at login; in development it would register Electron itself. */
function openAtLoginItem(): Electron.MenuItemConstructorOptions[] {
  if (!app.isPackaged) return []
  return [
    {
      label: 'Open at Login',
      type: 'checkbox',
      // macOS keeps this setting, so it is read back rather than stored in settings.json.
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' }
  ]
}

export interface IslandTray {
  /** Rebuild the menu after state it shows has changed. */
  refresh(): void
  destroy(): void
}

export function createTray(controller: TrayController): IslandTray {
  const tray = new Tray(createPillTemplateIcon())

  const build = (): void => {
    const lock = controller.lockState()
    const locked = lock.phase !== 'unlocked'
    // Without the helper there is no way to unlock, so do not allow locking.
    const helperReady = lock.biometry !== 'unknown'
    const unlockLabel = lock.biometry === 'touchID' ? 'Unlock with Touch ID…' : 'Unlock…'

    tray.setToolTip(locked ? 'MacIsland (Locked)' : 'MacIsland')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: locked ? 'MacIsland is Locked' : 'MacIsland', enabled: false },
        { type: 'separator' },
        {
          label: 'Show Island On',
          submenu: [
            {
              label: 'All Displays',
              type: 'checkbox',
              checked: controller.allDisplays(),
              click: (item) => controller.setAllDisplays(item.checked)
            },
            { type: 'separator' },
            ...controller.displays().map(
              (display): Electron.MenuItemConstructorOptions => ({
                label: display.name,
                type: 'checkbox',
                checked: display.shown,
                // With "All Displays" on, every display is shown; pick them one by one after turning it off.
                enabled: !controller.allDisplays(),
                click: () => controller.toggleDisplay(display.id)
              })
            )
          ]
        },
        { type: 'separator' },
        locked
          ? { label: unlockLabel, enabled: helperReady && lock.phase !== 'authenticating', click: () => controller.unlock() }
          : { label: 'Lock MacIsland', enabled: helperReady, click: () => controller.lock() },
        {
          label: 'Lock When Mac Locks',
          type: 'checkbox',
          checked: controller.lockWhenMacLocks(),
          click: (item) => controller.setLockWhenMacLocks(item.checked)
        },
        {
          label: 'Face ID Animation on Unlock',
          type: 'checkbox',
          checked: controller.animateMacUnlock(),
          click: (item) => controller.setAnimateMacUnlock(item.checked)
        },
        { type: 'separator' },
        ...openAtLoginItem(),
        // Only while access is missing: without it there are no unread counts.
        ...(controller.badgePermission() === 'denied'
          ? [
              { label: 'Allow Notification Counts…', click: () => void shell.openExternal(ACCESSIBILITY_SETTINGS) },
              { type: 'separator' as const }
            ]
          : []),
        { label: 'Quit MacIsland', accelerator: 'Command+Q', click: () => app.quit() }
      ])
    )
  }

  build()
  // Late events (a helper disconnecting while quitting) must not touch a destroyed tray.
  return {
    refresh: () => {
      if (!tray.isDestroyed()) build()
    },
    destroy: () => tray.destroy()
  }
}
