import { app, session } from 'electron'

/**
 * App-wide hardening applied before any window exists:
 * no popups, no navigation away from our page, no webviews, and every
 * permission request denied until a feature explicitly needs one.
 */
export function applySecurityPolicy(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event) => event.preventDefault())
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}
