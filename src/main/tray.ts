import { Menu, Tray, app, nativeImage, type NativeImage } from 'electron'

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

export function createTray(): Tray {
  const tray = new Tray(createPillTemplateIcon())
  tray.setToolTip('MacIsland')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'MacIsland', enabled: false },
      { type: 'separator' },
      { label: 'Quit MacIsland', accelerator: 'Command+Q', click: () => app.quit() }
    ])
  )
  return tray
}
