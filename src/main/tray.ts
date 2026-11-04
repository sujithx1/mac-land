import { Menu, Tray, app, nativeImage, type NativeImage } from 'electron'
import type { LockState } from '@shared/lock'
import { DISPLAY_PREFERENCES, DISPLAY_PREFERENCE_LABELS, type DisplayPreference } from './services/settings'

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

export interface TrayController {
  displayPreference(): DisplayPreference
  setDisplayPreference(preference: DisplayPreference): void
  lockState(): LockState
  lock(): void
  unlock(): void
  lockWhenMacLocks(): boolean
  setLockWhenMacLocks(enabled: boolean): void
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
          submenu: DISPLAY_PREFERENCES.map((preference) => ({
            label: DISPLAY_PREFERENCE_LABELS[preference],
            type: 'radio' as const,
            checked: preference === controller.displayPreference(),
            click: () => controller.setDisplayPreference(preference)
          }))
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
        { type: 'separator' },
        { label: 'Quit MacIsland', accelerator: 'Command+Q', click: () => app.quit() }
      ])
    )
  }

  build()
  return { refresh: build, destroy: () => tray.destroy() }
}
