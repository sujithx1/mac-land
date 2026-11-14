// Builds build/icon.icns from build/icon.svg: `npm run icon`.
// Renders the SVG with Electron (no extra image tools needed), then uses the
// macOS tools sips and iconutil to make every size the icon file needs.
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('node:child_process')
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const root = join(__dirname, '..')
const svg = readFileSync(join(root, 'build', 'icon.svg'), 'utf8')
const SIZE = 1024
const SIZES = [16, 32, 128, 256, 512]

app.dock?.hide()
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true, javascript: false }
  })
  const page = `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
  // Offscreen rendering paints at 1x, so the capture is exactly 1024 x 1024.
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  const master = join(root, 'build', 'icon.png')
  writeFileSync(master, image.toPNG())

  const work = mkdtempSync(join(tmpdir(), 'macisland-icon-'))
  const iconset = join(work, 'icon.iconset')
  execFileSync('/bin/mkdir', [iconset])
  for (const size of SIZES) {
    const resize = (pixels, name) =>
      execFileSync('/usr/bin/sips', ['-z', String(pixels), String(pixels), master, '--out', join(iconset, name)], { stdio: 'ignore' })
    resize(size, `icon_${size}x${size}.png`)
    resize(size * 2, `icon_${size}x${size}@2x.png`)
  }
  execFileSync('/usr/bin/iconutil', ['-c', 'icns', iconset, '-o', join(root, 'build', 'icon.icns')])
  rmSync(work, { recursive: true, force: true })
  console.log('Wrote build/icon.png and build/icon.icns')
  app.quit()
})
